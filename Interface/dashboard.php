<?php
$activeView = 'dashboard';
$pageTitle = 'Dashboard';
$pageSubtitle = 'Overview of fraud investigation activity';
$pageScripts = ['pages/dashboard.js'];
include __DIR__ . '/partials/chrome_head.php';
?>
					<section class="view-panel active" id="view-dashboard">
						<div class="stats-grid" id="statsGrid"></div>
						<div class="content-grid">
							<div class="content-card">
								<div class="card-header">
									<h2>Recent Activity</h2>
								</div>
								<div class="card-body">
									<div class="activity-list" id="activityList"></div>
								</div>
							</div>
							<div class="content-card">
								<div class="card-header">
									<h2>Flagged Transactions</h2>
								</div>
								<div class="card-body">
									<div class="table-wrapper">
										<table class="data-table">
											<thead>
												<tr>
													<th>ID</th>
													<th>Amount</th>
													<th>Risk</th>
												</tr>
											</thead>
											<tbody id="flaggedTable"></tbody>
										</table>
									</div>
								</div>
							</div>
							<div class="content-card full-width">
								<div class="card-header">
									<h2>Active Policies</h2>
								</div>
								<div class="card-body">
									<div class="table-wrapper">
										<table class="data-table">
											<thead>
												<tr>
													<th>Policy ID</th>
													<th>Category</th>
													<th>Used In</th>
													<th>Description</th>
												</tr>
											</thead>
											<tbody id="policiesTable"></tbody>
										</table>
									</div>
								</div>
							</div>
						</div>
					</section>
<?php include __DIR__ . '/partials/chrome_foot.php'; ?>
