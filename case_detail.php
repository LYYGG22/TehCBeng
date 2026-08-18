<?php
require 'db.php';
require 'response.php';

$caseId = $_GET['case_id'] ?? '';
if ($caseId === '') jsonError('case_id is required');

$db = getDB();

$stmt = $db->prepare("SELECT * FROM cases WHERE case_id = ?");
$stmt->execute([$caseId]);
$case = $stmt->fetch();

if (!$case) jsonError('Case not found', 404);

$docStmt = $db->prepare("
    SELECT d.doc_id AS id, d.title, d.file_url
    FROM case_documents cd
    JOIN documents d ON d.doc_id = cd.doc_id
    WHERE cd.case_id = ?
");
$docStmt->execute([$caseId]);
$documentRefs = $docStmt->fetchAll();

jsonRaw([
    'case_id'       => $case['case_id'],
    'title'         => $case['title'],
    'status'        => $case['status'],
    'risk_level'    => $case['risk_level'],
    'date_reported' => $case['date_reported'],
    'raw_details'   => $case['raw_details'],
    'ai_analysis'   => [
        'fraud_trend'         => $case['fraud_trend'],
        'suggestion'          => $case['suggestion'],
        'confidence_score'    => (int) $case['confidence_score'],
        'document_references' => $documentRefs,
    ],
]);
