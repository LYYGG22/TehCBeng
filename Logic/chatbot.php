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

require_once __DIR__ . '/retrieve_data.php';
require_once __DIR__ . '/env.php';
loadEnv();

$apiKey = getenv('OPENROUTER_API_KEY');
if (!$apiKey) {
    http_response_code(500);
    echo json_encode(['error' => 'OPENROUTER_API_KEY is not set. Copy .env.example to .env and add your key.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$userQuery = $data['query'] ?? '';
$userRole = $_SESSION['user']['role'] ?? 'Staff';

// Permission-aware retrieval: records outside $userRole's access level are filtered
// out inside retrieveRelevant() and never make it into $context below.
$retrieval = retrieveRelevant($userQuery, 3, $userRole);
$relevantDocs = $retrieval['docs'];
$restrictedCount = $retrieval['restricted_count'];

if (empty($relevantDocs)) {
    $context = "No specific matching cases, policies, transactions, or documents were found in the database for this question.";
} else {
    $context = "";
    foreach ($relevantDocs as $doc) {
        $context .= "- [{$doc['id']}] {$doc['text']}\n";
    }
}

$prompt = "You are IntelliHub, a fraud investigation assistant. Use the following retrieved context to answer the user's question. Reference specific case/policy/transaction IDs where relevant.\n\nContext:\n$context\n\nUser question: $userQuery\n\nAnswer concisely. Format the answer in Markdown so it is easy to scan: use short paragraphs, '- ' bullet points for lists of findings or steps, numbered lists for ordered procedures, and **bold** for IDs and key terms. Do not put everything in one long line.";

// Free OpenRouter models sit on shared upstream pools that get rate-limited
// independently of each other and of this app's own usage. Trying a short
// list of different providers means one model being temporarily 429'd
// doesn't surface as a dead end to the user — it just falls through to the
// next one.
$candidateModels = [
    'openai/gpt-oss-20b:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'google/gemma-4-26b-a4b-it:free',
];

$answer = null;
$lastUpstreamMessage = 'Unknown error from the model provider.';

foreach ($candidateModels as $model) {
    $ch = curl_init('https://openrouter.ai/api/v1/chat/completions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'model' => $model,
        'messages' => [
            ['role' => 'user', 'content' => $prompt]
        ]
    ]));

    $response = curl_exec($ch);

    if (curl_errno($ch)) {
        $lastUpstreamMessage = 'cURL Error: ' . curl_error($ch);
        curl_close($ch);
        continue;
    }
    curl_close($ch);

    $result = json_decode($response, true);
    $content = $result['choices'][0]['message']['content'] ?? null;

    if ($content !== null) {
        $answer = $content;
        break;
    }

    $lastUpstreamMessage = $result['error']['metadata']['raw']
        ?? $result['error']['message']
        ?? $lastUpstreamMessage;
}

if ($answer === null) {
    // Surface the actual upstream failure (e.g. every candidate being
    // rate-limited) instead of a generic message, so this is diagnosable
    // from the UI alone.
    $answer = "Unable to get an answer right now: $lastUpstreamMessage";
}

$sourcesUsed = array_map(function ($d) {
    $ref = [
        'id' => $d['id'],
        'title' => $d['source_file'] ?? $d['id'],
        'type' => $d['source'] ?? 'record',
        'confidence' => $d['confidence'] ?? null,
        'last_updated' => $d['last_updated'] ?? null,
    ];
    if (!empty($d['source_file'])) {
        $ref['file_name'] = $d['source_file'];
    }
    return $ref;
}, $relevantDocs);

// Overall answer confidence = the best match among the documents that were
// actually fed to the model. No documents retrieved means no grounding at all.
$docConfidences = array_filter(
    array_map(fn($d) => $d['confidence'] ?? null, $relevantDocs),
    fn($c) => $c !== null
);
$confidence = empty($docConfidences) ? 0 : (int) max($docConfidences);

// Best-effort usage log for Process Insights' "Unanswered Questions" gap
// detection. Never allowed to break the actual chat response.
try {
    $stmt = getDB()->prepare(
        'INSERT INTO chat_log (asked_at, role, query, confidence, restricted_count, source_count) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([date('c'), $userRole, $userQuery, $confidence, $restrictedCount, count($sourcesUsed)]);
} catch (Throwable $e) {
    // Logging is not critical to answering the question.
}

echo json_encode([
    'answer' => $answer,
    'confidence' => $confidence,
    'sources_used' => $sourcesUsed,
    'restricted_count' => $restrictedCount
]);