<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require 'db.php';
require 'response.php';

$db = getDB();

$recent = $db->query("
    SELECT case_id, title, status, risk_level, date_reported AS date
    FROM cases
    ORDER BY date_reported DESC
    LIMIT 5
")->fetchAll();

$total = $db->query("SELECT COUNT(*) AS c FROM cases")->fetch()['c'];
$open = $db->query("SELECT COUNT(*) AS c FROM cases WHERE status != 'Resolved'")->fetch()['c'];
$resolved = $db->query("SELECT COUNT(*) AS c FROM cases WHERE status = 'Resolved'")->fetch()['c'];

jsonRaw([
    'recent_cases' => $recent,
    'summary_stats' => [
        'total_cases'    => (int) $total,
        'open_cases'     => (int) $open,
        'resolved_cases' => (int) $resolved,
    ],
]);
