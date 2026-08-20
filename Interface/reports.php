<?php
$activeView = 'reports';
$pageTitle = 'Analysis & Report';
$pageSubtitle = 'Staff workload, case patterns, and next actions';
$pageScripts = ['pages/reports.js'];
include __DIR__ . '/partials/chrome_head.php';
?>
					<section class="view-panel active" id="view-reports">
						<div class="report-toolbar">
							<p class="report-toolbar-note" id="reportGeneratedAt"></p>
							<button class="btn-outline" id="exportReportBtn">
								Export Report
							</button>
						</div>
						<div class="stats-grid" id="reportKpis"></div>
						<div class="report-grid">
							<div class="report-card">
								<h3>Case Status</h3>
								<div class="bar-chart" id="caseStatusChart"></div>
							</div>
							<div class="report-card">
								<h3>Severity Mix</h3>
								<div class="bar-chart" id="severityChart"></div>
							</div>
							<div class="report-card">
								<h3>Case Types</h3>
								<div class="bar-chart" id="caseTypeChart"></div>
							</div>
							<div class="report-card">
								<h3>Policy Categories</h3>
								<div class="bar-chart" id="policyChart"></div>
							</div>
						</div>
						<div class="report-split">
							<div class="content-card">
								<div class="card-header">
									<h2>Priority Queue</h2>
									<span class="card-header-note">Open cases, highest severity first</span>
								</div>
								<div class="card-body" style="padding: 0">
									<div class="table-wrapper">
										<table class="data-table">
											<thead>
												<tr>
													<th>Case</th>
													<th>Type</th>
													<th>Severity</th>
													<th>Policies</th>
												</tr>
											</thead>
											<tbody id="reportPriorityTable"></tbody>
										</table>
									</div>
								</div>
							</div>
							<div class="content-card">
								<div class="card-header">
									<h2>Staff Findings</h2>
								</div>
								<div class="card-body">
									<div id="reportFindings"></div>
								</div>
							</div>
						</div>
						<div class="content-card" style="margin-top: 1.25rem">
							<div class="card-header">
								<h2>Recommended Actions</h2>
							</div>
							<div class="card-body">
								<ol class="report-actions" id="reportActions"></ol>
							</div>
						</div>
						<div class="content-card" style="margin-top: 1.25rem">
							<div class="card-header">
								<h2>Investigation Summary</h2>
							</div>
							<div class="card-body">
								<div class="report-summary" id="reportSummary"></div>
							</div>
						</div>
					</section>
<?php include __DIR__ . '/partials/chrome_foot.php'; ?>
