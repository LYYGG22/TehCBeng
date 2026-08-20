<?php
$pageTitle = 'Record Detail';
$pageSubtitle = 'Transaction or policy information';
$pageScripts = ['pages/record-detail.js'];

$backTargets = [
	'dashboard' => ['dashboard.php', '← Back to Dashboard'],
	'knowledge' => ['knowledge.php', '← Back to Search Results'],
];
$from = $_GET['from'] ?? 'knowledge';
[$backHref, $backLabel] = $backTargets[$from] ?? $backTargets['knowledge'];
$activeView = $from === 'dashboard' ? 'dashboard' : 'knowledge';

include __DIR__ . '/partials/chrome_head.php';
?>
					<section class="view-panel active" id="view-recordDetail">
						<div class="case-detail-container">
							<div class="case-detail-header">
								<a class="btn-back" href="<?= htmlspecialchars($backHref) ?>"><?= htmlspecialchars($backLabel) ?></a>
								<div class="case-detail-title">
									<h1 id="recordDetailId"></h1>
									<span class="badge" id="recordDetailBadge"></span>
								</div>
								<button type="button" class="btn-outline transaction-detail-flag-btn" id="recordDetailFlagBtn" hidden>
									<span>Flag Transaction</span>
								</button>
							</div>

							<div class="case-detail-content">
								<div class="detail-section">
									<h2 id="recordDetailDescriptionTitle">Details</h2>
									<div class="message-box" id="recordDetailDescription"></div>
								</div>
								<div class="detail-section">
									<h2>Record Information</h2>
									<div class="suggestions-box" id="recordDetailInformation"></div>
								</div>
							</div>
						</div>
					</section>
<?php include __DIR__ . '/partials/chrome_foot.php'; ?>
