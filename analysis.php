<?php
require 'db.php';
require 'response.php';

$db = getDB();

$total = (int) $db->query("SELECT COUNT(*) AS c FROM cases")->fetch()['c'];

$trends = $db->query("
    SELECT fraud_type, COUNT(*) AS count
    FROM cases
    GROUP BY fraud_type
    ORDER BY count DESC
")->fetchAll();

$topFraudType = $trends[0]['fraud_type'] ?? null;

$avgResolution = $db->query("
    SELECT AVG(julianday(date_resolved) - julianday(date_reported)) AS avg_days
    FROM cases
    WHERE date_resolved IS NOT NULL
")->fetch()['avg_days'];

$secondFraudType = $trends[1]['fraud_type'] ?? null;

jsonRaw([
    'overview' => [
        'total_cases'              => $total,
        'most_common_fraud_type'   => $topFraudType,
        'avg_resolution_time_days' => $avgResolution !== null ? round((float) $avgResolution, 1) : null,
    ],
    'trends' => array_map(fn($t) => [
        'fraud_type' => $t['fraud_type'],
        'count'      => (int) $t['count'],
    ], $trends),
    'ai_summary' => [
        'key_findings' => "{$topFraudType} cases account for the largest share of this period's activity" .
            ($secondFraudType ? ", followed by {$secondFraudType}." : '.') .
            ' Account takeover cases are primarily linked to new-payee additions followed by large transfers.',
        'process_optimization_suggestions' => 'Consider automating a mandatory hold period for new payees combined with large transactions, and enforcing automatic step-up verification on device fingerprint mismatches and geo-velocity anomalies to reduce these fraud types.',
    ],
]);
