<?php
require_once __DIR__ . '/db.php';

// Backed by Data/app.db (SQLite) rather than the old Data/*.json files.
// Each row is normalized to the {id, text, source, access_level, ...} shape
// the rest of this file (scoreDoc, retrieveRelevant) already expects.
function loadAllDocs() {
    $db = getDB();
    $docs = [];

    $cases = $db->query("SELECT case_id AS id, raw_details AS text, original_message, status, access_level, fraud_type, risk_level FROM cases")->fetchAll();
    foreach ($cases as $row) {
        $row['source'] = 'fraud_cases';
        $docs[] = $row;
    }

    $policies = $db->query("SELECT id, text, access_level FROM policies")->fetchAll();
    foreach ($policies as $row) {
        $row['source'] = 'policies';
        $docs[] = $row;
    }

    $transactions = $db->query("SELECT id, text, access_level, risk_level FROM transactions")->fetchAll();
    foreach ($transactions as $row) {
        $row['source'] = 'transactions';
        $docs[] = $row;
    }

    $companyDocs = $db->query("SELECT id, text, source_file, access_level FROM company_documents")->fetchAll();
    foreach ($companyDocs as $row) {
        $row['source'] = 'company_documents';
        $docs[] = $row;
    }

    return $docs;
}

function sourceToType(string $source): string
{
    return match ($source) {
        'fraud_cases' => 'Case',
        'transactions' => 'Transaction',
        'policies' => 'Policy',
        default => 'Document',
    };
}

// Records with no access_level are visible to every authenticated role.
// Records tagged access_level are only visible to that exact role (case-insensitive).
function canAccessDocument(array $doc, string $role): bool
{
    $required = $doc['access_level'] ?? null;
    if ($required === null) {
        return true;
    }
    return strcasecmp($required, $role) === 0;
}

function scoreDoc(array $doc, string $query, array $queryWords): int
{
    $id = strtolower($doc['id']);
    $text = strtolower($doc['text']);
    $queryLower = strtolower($query);
    $score = 0;

    if ($id === $queryLower) {
        $score += 100;
    } elseif (str_contains($id, $queryLower)) {
        $score += 20;
    }

    foreach ($queryWords as $word) {
        if ($word === '') {
            continue;
        }

        if (str_contains($id, $word)) {
            $score += 5;
        }

        if (strlen($word) > 2 && str_contains($text, $word)) {
            $score += 1;
        }
    }

    return $score;
}

// $role gates which records are eligible before they are ever scored or handed to the
// AI as context — this is the permission-aware retrieval step. Pass null to skip the
// gate entirely (used by callers that don't operate on behalf of a specific role).
function retrieveRelevant($query, $topN = 3, $role = null) {
    $docs = loadAllDocs();
    $query = trim($query);
    // Strip surrounding punctuation ("FC004?", "FC004," etc.) so word-level
    // matching against record IDs and text isn't broken by sentence punctuation.
    $queryWords = array_filter(array_map(
        fn($w) => trim(strtolower($w), ".,!?;:'\"()[]{}"),
        preg_split('/\s+/', $query)
    ), fn($w) => $w !== '');
    $meaningfulWords = array_filter($queryWords, fn($w) => strlen($w) > 2);
    $wordCount = max(count($meaningfulWords), 1);

    $scored = [];
    $restrictedCount = 0;
    foreach ($docs as $doc) {
        $score = scoreDoc($doc, $query, $queryWords);
        if ($score === 0) {
            continue;
        }

        if ($role !== null && !canAccessDocument($doc, $role)) {
            // Relevant, but outside this role's access level: dropped here so it
            // never reaches the context passed to the AI.
            $restrictedCount++;
            continue;
        }

        // Confidence = how much of the query's meaningful words this doc actually matched,
        // capped at 97% so the bot never claims full certainty.
        $doc['confidence'] = (int) min(97, round(($score / $wordCount) * 100));
        $scored[] = ['doc' => $doc, 'score' => $score];
    }

    usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);

    return [
        'docs' => array_slice(array_column($scored, 'doc'), 0, $topN),
        'restricted_count' => $restrictedCount,
    ];
}
