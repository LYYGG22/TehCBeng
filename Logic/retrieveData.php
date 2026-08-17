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

function retrieveRelevant($query, $topN = 3) {
    $docs = loadAllDocs();
    $queryWords = array_map('strtolower', preg_split('/\s+/', $query));

    $scored = [];
    foreach ($docs as $doc) {
        $text = strtolower($doc['text']);
        $score = 0;
        foreach ($queryWords as $word) {
            if (strlen($word) > 2 && strpos($text, $word) !== false) {
                $score++;
            }
        }
        if ($score > 0) {
            $scored[] = ['doc' => $doc, 'score' => $score];
        }
    }

    usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);
    return array_slice(array_column($scored, 'doc'), 0, $topN);
}