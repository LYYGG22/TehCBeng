<?php
$activeView = 'processInsights';
$pageTitle = 'Process Insights';
$pageSubtitle = 'Automation candidates and knowledge gaps, from your case history';
$pageScripts = ['pages/process-insights.js'];
include __DIR__ . '/partials/chrome_head.php';

// $currentRole comes from chrome_head.php (already reads the session). This is
// the one page in the app gated by role rather than by what data.php returns —
// the analysis itself only uses data Staff can already see, but the feature is
// Manager-only by design, not by data sensitivity.
if ($currentRole !== 'Manager'):
?>
					<section class="view-panel active">
						<div class="empty-state">Manager access required to view Process Insights.</div>
					</section>
<?php else: ?>
					<section class="view-panel active" id="view-processInsights">
						<p class="report-toolbar-note">Based on case volume and recurring patterns — this app doesn't track per-status handling time, so "slow" isn't measured here, only how often a pattern repeats.</p>
						<div class="stats-grid" id="processInsightsKpis"></div>
						<div class="content-card" style="margin-top: 1.25rem">
							<div class="card-header">
								<h2>Automation Candidates</h2>
								<span class="card-header-note">Fraud types that keep recurring the same way</span>
							</div>
							<div class="card-body" style="padding: 0">
								<div class="table-wrapper">
									<table class="data-table">
										<thead>
											<tr>
												<th>Type</th>
												<th>Occurrences</th>
												<th>Routed to</th>
												<th>Matched policies</th>
												<th>Cases</th>
											</tr>
										</thead>
										<tbody id="automationCandidatesTable"></tbody>
									</table>
								</div>
							</div>
						</div>
						<div class="content-card" style="margin-top: 1.25rem">
							<div class="card-header">
								<h2>Policy Coverage Gaps</h2>
								<span class="card-header-note">Fraud types with thin or missing policy coverage</span>
							</div>
							<div class="card-body" style="padding: 0">
								<div class="table-wrapper">
									<table class="data-table">
										<thead>
											<tr>
												<th>Type</th>
												<th>Cases affected</th>
												<th>Avg. policies matched</th>
												<th>Cases</th>
											</tr>
										</thead>
										<tbody id="knowledgeGapsTable"></tbody>
									</table>
								</div>
							</div>
						</div>
						<div class="content-card" style="margin-top: 1.25rem">
							<div class="card-header">
								<h2>Unanswered Questions</h2>
								<span class="card-header-note" id="chatGapsSummary">Questions the chatbot answered with low confidence — a real-usage signal that fills in over time</span>
							</div>
							<div class="card-body" style="padding: 0">
								<div class="table-wrapper">
									<table class="data-table">
										<thead>
											<tr>
												<th>Asked</th>
												<th>By</th>
												<th>Confidence</th>
											</tr>
										</thead>
										<tbody id="chatGapsTable"></tbody>
									</table>
								</div>
							</div>
						</div>
					</section>
<?php endif; ?>
<?php include __DIR__ . '/partials/chrome_foot.php'; ?>
