<?php
$activeView = 'knowledge';
$pageTitle = 'Knowledge Search';
$pageSubtitle = 'Search cases, transactions, and policies';
$pageScripts = ['pages/knowledge.js'];
include __DIR__ . '/partials/chrome_head.php';
?>
					<section class="view-panel active" id="view-knowledge">
						<div class="search-bar">
							<input
								type="text"
								id="knowledgeSearchInput"
								placeholder="Search cases, transactions, and policies…"
							/>
							<button
								class="btn btn-primary"
								id="knowledgeSearchBtn"
								style="width: auto"
							>
								Search
							</button>
							<button type="button" class="btn-outline" id="knowledgeSearchCancelBtn">
								Cancel
							</button>
						</div>
						<div class="content-card">
							<div class="card-header">
								<h2>Search Results</h2>
							</div>
							<div class="card-body">
								<div id="searchResults">
									<div id="recentKnowledgeRecords"></div>
								</div>
							</div>
						</div>
					</section>
<?php include __DIR__ . '/partials/chrome_foot.php'; ?>
