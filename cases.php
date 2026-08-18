<?php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require 'db.php';
require 'response.php';

$db = getDB();

$status = $_GET['status'] ?? null;
$risk = $_GET['risk_level'] ?? null;

$sql = "SELECT case_id, title, status, risk_level, date_reported AS date FROM cases WHERE 1=1";
$params = [];

if ($status) { $sql .= " AND status = ?"; $params[] = $status; }
if ($risk)   { $sql .= " AND risk_level = ?"; $params[] = $risk; }

$sql .= " ORDER BY date_reported DESC";

$stmt = $db->prepare($sql);
$stmt->execute($params);

jsonRaw(['cases' => $stmt->fetchAll()]);
