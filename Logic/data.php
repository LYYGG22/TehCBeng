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

    $flagged = array_filter($transactions, fn($t) =>
        stripos($t['text'], 'flagged true') !== false
    );

    return [
        'stats' => [
            'total_cases' => count($cases),
            'open_cases' => count($cases),
            'resolved_cases' => 0,
            'flagged_transactions' => count($flagged),
            'total_transactions' => count($transactions),
            'policies' => count($policies),
        ],
        'cases' => array_map(fn($c) => formatCase($c), $cases),
        'transactions' => array_map(fn($t) => formatTransaction($t), $transactions),
        'policies' => array_map(fn($p) => formatPolicy($p), $policies),
    ];
}

function formatCase(array $item): array
{
    $text = $item['text'];
    $status = stripos($text, 'Reversed') !== false || stripos($text, 'frozen') !== false
        ? 'Resolved' : 'Open';
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
