<?php
$activeView = 'cases';
$pageTitle = 'All Cases';
$pageSubtitle = 'Browse and filter fraud investigation cases';
$pageScripts = ['pages/cases.js'];
include __DIR__ . '/partials/chrome_head.php';
?>
					<section class="view-panel active" id="view-cases">
						<div class="filter-bar" id="caseFilters">
							<button class="filter-btn active" data-filter="all">All</button>
							<button class="filter-btn" data-filter="Open">Open</button>
							<button class="filter-btn" data-filter="Resolved">
								Resolved
							</button>
							<button class="filter-btn" data-filter="High">
								High Severity
							</button>
							<button class="filter-btn" data-filter="Medium">
								Medium Severity
							</button>
							<button class="filter-btn" data-filter="Low">
								Low Severity
							</button>
						</div>
						<div class="content-card">
							<div class="card-header">
								<h2>Fraud Cases</h2>
								<span
									id="caseCount"
									style="font-size: 0.8125rem; color: var(--ih-muted)"
								></span>
							</div>
							<div class="card-body" style="padding: 0">
								<div class="table-wrapper">
									<table class="data-table">
										<thead>
											<tr>
												<th>Case ID</th>
												<th>Type</th>
												<th>Status</th>
												<th>Severity</th>
												<th>Summary</th>
											</tr>
										</thead>
										<tbody id="casesTable"></tbody>
									</table>
								</div>
							</div>
						</div>
					</section>
<?php include __DIR__ . '/partials/chrome_foot.php'; ?>
