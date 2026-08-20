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
    // Permission-aware: restricted records are excluded from the dashboard
    // for this role, same as the chatbot's retrieval.
    $role = $_SESSION['user']['role'] ?? 'Staff';
    $accessibleDocs = array_filter(loadAllDocs(), fn($d) => canAccessDocument($d, $role));

    $cases = array_values(array_filter($accessibleDocs, fn($d) => $d['source'] === 'fraud_cases'));
    $transactions = array_values(array_filter($accessibleDocs, fn($d) => $d['source'] === 'transactions'));
    $policies = array_values(array_filter($accessibleDocs, fn($d) => $d['source'] === 'policies'));

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

    if (stripos($text, 'chargeback') !== false || stripos($text, 'friendly fraud') !== false) {
        return 'Friendly Fraud';
    }

    if (stripos($text, 'refund') !== false) {
        return 'Merchant Refund Abuse';
    }

    if (stripos($text, 'phishing') !== false) {
        return 'Phishing';
    }

    if (stripos($text, 'social-engineering') !== false || stripos($text, 'social engineering') !== false || stripos($text, 'impersonat') !== false) {
        return 'Social Engineering';
    }

    if (stripos($text, 'sim swap') !== false) {
        return 'SIM Swap';
    }

    if (stripos($text, 'mule') !== false) {
        return 'Money Mule';
    }

    if (stripos($text, 'identity') !== false) {
        return 'Identity Theft';
    }

    if (stripos($text, 'duplicate') !== false) {
        return 'Duplicate Charge';
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
    $amount = 0;
    if (preg_match('/\$(\d[\d,]*)/', $text, $matches)) {
        $amount = (int) str_replace(',', '', $matches[1]);
    }

    if ($amount >= 2500) {
        return 'High';
    }

    if ($amount > 0 && $amount < 200) {
        return 'Low';
    }

    return 'Medium';
}

function formatCase(array $item): array
{
    $text = $item['text'];
    $caseId = $item['id'];
    $caseUpdates = $_SESSION['case_updates'][$caseId] ?? [];
    $status = $caseUpdates['status'] ?? $item['status'] ?? getCaseStatus($text);
    $severity = $item['severity'] ?? $item['risk_level'] ?? getCaseSeverity($text);
    $type = $item['type'] ?? $item['fraud_type'] ?? getCaseType($text);

    return [
        'id' => $caseId,
        'summary' => $text,
        'original_message' => $item['original_message'] ?? '',
        'status' => $status,
        'severity' => $severity,
        'type' => $type,
        'assigned_department' => $caseUpdates['assigned_department'] ?? null,
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

function getPolicyCategory(string $text): string
{
    $lower = strtolower($text);

    if (str_contains($lower, 'geo-velocity') || str_contains($lower, 'blocked ip') || str_contains($lower, 'travel')) {
        return 'Geo-Velocity';
    }
    if (str_contains($lower, 'card testing')) {
        return 'Card Testing';
    }
    if (str_contains($lower, 'refund')) {
        return 'Refunds';
    }
    if (str_contains($lower, 'duplicate')) {
        return 'Billing';
    }
    if (str_contains($lower, 'phishing') || str_contains($lower, 'social-engineering') || str_contains($lower, 'impersonat')) {
        return 'Social Engineering';
    }
    if (str_contains($lower, 'sim swap') || str_contains($lower, 'device') || str_contains($lower, 'password')) {
        return 'Account Security';
    }
    if (str_contains($lower, 'mule')) {
        return 'Money Mule';
    }
    if (str_contains($lower, 'chargeback') || str_contains($lower, 'friendly fraud')) {
        return 'Chargebacks';
    }
    if (str_contains($lower, 'identity')) {
        return 'Identity';
    }
    if (str_contains($lower, 'payee')) {
        return 'Payee Controls';
    }
    if (str_contains($lower, 'otp') || str_contains($lower, 'verification')) {
        return 'Verification';
    }
    if (str_contains($lower, 'velocity')) {
        return 'Velocity';
    }

    return 'General';
}

function formatPolicy(array $item): array
{
    return [
        'id' => $item['id'],
        'summary' => $item['text'],
        'category' => getPolicyCategory($item['text']),
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

    // Permission-aware: restricted records are dropped before they can appear
    // in search results, so case/transaction/policy IDs (e.g. FC001, TX001)
    // work as search keywords but never surface content outside this role's
    // access level.
    $role = $_SESSION['user']['role'] ?? 'Staff';
    $queryLower = strtolower($query);
    $searchableSources = ['fraud_cases', 'transactions', 'policies'];

    $docs = array_values(array_filter(loadAllDocs(), function (array $item) use ($role, $queryLower, $searchableSources) {
        if (!in_array($item['source'], $searchableSources, true)) {
            return false;
        }
        if (!canAccessDocument($item, $role)) {
            return false;
        }
        $haystack = strtolower(($item['id'] ?? '') . ' ' . ($item['text'] ?? ''));
        return str_contains($haystack, $queryLower);
    }));

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
