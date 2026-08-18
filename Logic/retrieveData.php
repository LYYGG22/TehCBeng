<?php
function loadAllDocs() {
    $docs = [];
    foreach (['fraud_cases', 'policies', 'transactions'] as $file) {
        $items = json_decode(file_get_contents(__DIR__ . "/../Data/$file.json"), true);
        foreach ($items as $item) {
            $item['source'] = $file;
            $docs[] = $item;
        }
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

function retrieveRelevant($query, $topN = 3) {
    $docs = loadAllDocs();
    $query = trim($query);
    $queryWords = array_map('strtolower', preg_split('/\s+/', $query));

    $scored = [];
    foreach ($docs as $doc) {
        $score = scoreDoc($doc, $query, $queryWords);
        if ($score > 0) {
            $scored[] = ['doc' => $doc, 'score' => $score];
        }
    }

    usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);
    return array_slice(array_column($scored, 'doc'), 0, $topN);
}