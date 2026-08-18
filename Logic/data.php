<?php
session_start();

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Access-Control-Allow-Origin: http://localhost:8000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Authentication required.']);
    exit;
}

require_once __DIR__ . '/retrieve_data.php';

$action = $_GET['action'] ?? 'all';

switch ($action) {
    case 'all':
        echo json_encode(getAllData());
        break;
    case 'search':
        handleSearch();
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
}

function getAllData(): array
{
    $cases = json_decode(file_get_contents(__DIR__ . '/../Data/fraud_cases.json'), true);
    $transactions = json_decode(file_get_contents(__DIR__ . '/../Data/transactions.json'), true);
    $policies = json_decode(file_get_contents(__DIR__ . '/../Data/policies.json'), true);

    $formattedCases = array_map(fn($c) => formatCase($c), $cases);
    $resolvedCases = count(array_filter($formattedCases, fn($c) => $c['status'] === 'Resolved'));
    $openCases = count(array_filter($formattedCases, fn($c) => $c['status'] === 'Open'));

    $flagged = array_filter($transactions, fn($t) =>
        stripos($t['text'], 'flagged true') !== false
    );

    return [
        'stats' => [
            'total_cases' => count($formattedCases),
            'open_cases' => $openCases,
            'resolved_cases' => $resolvedCases,
            'flagged_transactions' => count($flagged),
            'total_transactions' => count($transactions),
            'policies' => count($policies),
        ],
        'cases' => $formattedCases,
        'transactions' => array_map(fn($t) => formatTransaction($t), $transactions),
        'policies' => array_map(fn($p) => formatPolicy($p), $policies),
    ];
}

function getCaseStatus(string $text): string
{
    $isResolved = stripos($text, 'reversed') !== false
        || stripos($text, 'frozen') !== false
        || stripos($text, 'blocked') !== false
        || stripos($text, 'secured') !== false
        || stripos($text, 'restored') !== false;

    if ($isResolved) {
        return 'Resolved';
    }

    return 'Open';
}

function getCaseType(string $text): string
{
    if (stripos($text, 'card testing') !== false) {
        return 'Card Testing';
    }

    if (stripos($text, 'refund') !== false) {
        return 'Merchant Refund Abuse';
    }

    if (stripos($text, 'wallet') !== false || stripos($text, 'country') !== false || stripos($text, 'travel') !== false || stripos($text, 'geo') !== false || stripos($text, 'blocked ip') !== false) {
        return 'Geo-Velocity Anomaly';
    }

    if (stripos($text, 'device') !== false || stripos($text, 'password reset') !== false || stripos($text, 'new payee') !== false || stripos($text, 'payee') !== false) {
        return 'Account Takeover';
    }

    if (stripos($text, 'unauthorized') !== false) {
        return 'Unauthorized Transfer';
    }

    return 'Fraud Investigation';
}

function getCaseSeverity(string $text): string
{
    if (preg_match('/\$(\d[\d,]*)/', $text, $matches)) {
        $amount = (int) str_replace(',', '', $matches[1]);
        if ($amount >= 2500) {
            return 'High';
        }
    }

    $highRiskKeywords = ['unauthorized', 'refund', 'wallet', 'blocked ip', 'country', 'travel', 'new payee', 'password reset', 'device', 'merchant'];
    foreach ($highRiskKeywords as $keyword) {
        if (stripos($text, $keyword) !== false) {
            return 'High';
        }
    }

    return 'Medium';
}

function formatCase(array $item): array
{
    $text = $item['text'];
    $status = getCaseStatus($text);
    $severity = getCaseSeverity($text);

    return [
        'id' => $item['id'],
        'summary' => $text,
        'status' => $status,
        'severity' => $severity,
        'type' => getCaseType($text),
    ];
}

function formatTransaction(array $item): array
{
    $text = $item['text'];
    $flagged = stripos($text, 'flagged true') !== false;

    preg_match('/\$(\d+)/', $text, $amount);
    preg_match('/amount \$(\d+)/', $text, $amt);

    return [
        'id' => $item['id'],
        'summary' => $text,
        'amount' => $amt[1] ?? ($amount[1] ?? '—'),
        'flagged' => $flagged,
        'risk' => $flagged ? 'High' : 'Low',
    ];
}

function formatPolicy(array $item): array
{
    return [
        'id' => $item['id'],
        'summary' => $item['text'],
        'category' => stripos($item['text'], 'verification') !== false ? 'Verification' : 'Velocity',
    ];
}

function handleSearch(): void
{
    $data = json_decode(file_get_contents('php://input'), true);
    $query = trim($data['query'] ?? '');

    if (empty($query)) {
        echo json_encode(['results' => []]);
        return;
    }

    $docs = retrieveRelevant($query, 10);
    $results = array_map(function (array $doc) {
        $type = sourceToType($doc['source']);
        $formatted = match ($doc['source']) {
            'fraud_cases' => formatCase($doc),
            'transactions' => formatTransaction($doc),
            'policies' => formatPolicy($doc),
            default => ['id' => $doc['id'], 'summary' => $doc['text']],
        };

        return array_merge($formatted, [
            'type' => $type,
            'text' => $doc['text'],
        ]);
    }, $docs);

    echo json_encode(['results' => $results]);
}
