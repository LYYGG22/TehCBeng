<?php
session_start();

header('Access-Control-Allow-Origin: http://localhost:8000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (!isset($_SESSION['user'])) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Authentication required.']);
    exit;
}

require_once __DIR__ . '/retrieve_data.php';

$action = $_GET['action'] ?? 'view';

switch ($action) {
    case 'view':
        header('Content-Type: application/json');
        handleView();
        break;
    case 'file':
        handleFile();
        break;
    default:
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Invalid action']);
}

function handleView(): void
{
    $id = trim($_GET['id'] ?? '');
    if ($id === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Document ID is required.']);
        return;
    }

    $doc = findDocumentById($id);
    if (!$doc) {
        http_response_code(404);
        echo json_encode(['error' => 'Document not found.']);
        return;
    }

    $userRole = $_SESSION['user']['role'] ?? 'Staff';
    if (!canAccessDocument($doc, $userRole)) {
        http_response_code(403);
        echo json_encode(['error' => 'You do not have access to this record.']);
        return;
    }

    $fileName = $doc['source_file'] ?? null;
    $filePath = $fileName ? resolveDocumentPath($fileName) : null;
    $ext = $fileName ? strtolower(pathinfo($fileName, PATHINFO_EXTENSION)) : null;

    $previewType = 'record';
    $fileUrl = null;

    if ($filePath && $ext === 'pdf') {
        $previewType = 'pdf';
        $fileUrl = '../Logic/document.php?action=file&name=' . rawurlencode($fileName);
    } elseif ($fileName) {
        $previewType = 'text';
    }

    echo json_encode([
        'id' => $doc['id'],
        'title' => $fileName ?: $doc['id'],
        'type' => $doc['record_type'],
        'category' => $doc['category'],
        'text' => html_entity_decode($doc['text'], ENT_QUOTES | ENT_HTML5, 'UTF-8'),
        'preview_type' => $previewType,
        'file_url' => $fileUrl,
        'file_name' => $fileName,
        'has_file' => (bool) $filePath,
        'last_updated' => $doc['last_updated'] ?? null,
    ]);
}

function handleFile(): void
{
    $name = basename($_GET['name'] ?? '');
    if ($name === '') {
        http_response_code(400);
        echo 'File name is required.';
        return;
    }

    $path = resolveDocumentPath($name);
    if (!$path) {
        http_response_code(404);
        echo 'File not found.';
        return;
    }

    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    $mimeTypes = [
        'pdf' => 'application/pdf',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    header('Content-Type: ' . ($mimeTypes[$ext] ?? 'application/octet-stream'));
    header('Content-Disposition: inline; filename="' . $name . '"');
    header('Content-Length: ' . filesize($path));
    readfile($path);
    exit;
}

function findDocumentById(string $id): ?array
{
    foreach (loadAllDocs() as $doc) {
        if (($doc['id'] ?? '') === $id) {
            return normalizeDocument($doc);
        }
    }
    return null;
}

function normalizeDocument(array $doc): array
{
    $source = $doc['source'] ?? 'unknown';

    $categoryMap = [
        'fraud_cases' => 'Fraud Case',
        'policies' => 'Policy',
        'transactions' => 'Transaction',
        'company_documents' => 'Company Document',
    ];

    $recordTypeMap = [
        'fraud_cases' => 'case',
        'policies' => 'policy',
        'transactions' => 'transaction',
        'company_documents' => 'document',
    ];

    return [
        'id' => $doc['id'],
        'text' => $doc['text'] ?? '',
        'source_file' => $doc['source_file'] ?? null,
        'category' => $categoryMap[$source] ?? 'Record',
        'record_type' => $recordTypeMap[$source] ?? 'record',
        'last_updated' => $doc['last_updated'] ?? null,
        'access_level' => $doc['access_level'] ?? null,
    ];
}

function resolveDocumentPath(string $fileName): ?string
{
    $safeName = basename($fileName);
    $folders = [
        __DIR__ . '/../Data/documents/',
        __DIR__ . '/../Data/Documents/',
    ];

    foreach ($folders as $folder) {
        $path = $folder . $safeName;
        if (is_file($path)) {
            return $path;
        }
    }

    return null;
}