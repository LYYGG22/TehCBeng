<?php
// Included by every page. Expects $activeView, $pageTitle, $pageSubtitle to
// already be set by the including page.
//
// session_start() reads the same PHP session Logic/auth.php already writes to
// (same origin, default cookie path) so the sidebar can decide what to show
// based on role, without a separate API call.
session_start();
$currentRole = $_SESSION['user']['role'] ?? 'Staff';
?>
<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>IntelliHub – <?= htmlspecialchars($pageTitle) ?></title>
		<link rel="stylesheet" href="assets/styles.css?v=<?= filemtime(__DIR__ . '/../assets/styles.css') ?>" />
		<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js"></script>
	</head>
	<body>
		<div class="app-layout">
			<aside class="sidebar">
				<div class="sidebar-brand">
					<span class="sidebar-brand-text">IntelliHub</span>
				</div>

				<nav class="sidebar-nav">
					<a class="nav-item <?= $activeView === 'dashboard' ? 'active' : '' ?>" href="dashboard.php">
						<span class="nav-icon">
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<rect x="3" y="3" width="7" height="7" rx="1" />
								<rect x="14" y="3" width="7" height="7" rx="1" />
								<rect x="3" y="14" width="7" height="7" rx="1" />
								<rect x="14" y="14" width="7" height="7" rx="1" />
							</svg>
						</span>
						<span>Dashboard</span>
					</a>
					<a class="nav-item <?= $activeView === 'knowledge' ? 'active' : '' ?>" href="knowledge.php">
						<span class="nav-icon">
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<circle cx="11" cy="11" r="8" />
								<line x1="21" y1="21" x2="16.65" y2="16.65" />
							</svg>
						</span>
						<span>Knowledge Search</span>
					</a>
					<a class="nav-item <?= $activeView === 'cases' ? 'active' : '' ?>" href="cases.php">
						<span class="nav-icon">
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
								/>
								<polyline points="14 2 14 8 20 8" />
							</svg>
						</span>
						<span>All Cases</span>
					</a>
					<a class="nav-item <?= $activeView === 'reports' ? 'active' : '' ?>" href="reports.php">
						<span class="nav-icon">
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<line x1="18" y1="20" x2="18" y2="10" />
								<line x1="12" y1="20" x2="12" y2="4" />
								<line x1="6" y1="20" x2="6" y2="14" />
							</svg>
						</span>
						<span>Analysis &amp; Report</span>
					</a>
<?php if ($currentRole === 'Manager'): ?>
					<a class="nav-item <?= $activeView === 'processInsights' ? 'active' : '' ?>" href="process-insights.php">
						<span class="nav-icon">
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
							</svg>
						</span>
						<span>Process Insights</span>
					</a>
<?php endif; ?>
					<a class="nav-item <?= $activeView === 'chatbot' ? 'active' : '' ?>" href="chatbot.php">
						<span class="nav-icon">
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
								/>
							</svg>
						</span>
						<span>AI Chatbot</span>
					</a>
				</nav>

				<div class="sidebar-footer">
					<button class="nav-item btn-logout" id="logoutBtn">
						<span class="nav-icon">
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
								<polyline points="16 17 21 12 16 7" />
								<line x1="21" y1="12" x2="9" y2="12" />
							</svg>
						</span>
						<span>Sign out</span>
					</button>
				</div>
			</aside>

			<div class="main-content">
				<header class="topbar">
					<div class="topbar-title">
						<h1 id="pageTitle"><?= htmlspecialchars($pageTitle) ?></h1>
						<p id="pageSubtitle"><?= htmlspecialchars($pageSubtitle) ?></p>
					</div>
					<div class="topbar-user">
						<div class="topbar-user-info">
							<div class="topbar-user-name" id="userName">—</div>
							<div class="topbar-user-role" id="userRole">—</div>
						</div>
						<div class="topbar-avatar" id="userAvatar">—</div>
					</div>
				</header>

				<main class="page-content">
