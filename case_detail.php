<?php
header('Content-Type: text/html; charset=UTF-8');

$caseId = $_GET['case_id'] ?? '';
if ($caseId === '') {
    http_response_code(400);
    echo '<!doctype html><html><body><h1>Missing case_id</h1></body></html>';
    exit;
}

function loadCaseFromJson(string $caseId): ?array
{
    $jsonPath = __DIR__ . '/Data/fraud_cases.json';
    if (!is_file($jsonPath)) {
        return null;
    }

    $cases = json_decode(file_get_contents($jsonPath), true);
    if (!is_array($cases)) {
        return null;
    }

    foreach ($cases as $case) {
        if (($case['id'] ?? '') === $caseId) {
            $summary = $case['text'] ?? '';
            $status = stripos($summary, 'resolution:') !== false || stripos($summary, 'resolved') !== false ? 'Resolved' : 'Open';
            $severity = stripos($summary, '$2,500') !== false || stripos($summary, '$6,900') !== false || stripos($summary, '$1,850') !== false || stripos($summary, '$1,400') !== false || stripos($summary, 'refund') !== false ? 'High' : 'Medium';

            return [
                'case_id' => $caseId,
                'title' => 'Fraud case investigation',
                'status' => $status,
                'risk_level' => $severity,
                'date_reported' => 'N/A',
                'date_resolved' => $status === 'Resolved' ? 'N/A' : null,
                'raw_details' => $summary,
                'fraud_trend' => 'Matches the incident summary recorded in the case file.',
                'suggestion' => 'Continue review of the flagged activity and align with the investigation policy.',
                'confidence_score' => 80,
            ];
        }
    }

    return null;
}

$case = null;
$documentRefs = [];

if (file_exists(__DIR__ . '/db.php')) {
    require __DIR__ . '/db.php';
    try {
        $db = getDB();
        $stmt = $db->prepare("SELECT * FROM cases WHERE case_id = ?");
        $stmt->execute([$caseId]);
        $case = $stmt->fetch();

        if ($case) {
            $docStmt = $db->prepare("
                SELECT d.doc_id AS id, d.title, d.file_url
                FROM case_documents cd
                JOIN documents d ON d.doc_id = cd.doc_id
                WHERE cd.case_id = ?
            ");
            $docStmt->execute([$caseId]);
            $documentRefs = $docStmt->fetchAll();
        }
    } catch (Throwable $e) {
        $case = null;
    }
}

if (!$case) {
    $case = loadCaseFromJson($caseId);
    if (!$case) {
        http_response_code(404);
        echo '<!doctype html><html><body><h1>Case not found</h1></body></html>';
        exit;
    }
}
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><?= htmlspecialchars($case['case_id']) ?> | Case Detail</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            background: #f7f8fb;
            color: #1f2937;
        }
        .container {
            max-width: 980px;
            margin: 40px auto;
            padding: 24px;
        }
        .card {
            background: white;
            border-radius: 14px;
            padding: 24px;
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
        }
        .topbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .badge {
            display: inline-block;
            padding: 6px 10px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: bold;
            background: #ecfdf5;
            color: #166534;
        }
        .badge-high { background: #fee2e2; color: #991b1b; }
        .badge-medium { background: #fef3c7; color: #92400e; }
        .badge-low { background: #dbeafe; color: #1d4ed8; }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin: 20px 0;
        }
        .meta {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 14px;
        }
        .meta-label {
            color: #64748b;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin-bottom: 8px;
        }
        h1 { margin: 0; }
        h2 { font-size: 1.1rem; margin-top: 0; }
        .section { margin-top: 26px; }
        .back-link {
            display: inline-block;
            margin-bottom: 20px;
            color: #2563eb;
            text-decoration: none;
            font-weight: 600;
        }
        ul { margin: 0; padding-left: 20px; }
        li { margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <a class="back-link" href="./Interface/dashboard.html#cases">← Back to All Cases</a>

        <div class="card">
            <div class="topbar">
                <div>
                    <div class="meta-label">Case ID</div>
                    <h1><?= htmlspecialchars($case['case_id']) ?></h1>
                </div>
                <span class="badge <?= strtolower((string) $case['status']) === 'resolved' ? 'badge' : 'badge' ?>"><?= htmlspecialchars($case['status']) ?></span>
            </div>

            <div class="grid">
                <div class="meta">
                    <div class="meta-label">Title</div>
                    <strong><?= htmlspecialchars($case['title']) ?></strong>
                </div>
                <div class="meta">
                    <div class="meta-label">Risk Level</div>
                    <span class="badge <?= strtolower((string) $case['risk_level']) === 'high' ? 'badge-high' : (strtolower((string) $case['risk_level']) === 'medium' ? 'badge-medium' : 'badge-low') ?>"><?= htmlspecialchars($case['risk_level']) ?></span>
                </div>
                <div class="meta">
                    <div class="meta-label">Date Reported</div>
                    <strong><?= htmlspecialchars($case['date_reported'] ?? 'N/A') ?></strong>
                </div>
                <div class="meta">
                    <div class="meta-label">Date Resolved</div>
                    <strong><?= htmlspecialchars($case['date_resolved'] ?? '—') ?></strong>
                </div>
            </div>

            <div class="section">
                <h2>Raw Details</h2>
                <p><?= nl2br(htmlspecialchars($case['raw_details'])) ?></p>
            </div>

            <div class="section">
                <h2>AI Analysis</h2>
                <p><strong>Fraud Trend:</strong> <?= nl2br(htmlspecialchars($case['fraud_trend'])) ?></p>
                <p><strong>Suggested Action:</strong> <?= nl2br(htmlspecialchars($case['suggestion'])) ?></p>
                <p><strong>Confidence Score:</strong> <?= (int) ($case['confidence_score'] ?? 0) ?>%</p>
            </div>

            <div class="section">
                <h2>Document References</h2>
                <?php if (count($documentRefs) > 0): ?>
                    <ul>
                        <?php foreach ($documentRefs as $doc): ?>
                            <li>
                                <a href="<?= htmlspecialchars($doc['file_url']) ?>" target="_blank" rel="noreferrer">
                                    <?= htmlspecialchars($doc['title']) ?>
                                </a>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                <?php elseif (!empty($documentRefs)): ?>
                    <p>No documents linked to this case.</p>
                <?php else: ?>
                    <p>No documents linked to this case.</p>
                <?php endif; ?>
            </div>
        </div>
    </div>
</body>
</html>
