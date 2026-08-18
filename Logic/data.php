<?php
session_start();

header('Content-Type: application/json');
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

require_once __DIR__ . '/retrieveData.php';

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

function formatCase(array $item): array
{
    $text = $item['text'];
    $status = getCaseStatus($text);
    $severity = stripos($text, '$2,500') !== false || stripos($text, 'unauthorized') !== false
        ? 'High' : 'Medium';

    return [
        'id' => $item['id'],
        'summary' => $text,
        'status' => $status,
        'severity' => $severity,
        'type' => stripos($text, 'card testing') !== false ? 'Card Testing' : 'Unauthorized Transfer',
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

    $results = retrieveRelevant($query, 10);
    echo json_encode(['results' => $results]);
}
