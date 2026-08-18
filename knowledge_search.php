<?php
require 'db.php';
require 'response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Use POST', 405);

$input = json_decode(file_get_contents('php://input'), true);
$query = trim($input['query'] ?? '');

if ($query === '') jsonError('query is required');

$db = getDB();
$like = '%' . $query . '%';

$stmt = $db->prepare("
    SELECT doc_id, title, excerpt, category
    FROM documents
    WHERE title LIKE ? OR excerpt LIKE ? OR category LIKE ?
    LIMIT 10
");
$stmt->execute([$like, $like, $like]);
$results = $stmt->fetchAll();

// Fallback: if no direct match, do a loose per-word match so demo queries
// like "OTP verification policy" still surface POL001 even with word reordering.
if (empty($results)) {
    $words = preg_split('/\s+/', $query);
    $conditions = [];
    $params = [];
    foreach ($words as $w) {
        if (strlen($w) < 3) continue;
        $conditions[] = "(title LIKE ? OR excerpt LIKE ?)";
        $params[] = "%$w%";
        $params[] = "%$w%";
    }
    if ($conditions) {
        $stmt = $db->prepare("SELECT doc_id, title, excerpt, category FROM documents WHERE " . implode(' OR ', $conditions) . " LIMIT 10");
        $stmt->execute($params);
        $results = $stmt->fetchAll();
    }
}

jsonRaw(['results' => $results]);
