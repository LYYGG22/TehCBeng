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
							<div class="report-export-controls">
								<label class="sr-only" for="reportExportFormat">Export format</label>
								<select id="reportExportFormat" aria-label="Export report format">
									<option value="pdf">PDF</option>
									<option value="excel">Excel (.xls)</option>
								</select>
								<button class="btn-outline" id="exportReportBtn">Export Report</button>
							</div>
						</div>
						<div class="stats-grid" id="reportKpis"></div>
						<?php if ($currentRole === 'Manager'): ?>
							<section class="manager-report-brief" id="managerReportBrief">
								<div class="manager-report-brief-header">
									<div>
										<p class="manager-report-eyebrow">Management briefing</p>
										<h2>Risk &amp; workload overview</h2>
									</div>
									<p id="managerBriefNote"></p>
								</div>
								<div class="manager-brief-metrics" id="managerBriefMetrics"></div>
								<div class="manager-risk-register">
										<div class="manager-risk-register-header">
											<h3>Open high-severity cases</h3>
											<span id="managerRiskNote"></span>
										</div>
									<div class="table-wrapper">
										<table class="data-table">
											<thead><tr><th>Case</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
											<tbody id="managerRiskRegister"></tbody>
										</table>
									</div>
								</div>
							</section>
						<?php endif; ?>
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
									<span class="card-header-note" id="reportPriorityNote">Open cases, highest severity first</span>
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
									<h2><?= $currentRole === 'Manager' ? 'Management Findings' : 'Staff Findings' ?></h2>
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
