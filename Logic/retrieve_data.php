<?php
function loadAllDocs() {
    $docs = [];

    foreach (['fraud_cases', 'policies', 'transactions'] as $file) {
        $path = __DIR__ . "/../Data/$file.json";
        if (file_exists($path)) {
            $items = json_decode(file_get_contents($path), true);
            foreach ($items as $item) {
                $item['source'] = $file;
                $docs[] = $item;
            }
        }
    }

    $cacheFile = __DIR__ . '/../Data/documents_cache.json';
    if (file_exists($cacheFile)) {
        $extractedDocs = json_decode(file_get_contents($cacheFile), true);
        foreach ($extractedDocs as $doc) {
            $doc['source'] = 'company_documents';
            $docs[] = $doc;
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
    $meaningfulWords = array_filter($queryWords, fn($w) => strlen($w) > 2);
    $wordCount = max(count($meaningfulWords), 1);

    $scored = [];
    foreach ($docs as $doc) {
        $text = strtolower($doc['text'] ?? '');
        $score = 0;
        foreach ($queryWords as $word) {
            if (strlen($word) > 2 && strpos($text, $word) !== false) {
                $score++;
            }
        }
        if ($score > 0) {
            // Confidence = how much of the query's meaningful words this doc actually matched,
            // capped at 97% so the bot never claims full certainty.
            $doc['confidence'] = (int) min(97, round(($score / $wordCount) * 100));
            $scored[] = ['doc' => $doc, 'score' => $score];
        }
    }

    usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);
    return array_slice(array_column($scored, 'doc'), 0, $topN);
}