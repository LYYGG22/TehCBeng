<?php
session_start();

header('Content-Type: application/json');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'POST is required.']);
    exit;
}

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Authentication required.']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true) ?: [];
$caseId = trim((string) ($payload['case_id'] ?? ''));
$action = $payload['action'] ?? '';

$cases = json_decode(file_get_contents(__DIR__ . '/../Data/fraud_cases.json'), true) ?: [];
$case = null;
foreach ($cases as $record) {
    if (($record['id'] ?? '') === $caseId) {
        $case = $record;
        break;
    }
}

if (!$case) {
    http_response_code(404);
    echo json_encode(['error' => 'Case not found.']);
    exit;
}

$requiredRole = $case['access_level'] ?? null;
$userRole = $_SESSION['user']['role'] ?? '';
if ($requiredRole !== null && strcasecmp((string) $requiredRole, (string) $userRole) !== 0) {
    http_response_code(403);
    echo json_encode(['error' => 'You do not have access to act on this case.']);
    exit;
}

$_SESSION['case_updates'] ??= [];
if ($action === 'resolve') {
    $_SESSION['case_updates'][$caseId] = array_merge($_SESSION['case_updates'][$caseId] ?? [], [
        'status' => 'Resolved',
        'assigned_department' => null,
    ]);
    echo json_encode(['success' => true, 'status' => 'Resolved', 'message' => "Case {$caseId} has been marked as resolved."]);
    exit;
}

if ($action === 'forward') {
    $departments = [
        'Account Takeover' => 'Account Security', 'SIM Swap' => 'Account Security',
        'Phishing' => 'Account Security', 'Social Engineering' => 'Account Security',
        'Identity Theft' => 'Identity Verification', 'Card Testing' => 'Card Operations',
        'Geo-Velocity Anomaly' => 'Card Operations', 'Merchant Refund Abuse' => 'Merchant Risk',
        'Duplicate Charge' => 'Payments & Billing', 'Friendly Fraud' => 'Chargebacks',
        'Money Mule' => 'Financial Crime Investigations', 'Unauthorized Transfer' => 'Payments Investigations',
    ];
    $department = $departments[$case['type'] ?? ''] ?? 'Fraud Operations';
    $_SESSION['case_updates'][$caseId] = array_merge($_SESSION['case_updates'][$caseId] ?? [], [
        'status' => 'Open',
        'assigned_department' => $department,
    ]);
    echo json_encode(['success' => true, 'status' => 'Open', 'department' => $department, 'message' => "Case {$caseId} has been sent to {$department}."]);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Invalid case action.']);
