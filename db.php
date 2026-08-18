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
        // Account takeover (5)
        ['FC001', 'Unauthorized transfer to new payee', 'Open', 'High', 'Account takeover', '2026-08-14', null, 'Customer reported unauthorized $2,500 transfer to new payee added same day. Investigation found device fingerprint mismatch. Resolution: Reversed, account locked.', $atTrend, $atSuggestion, 87],
        ['FC003', 'New payee then same-day large transfer', 'Resolved', 'High', 'Account takeover', '2026-08-05', '2026-08-08', 'Customer account showed a new payee added at 9:02am followed by a $4,100 transfer at 9:14am. Device fingerprint did not match prior sessions. Resolution: Reversed, customer re-verified.', $atTrend, $atSuggestion, 84],
        ['FC004', 'Password reset followed by payee change', 'Resolved', 'High', 'Account takeover', '2026-07-30', '2026-08-02', 'Password reset via email link, followed within minutes by a payee change and transfer attempt of $6,200. Transfer blocked by OTP policy. Resolution: Account secured, no funds lost.', $atTrend, $atSuggestion, 91],
        ['FC005', 'Login from new device then payee add', 'Open', 'Medium', 'Account takeover', '2026-08-13', null, 'Login from a previously unseen device, followed by an attempted payee addition. Session flagged before transfer could be initiated.', $atTrend, $atSuggestion, 76],
        ['FC006', 'Recovery email changed, transfer attempted', 'Resolved', 'High', 'Account takeover', '2026-07-22', '2026-07-25', 'Recovery email changed outside normal hours, followed by a $3,800 transfer attempt to an unfamiliar payee. Resolution: Reversed, recovery email restored.', $atTrend, $atSuggestion, 88],

        // Card testing (4)
        ['FC002', 'Card testing pattern detected', 'Resolved', 'Medium', 'Card testing', '2026-08-13', '2026-08-14', 'Card used for 6 authorizations under $2 within 90 seconds across different merchants. Resolution: Card frozen, customer issued new card.', $ctTrend, $ctSuggestion, 82],
        ['FC007', 'Rapid small authorizations across merchants', 'Resolved', 'Medium', 'Card testing', '2026-07-18', '2026-07-19', '9 authorizations between $0.50 and $1.50 across 7 different online merchants within 3 minutes. Resolution: Card blocked, no chargeback needed.', $ctTrend, $ctSuggestion, 85],
        ['FC008', 'Sequential card number attempts', 'Resolved', 'Low', 'Card testing', '2026-07-10', '2026-07-11', 'Multiple declined authorizations using sequentially incremented card numbers from the same merchant terminal. Resolution: Merchant notified, card range monitored.', $ctTrend, $ctSuggestion, 79],
        ['FC009', 'Small authorizations before large purchase', 'Open', 'Medium', 'Card testing', '2026-08-11', null, 'Two $1 authorizations followed by an attempted $890 purchase 40 seconds later. Large purchase held pending review.', $ctTrend, $ctSuggestion, 74],

        // Geo-velocity anomaly (3)
        ['FC010', 'Impossible travel between transactions', 'Resolved', 'High', 'Geo-velocity anomaly', '2026-07-28', '2026-07-30', 'Card used in Kuala Lumpur at 2:00pm and in London at 2:40pm same day. Resolution: Card blocked, customer confirmed only the KL transaction.', $gvTrend, $gvSuggestion, 90],
        ['FC011', 'Cross-country transactions within minutes', 'Resolved', 'Medium', 'Geo-velocity anomaly', '2026-07-15', '2026-07-16', 'Transactions recorded in Singapore and Jakarta 18 minutes apart. Resolution: Confirmed fraud, funds reversed.', $gvTrend, $gvSuggestion, 81],
        ['FC012', 'Simultaneous authorizations in two countries', 'Open', 'High', 'Geo-velocity anomaly', '2026-08-15', null, 'Two authorizations recorded within 5 minutes of each other in different countries. Under review for possible card cloning.', $gvTrend, $gvSuggestion, 86],
        ['FC013', 'Device mismatch on high-value merchant transfer', 'Resolved', 'High', 'Account takeover', '2026-08-09', '2026-08-10', 'Customer attempted a $9,400 transfer to a newly added merchant after an unrecognized device login. Resolution: Transfer reversed and device trust reset.', $atTrend, $atSuggestion, 89],
        ['FC014', 'Password reset followed by duplicate payout attempt', 'Resolved', 'High', 'Account takeover', '2026-07-12', '2026-07-13', 'Password reset was used to add a new payout recipient and submit a $7,150 request. Resolution: Request cancelled and account re-secured.', $atTrend, $atSuggestion, 92],
        ['FC015', 'Manual review for suspicious cross-border wallet activity', 'Open', 'High', 'Geo-velocity anomaly', '2026-08-17', null, 'Customer used wallet services in two countries within hours and triggered a manual hold on a $5,800 transfer. Pending review for identity verification.', $gvTrend, $gvSuggestion, 84],
        ['FC016', 'High-value payout attempt from new browser session', 'Open', 'High', 'Account takeover', '2026-08-18', null, 'New browser session, unknown IP, and a pending payout request of $6,900 were flagged before authorization. Case remains open for further verification.', $atTrend, $atSuggestion, 86],
    ];
    foreach ($cases as $c) $case->execute($c);

    $link = $db->prepare("INSERT INTO case_documents (case_id, doc_id) VALUES (?, ?)");
    $links = [
        ['FC001', 'POL001'], ['FC001', 'POL003'],
        ['FC003', 'POL004'], ['FC003', 'POL003'],
        ['FC004', 'POL001'], ['FC004', 'POL004'],
        ['FC005', 'POL003'],
        ['FC006', 'POL001'], ['FC006', 'POL004'],
        ['FC002', 'POL002'],
        ['FC007', 'POL002'],
        ['FC008', 'POL002'],
        ['FC009', 'POL002'], ['FC009', 'POL001'],
        ['FC010', 'POL005'],
        ['FC011', 'POL005'],
        ['FC012', 'POL005'], ['FC012', 'POL003'],
        ['FC013', 'POL001'], ['FC013', 'POL003'],
        ['FC014', 'POL001'], ['FC014', 'POL004'],
        ['FC015', 'POL005'], ['FC015', 'POL003'],
        ['FC016', 'POL001'], ['FC016', 'POL003'],
    ];
    foreach ($links as $l) $link->execute($l);
}
