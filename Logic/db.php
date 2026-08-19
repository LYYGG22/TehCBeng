<?php
/**
 * Shared PDO connection to a local SQLite file.
 * Creates schema and seeds demo data matching the fraud case management spec.
 */

function getDB() {
    static $db;
    if ($db) return $db;

    if (!class_exists('PDO') || !in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        throw new RuntimeException('SQLite PDO driver is not available on this PHP installation.');
    }

    $dbPath = __DIR__ . '/../data/app.db';
    $needsInit = !file_exists($dbPath);

    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    if ($needsInit) {
        initSchema($db);
        seedData($db);
    }

    // Data/*.json stays the file you actually edit. This mirrors it into
    // app.db on every request so the DB-backed queries (chatbot retrieval,
    // dashboard, knowledge search) always reflect the latest JSON contents,
    // without needing to delete app.db or touch SQL by hand.
    syncKnowledgeBaseFromJson($db);

    return $db;
}

function initSchema(PDO $db) {
    $db->exec("
        CREATE TABLE cases (
            case_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            status TEXT NOT NULL,
            risk_level TEXT NOT NULL,
            fraud_type TEXT NOT NULL,
            date_reported TEXT NOT NULL,
            date_resolved TEXT,
            raw_details TEXT NOT NULL,
            fraud_trend TEXT NOT NULL,
            suggestion TEXT NOT NULL,
            confidence_score INTEGER NOT NULL,
            access_level TEXT
        );

        CREATE TABLE documents (
            doc_id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            excerpt TEXT NOT NULL,
            category TEXT NOT NULL,
            file_url TEXT NOT NULL
        );

        CREATE TABLE case_documents (
            case_id TEXT NOT NULL,
            doc_id TEXT NOT NULL,
            PRIMARY KEY (case_id, doc_id)
        );

        -- Knowledge-base tables backing the chatbot's retrieval and the
        -- knowledge-search feature (previously flat files under Data/*.json).
        -- access_level mirrors the 'cases' column: NULL = visible to every
        -- authenticated role, otherwise restricted to that exact role.
        CREATE TABLE policies (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            access_level TEXT
        );

        CREATE TABLE transactions (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            access_level TEXT
        );

        CREATE TABLE company_documents (
            id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            source_file TEXT,
            access_level TEXT
        );
    ");
}

// Seeds the parts of the schema that have no JSON counterpart: policy PDF
// references and their case links, used only by the (currently unwired)
// case-detail page. The knowledge-base tables (cases/policies/transactions/
// company_documents) are populated by syncKnowledgeBaseFromJson() instead,
// every request, from Data/*.json.
function seedData(PDO $db) {
    $doc = $db->prepare("INSERT INTO documents (doc_id, title, excerpt, category, file_url) VALUES (?, ?, ?, ?, ?)");
    $docs = [
        ['POL001', 'OTP Verification Policy', 'Any single transaction exceeding $5,000 requires secondary verification via OTP before processing.', 'Policy', '/Data/documents/POL001.pdf'],
        ['POL002', 'Card Testing Detection Guideline', 'Multiple low-value authorizations against the same card within a short window should be treated as a probable card-testing pattern.', 'Guideline', '/Data/documents/POL002.pdf'],
        ['POL003', 'Device Verification Policy', 'New or unrecognized device fingerprints on an account must trigger step-up authentication before high-value actions are allowed.', 'Policy', '/Data/documents/POL003.pdf'],
        ['POL004', 'New Payee Cooling-Off Guideline', 'Transfers above $1,000 to a payee added within the last 24 hours should be held for manual review.', 'Guideline', '/Data/documents/POL004.pdf'],
        ['POL005', 'Geo-Velocity Anomaly Policy', 'Transactions occurring in two geographically distant locations within an implausible timeframe should be flagged for review.', 'Policy', '/Data/documents/POL005.pdf'],
    ];
    foreach ($docs as $d) $doc->execute($d);

    $link = $db->prepare("INSERT INTO case_documents (case_id, doc_id) VALUES (?, ?)");
    $links = [
        ['FC001', 'POL001'], ['FC001', 'POL003'],
        ['FC002', 'POL002'],
        ['FC003', 'POL004'], ['FC003', 'POL003'],
        ['FC004', 'POL001'],
        ['FC005', 'POL001'], ['FC005', 'POL003'],
        ['FC006', 'POL001'],
    ];
    foreach ($links as $l) $link->execute($l);
}

function loadJsonRecords(string $path): array
{
    if (!is_file($path)) {
        return [];
    }
    $data = json_decode(file_get_contents($path), true);
    return is_array($data) ? $data : [];
}

// True if the case's text implies it was closed out (mirrors the same
// heuristic data.php uses for the dashboard's Open/Resolved split).
function deriveCaseStatus(string $text): string
{
    $resolved = stripos($text, 'reversed') !== false
        || stripos($text, 'frozen') !== false
        || stripos($text, 'blocked') !== false
        || stripos($text, 'secured') !== false
        || stripos($text, 'restored') !== false;

    return $resolved ? 'Resolved' : 'Open';
}

function syncKnowledgeBaseFromJson(PDO $db)
{
    $dataDir = __DIR__ . '/../Data';

    $db->exec('DELETE FROM policies');
    $policyStmt = $db->prepare('INSERT INTO policies (id, text, access_level) VALUES (?, ?, ?)');
    foreach (loadJsonRecords("$dataDir/policies.json") as $p) {
        $policyStmt->execute([$p['id'], $p['text'] ?? '', $p['access_level'] ?? null]);
    }

    $db->exec('DELETE FROM transactions');
    $txStmt = $db->prepare('INSERT INTO transactions (id, text, access_level) VALUES (?, ?, ?)');
    foreach (loadJsonRecords("$dataDir/transactions.json") as $t) {
        $txStmt->execute([$t['id'], $t['text'] ?? '', $t['access_level'] ?? null]);
    }

    $db->exec('DELETE FROM company_documents');
    $docStmt = $db->prepare('INSERT INTO company_documents (id, text, source_file, access_level) VALUES (?, ?, ?, ?)');
    foreach (loadJsonRecords("$dataDir/documents_cache.json") as $d) {
        $docStmt->execute([$d['id'], $d['text'] ?? '', $d['source_file'] ?? null, $d['access_level'] ?? null]);
    }

    // 'cases' also carries fields (title, risk_level, fraud_type, ...) that
    // fraud_cases.json has no equivalent for; those are only consumed by the
    // unwired case-detail page, so JSON-sourced cases get generic values for
    // them here rather than losing the sync altogether.
    $db->exec('DELETE FROM cases');
    $caseStmt = $db->prepare("
        INSERT INTO cases (case_id, title, status, risk_level, fraud_type, date_reported, raw_details, fraud_trend, suggestion, confidence_score, access_level)
        VALUES (?, ?, ?, 'Medium', 'Fraud Investigation', '', ?, 'No curated analysis on file for this case.', 'Follow standard fraud investigation procedure.', 75, ?)
    ");
    foreach (loadJsonRecords("$dataDir/fraud_cases.json") as $c) {
        $text = $c['text'] ?? '';
        $caseStmt->execute([$c['id'], "Case {$c['id']}", deriveCaseStatus($text), $text, $c['access_level'] ?? null]);
    }
}
