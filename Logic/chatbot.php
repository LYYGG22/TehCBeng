<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

session_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:8000');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: POST, OPTIONS');
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

$data = json_decode(file_get_contents('php://input'), true);
$userQuery = $data['query'] ?? '';

$relevantDocs = retrieveRelevant($userQuery, 3);

if (empty($relevantDocs)) {
    echo json_encode([
        'answer' => "I couldn't find any relevant cases, policies, or transactions matching your question.",
        'sources_used' => []
    ]);
    exit;
}

$context = "";
foreach ($relevantDocs as $doc) {
    $context .= "- [{$doc['id']}] {$doc['text']}\n";
}

$apiKey = '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';

$prompt = "You are IntelliHub, a fraud investigation assistant. Use the following retrieved context to answer the user's question. Reference specific case/policy/transaction IDs where relevant.\n\nContext:\n$context\n\nUser question: $userQuery\n\nAnswer concisely.";

$ch = curl_init('https://openrouter.ai/api/v1/chat/completions');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $apiKey,
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'model' => 'google/gemma-4-26b-a4b-it:free',
    'messages' => [
        ['role' => 'user', 'content' => $prompt]
    ]
]));

$response = curl_exec($ch);

if (curl_errno($ch)) {
    echo json_encode(['answer' => 'cURL Error: ' . curl_error($ch), 'sources_used' => []]);
    curl_close($ch);
    exit;
}

curl_close($ch);

$result = json_decode($response, true);
$answer = $result['choices'][0]['message']['content'] ?? 'Error retrieving answer.';

echo json_encode([
    'answer' => $answer,
    'sources_used' => array_map(fn($d) => $d['id'], $relevantDocs)
]);