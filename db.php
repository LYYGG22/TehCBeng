<?php
/**
 * Shared PDO connection to a local SQLite file.
 * Creates schema and seeds demo data matching the fraud case management spec.
 */

function getDB() {
    static $db;
    if ($db) return $db;

    $dbPath = __DIR__ . '/../data/app.db';
    $needsInit = !file_exists($dbPath);

    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    if ($needsInit) {
        initSchema($db);
        seedData($db);
    }

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
            confidence_score INTEGER NOT NULL
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
    ");
}

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

    $case = $db->prepare("INSERT INTO cases (case_id, title, status, risk_level, fraud_type, date_reported, date_resolved, raw_details, fraud_trend, suggestion, confidence_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    $atTrend = 'This matches a common account-takeover pattern where a new payee is added shortly before a large transfer, often indicating the account has been compromised.';
    $atSuggestion = 'Recommend enforcing a mandatory cooling-off period between adding a new payee and allowing transfers above $1,000. Also consider flagging device fingerprint mismatches automatically.';

    $ctTrend = 'This matches a card-testing pattern where an attacker runs several small authorizations in quick succession to validate stolen card numbers before a larger purchase.';
    $ctSuggestion = 'Recommend auto-blocking cards after repeated small authorizations within a short window and requiring step-up verification before the next transaction.';

    $gvTrend = 'This matches a geo-velocity anomaly where transactions occur in locations too far apart to be explained by normal travel, suggesting credential compromise or card cloning.';
    $gvSuggestion = 'Recommend real-time geo-velocity checks at authorization time and automatic step-up verification when implausible travel distance is detected.';

    $cases = [
        ['FC001', 'Unauthorized transfer to new payee', 'Resolved', 'High', 'Account takeover', '2026-08-14', '2026-08-15', 'Customer reported unauthorized $2,500 transfer to new payee added same day. Resolution: Reversed, account locked.', $atTrend, $atSuggestion, 87],
        ['FC002', 'Card testing pattern detected', 'Resolved', 'Medium', 'Card testing', '2026-08-13', '2026-08-14', 'Multiple small transactions under $50 within 10 minutes to different merchants, flagged as card testing pattern. Resolution: Card frozen pending verification.', $ctTrend, $ctSuggestion, 82],
        ['FC003', 'Rapid merchant refund abuse pattern', 'Resolved', 'High', 'Merchant refund abuse', '2026-08-05', '2026-08-08', 'Three refunds were issued to the same customer profile within 20 minutes after a rapid sequence of high-value purchases from a single merchant. Resolution: Merchant account frozen and refunds reversed.', 'This pattern matches refund abuse where a fraudster quickly cycles high-value orders and claims refunds to monetize stolen card data.', 'Recommend placing merchant accounts under additional review after multiple rapid refund requests and flagging repeat refund patterns across the same device fingerprint.', 84],
        ['FC004', 'Duplicate payment review', 'Open', 'Medium', 'Payment dispute', '2026-08-17', null, 'Customer reported a $1,850 duplicate charge after a failed top-up request. Open review remains pending before funds are released.', 'This pattern indicates a possible duplicate authorization or failed payment retry that should be reviewed before releasing funds.', 'Recommend cross-checking pending top-ups against prior charges and holding disputed amounts until reconciliation is completed.', 68],
        ['FC005', 'High-value payout attempt from new browser session', 'Open', 'High', 'Account takeover', '2026-08-18', null, 'New browser session, unknown device fingerprint, and a pending payout request of $6,900 were flagged before authorization. Case remains open for verification.', $atTrend, $atSuggestion, 86],
        ['FC006', 'Repeated billing error resolved', 'Resolved', 'Medium', 'Billing dispute', '2026-07-22', '2026-07-25', 'Customer reported a $1,400 transfer mismatch after repeated billing errors. Resolution: Funds restored and account review completed.', 'This resembles a billing or settlement issue rather than a compromise, but repeated discrepancies may deserve monitoring.', 'Review failed billing retries and confirm settlement logs before releasing funds on repeated errors.', 71],
    ];
    foreach ($cases as $c) $case->execute($c);

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
