<?php
$activeView = 'cases';
$pageTitle = 'Case Detail';
$pageSubtitle = 'Detailed investigation and analysis';
$pageScripts = ['pages/case-detail.js'];

$backTargets = [
	'dashboard' => ['dashboard.php', '← Back to Dashboard'],
	'knowledge' => ['knowledge.php', '← Back to Knowledge Search'],
	'reports' => ['reports.php', '← Back to Analysis & Report'],
	'cases' => ['cases.php', '← Back to Cases'],
];
$from = $_GET['from'] ?? 'cases';
[$backHref, $backLabel] = $backTargets[$from] ?? $backTargets['cases'];

include __DIR__ . '/partials/chrome_head.php';
?>
					<section class="view-panel active" id="view-caseDetail">
						<div class="case-detail-container">
							<div class="case-detail-header">
								<a class="btn-back" href="<?= htmlspecialchars($backHref) ?>"><?= htmlspecialchars($backLabel) ?></a>
								<div class="case-detail-title">
									<h1 id="caseDetailId"></h1>
									<span class="badge" id="caseDetailStatus"></span>
								</div>
							</div>

							<div class="case-detail-content">
								<!-- Customer Message Section -->
								<div class="detail-section">
									<h2>Customer's Original Message</h2>
									<div class="message-box" id="caseDetailMessage"></div>
								</div>

								<!-- Keywords Section -->
								<div class="detail-section">
									<h2>AI Detected Keywords</h2>
									<div class="keywords-container" id="caseDetailKeywords"></div>
								</div>

								<?php if ($currentRole === 'Manager'): ?>
									<section class="detail-section manager-case-insights" id="managerCaseInsights">
										<div class="manager-case-insights-header">
											<h2>Account &amp; Transaction Review</h2>
										</div>
										<div class="manager-case-insights-grid">
											<div>
												<h3>Customer Account Details</h3>
												<div class="suggestions-box" id="managerCustomerAccount"></div>
											</div>
											<div id="managerAbnormalTransactionPanel" hidden>
												<h3>Abnormal Transaction Details</h3>
												<div class="suggestions-box" id="managerAbnormalTransaction"></div>
											</div>
										</div>
									</section>
								<?php endif; ?>

								<!-- Suggestions & Conclusions -->
								<div class="detail-section">
									<h2>Suggestions & Conclusions</h2>
									<div class="suggestions-box" id="caseDetailSuggestions"></div>
									<div class="case-action-panel" id="caseDetailActionsSection">
										<h3 id="caseDetailActionsTitle">Case Actions</h3>
										<p class="action-helper" id="caseDetailActionHelper"></p>
										<div class="case-actions">
											<button type="button" class="case-action-button resolve" id="resolveCaseBtn">Mark as resolved</button>
											<button type="button" class="case-action-button forward" id="forwardCaseBtn">Send to recommended department</button>
										</div>
										<p class="case-action-feedback" id="caseDetailActionFeedback" role="status"></p>
									</div>
									<div class="matched-policies" id="caseDetailPolicies"></div>
								</div>
							</div>
						</div>
					</section>
<?php include __DIR__ . '/partials/chrome_foot.php'; ?>
