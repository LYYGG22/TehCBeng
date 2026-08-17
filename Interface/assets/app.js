const API_BASE = "../Logic";

const VIEWS = {
	dashboard: {
		title: "Dashboard",
		subtitle: "Overview of fraud investigation activity",
	},
	knowledge: {
		title: "Knowledge Search",
		subtitle: "Search cases, transactions, and policies",
	},
	cases: {
		title: "All Cases",
		subtitle: "Browse and filter fraud investigation cases",
	},
	reports: {
		title: "Analysis & Report",
		subtitle: "Insights and investigation summaries",
	},
	chatbot: {
		title: "AI Chatbot",
		subtitle: "Intelligent fraud investigation assistant",
	},
};

let appData = null;
let isLoading = false;
let currentCaseFilter = "all";
let chatHistory = [];
let widgetOpen = false;

const CHAT_CONTAINERS = {
	full: { messagesId: "chatbotMessages", welcomeId: "chatbotWelcome", inputId: "chatbotInput", sendId: "chatbotSendBtn" },
	widget: { messagesId: "widgetMessages", welcomeId: "widgetWelcome", inputId: "widgetInput", sendId: "widgetSendBtn" },
};

async function checkAuth() {
	const res = await fetch(`${API_BASE}/auth.php?action=check`, {
		credentials: "include",
	});
	const data = await res.json();
	if (!data.authenticated) {
		window.location.href = "login.html";
		return null;
	}
	return data.user;
}

function initUser(user) {
	const initials = user.name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase();
	document.getElementById("userName").textContent = user.name;
	document.getElementById("userRole").textContent = user.role;
	document.getElementById("userAvatar").textContent = initials;
}

function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

function badgeClass(value, type) {
	const map = {
		status: { Open: "badge-open", Resolved: "badge-resolved" },
		severity: { High: "badge-high", Medium: "badge-medium", Low: "badge-low" },
		risk: { High: "badge-flagged", Low: "badge-clear" },
	};
	return map[type]?.[value] || "";
}

async function loadData() {
	const res = await fetch(`${API_BASE}/data.php?action=all`, {
		credentials: "include",
	});
	if (res.status === 401) {
		window.location.href = "login.html";
		return;
	}
	appData = await res.json();
}

function navigateTo(view) {
	document.querySelectorAll(".nav-item[data-view]").forEach((el) => {
		el.classList.toggle("active", el.dataset.view === view);
	});
	document.querySelectorAll(".view-panel").forEach((el) => {
		el.classList.toggle("active", el.id === `view-${view}`);
	});

	const meta = VIEWS[view];
	document.getElementById("pageTitle").textContent = meta.title;
	document.getElementById("pageSubtitle").textContent = meta.subtitle;

	const fab = document.getElementById("chatFab");
	if (fab) fab.classList.toggle("hidden", view === "chatbot");

	location.hash = view;
}

function setupNavigation() {
	document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
		btn.addEventListener("click", () => navigateTo(btn.dataset.view));
	});

	const hash = location.hash.replace("#", "");
	if (hash && VIEWS[hash]) navigateTo(hash);
}

function renderDashboard() {
	const { stats, cases, transactions, policies } = appData;

	document.getElementById("statsGrid").innerHTML = `
		<div class="stat-card">
			<div class="stat-card-header">
				<span class="stat-label">Total Cases</span>
				<div class="stat-icon blue">📋</div>
			</div>
			<div class="stat-value">${stats.total_cases}</div>
			<div class="stat-change">${stats.open_cases} currently open</div>
		</div>
		<div class="stat-card">
			<div class="stat-card-header">
				<span class="stat-label">Flagged Transactions</span>
				<div class="stat-icon red">⚠️</div>
			</div>
			<div class="stat-value">${stats.flagged_transactions}</div>
			<div class="stat-change">of ${stats.total_transactions} total</div>
		</div>
		<div class="stat-card">
			<div class="stat-card-header">
				<span class="stat-label">Active Policies</span>
				<div class="stat-icon green">📜</div>
			</div>
			<div class="stat-value">${stats.policies}</div>
			<div class="stat-change">compliance rules enforced</div>
		</div>
		<div class="stat-card">
			<div class="stat-card-header">
				<span class="stat-label">Resolved Cases</span>
				<div class="stat-icon amber">✓</div>
			</div>
			<div class="stat-value">${stats.resolved_cases}</div>
			<div class="stat-change">investigations closed</div>
		</div>
	`;

	const activities = [
		...cases.map((c) => ({
			dot: c.severity === "High" ? "red" : "amber",
			text: `Case ${c.id}: ${c.type}`,
			meta: `${c.status} · ${c.severity} severity`,
		})),
		...transactions
			.filter((t) => t.flagged)
			.map((t) => ({
				dot: "red",
				text: `Transaction ${t.id} flagged`,
				meta: `$${t.amount} · High risk`,
			})),
	];

	document.getElementById("activityList").innerHTML = activities
		.map(
			(a) => `
		<div class="activity-item">
			<div class="activity-dot ${a.dot}"></div>
			<div>
				<div class="activity-text">${escapeHtml(a.text)}</div>
				<div class="activity-meta">${escapeHtml(a.meta)}</div>
			</div>
		</div>`
		)
		.join("");

	const flagged = transactions.filter((t) => t.flagged);
	document.getElementById("flaggedTable").innerHTML =
		flagged.length > 0
			? flagged
					.map(
						(t) => `
			<tr>
				<td><strong>${escapeHtml(t.id)}</strong></td>
				<td>$${escapeHtml(t.amount)}</td>
				<td><span class="badge ${badgeClass(t.risk, "risk")}">${t.risk}</span></td>
			</tr>`
					)
					.join("")
			: `<tr><td colspan="3" style="text-align:center;color:var(--ih-muted)">No flagged transactions</td></tr>`;

	document.getElementById("policiesTable").innerHTML = policies
		.map(
			(p) => `
		<tr>
			<td><strong>${escapeHtml(p.id)}</strong></td>
			<td>${escapeHtml(p.category)}</td>
			<td>${escapeHtml(p.summary)}</td>
		</tr>`
		)
		.join("");
}

function renderCases(filter = "all") {
	currentCaseFilter = filter;
	const cases =
		filter === "all"
			? appData.cases
			: appData.cases.filter(
					(c) => c.status === filter || c.severity === filter
				);

	document.getElementById("caseCount").textContent = `${cases.length} case${cases.length !== 1 ? "s" : ""}`;
	document.getElementById("casesTable").innerHTML = cases
		.map(
			(c) => `
		<tr>
			<td><strong>${escapeHtml(c.id)}</strong></td>
			<td>${escapeHtml(c.type)}</td>
			<td><span class="badge ${badgeClass(c.status, "status")}">${c.status}</span></td>
			<td><span class="badge ${badgeClass(c.severity, "severity")}">${c.severity}</span></td>
			<td style="max-width:360px">${escapeHtml(c.summary)}</td>
		</tr>`
		)
		.join("");
}

function setupCaseFilters() {
	document.querySelectorAll("#caseFilters .filter-btn").forEach((btn) => {
		btn.addEventListener("click", () => {
			document
				.querySelectorAll("#caseFilters .filter-btn")
				.forEach((b) => b.classList.remove("active"));
			btn.classList.add("active");
			renderCases(btn.dataset.filter);
		});
	});
}

function renderBarChart(containerId, items) {
	const max = Math.max(...items.map((i) => i.value), 1);
	document.getElementById(containerId).innerHTML = items
		.map(
			(item) => `
		<div class="bar-row">
			<span class="bar-label">${escapeHtml(item.label)}</span>
			<div class="bar-track">
				<div class="bar-fill ${item.color}" style="width:${(item.value / max) * 100}%"></div>
			</div>
			<span class="bar-value">${item.value}</span>
		</div>`
		)
		.join("");
}

function renderReports() {
	const { cases, transactions, policies } = appData;

	const openCount = cases.filter((c) => c.status === "Open").length;
	const resolvedCount = cases.filter((c) => c.status === "Resolved").length;

	renderBarChart("caseStatusChart", [
		{ label: "Open", value: openCount, color: "amber" },
		{ label: "Resolved", value: resolvedCount, color: "green" },
	]);

	const highRisk = transactions.filter((t) => t.risk === "High").length;
	const lowRisk = transactions.filter((t) => t.risk === "Low").length;

	renderBarChart("transactionRiskChart", [
		{ label: "High Risk", value: highRisk, color: "red" },
		{ label: "Low Risk", value: lowRisk, color: "green" },
	]);

	const highSev = cases.filter((c) => c.severity === "High").length;
	const medSev = cases.filter((c) => c.severity === "Medium").length;

	renderBarChart("severityChart", [
		{ label: "High", value: highSev, color: "red" },
		{ label: "Medium", value: medSev, color: "amber" },
	]);

	const categories = {};
	policies.forEach((p) => {
		categories[p.category] = (categories[p.category] || 0) + 1;
	});

	renderBarChart(
		"policyChart",
		Object.entries(categories).map(([label, value]) => ({
			label,
			value,
			color: "blue",
		}))
	);

	const flagged = transactions.filter((t) => t.flagged);
	document.getElementById("reportSummary").innerHTML = `
		<p>This report covers <strong>${cases.length} fraud case${cases.length !== 1 ? "s" : ""}</strong>,
		<strong>${transactions.length} transaction${transactions.length !== 1 ? "s" : ""}</strong>
		(${flagged.length} flagged), and <strong>${policies.length} active polic${policies.length !== 1 ? "ies" : "y"}</strong>.</p>
		<p style="margin-top:0.75rem">Currently <strong>${openCount} case${openCount !== 1 ? "s remain" : " remains"} open</strong>
		for investigation. ${highRisk} transaction${highRisk !== 1 ? "s have" : " has"} been classified as high risk.
		${resolvedCount} case${resolvedCount !== 1 ? "s have" : " has"} been resolved.</p>
		<p style="margin-top:0.75rem">Recommend prioritizing open cases with high severity and reviewing flagged transactions against active velocity and verification policies.</p>
	`;
}

function setupExportReport() {
	document.getElementById("exportReportBtn").addEventListener("click", () => {
		const summary = document.getElementById("reportSummary").innerText;
		const blob = new Blob(
			[`IntelliHub Investigation Report\n${"=".repeat(40)}\n\n${summary}\n\nGenerated: ${new Date().toLocaleString()}`],
			{ type: "text/plain" }
		);
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = "intellihub-report.txt";
		a.click();
		URL.revokeObjectURL(a.href);
	});
}

async function searchKnowledge(query) {
	const container = document.getElementById("searchResults");
	container.innerHTML = `<div class="empty-state">Searching…</div>`;

	const res = await fetch(`${API_BASE}/data.php?action=search`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query }),
	});

	const data = await res.json();

	if (!data.results?.length) {
		container.innerHTML = `<div class="empty-state">No results found for "${escapeHtml(query)}"</div>`;
		return;
	}

	container.innerHTML = data.results
		.map(
			(r) => `
		<div class="result-item">
			<div class="result-id">${escapeHtml(r.id)} · ${escapeHtml(r.source || "document")}</div>
			<div class="result-text">${escapeHtml(r.text)}</div>
		</div>`
		)
		.join("");
}

function setupKnowledgeSearch() {
	const input = document.getElementById("knowledgeSearchInput");
	const search = () => {
		const q = input.value.trim();
		if (q) searchKnowledge(q);
	};
	document.getElementById("knowledgeSearchBtn").addEventListener("click", search);
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") search();
	});
}

function hideWelcome(welcomeId) {
	const el = document.getElementById(welcomeId);
	if (el) el.style.display = "none";
}

function buildMessageHtml(role, text, sources = []) {
	let sourcesHtml = "";
	if (sources.length > 0) {
		sourcesHtml = `<div class="message-sources">${sources
			.map((s) => `<span class="source-tag">${escapeHtml(s)}</span>`)
			.join("")}</div>`;
	}
	return `
		<div class="message-avatar">${role === "user" ? "You" : "IH"}</div>
		<div class="message-content">
			<div class="message-bubble">${escapeHtml(text)}</div>
			${sourcesHtml}
		</div>`;
}

function renderChatContainer(containerKey) {
	const cfg = CHAT_CONTAINERS[containerKey];
	if (!cfg) return;

	const chat = document.getElementById(cfg.messagesId);
	if (!chat) return;

	if (chatHistory.length === 0) {
		const welcome = document.getElementById(cfg.welcomeId);
		if (welcome) welcome.style.display = "";
		chat.querySelectorAll(".message, .typing-indicator-wrap").forEach((el) => el.remove());
		return;
	}

	hideWelcome(cfg.welcomeId);
	chat.querySelectorAll(".message, .typing-indicator-wrap").forEach((el) => el.remove());

	chatHistory.forEach(({ role, text, sources }) => {
		const msg = document.createElement("div");
		msg.className = `message ${role}`;
		msg.innerHTML = buildMessageHtml(role, text, sources);
		chat.appendChild(msg);
	});

	chat.scrollTop = chat.scrollHeight;
}

function renderAllChats() {
	renderChatContainer("full");
	renderChatContainer("widget");
}

function appendMessage(role, text, sources = []) {
	chatHistory.push({ role, text, sources });
	renderAllChats();
}

function showTyping() {
	["full", "widget"].forEach((key) => {
		const cfg = CHAT_CONTAINERS[key];
		const chat = document.getElementById(cfg.messagesId);
		if (!chat) return;

		hideWelcome(cfg.welcomeId);
		if (chat.querySelector(`#typingIndicator-${key}`)) return;

		const msg = document.createElement("div");
		msg.className = "message bot typing-indicator-wrap";
		msg.id = `typingIndicator-${key}`;
		msg.innerHTML = `
			<div class="message-avatar">IH</div>
			<div class="message-content">
				<div class="typing-indicator"><span></span><span></span><span></span></div>
			</div>`;
		chat.appendChild(msg);
		chat.scrollTop = chat.scrollHeight;
	});
}

function hideTyping() {
	document.querySelectorAll(".typing-indicator-wrap").forEach((el) => el.remove());
}

async function sendQuery(inputId, sendBtnId) {
	if (isLoading) return;

	const input = document.getElementById(inputId);
	const query = input.value.trim();
	if (!query) return;

	input.value = "";
	input.style.height = "auto";

	appendMessage("user", query);
	isLoading = true;
	document.getElementById(sendBtnId).disabled = true;
	showTyping();

	try {
		const res = await fetch(`${API_BASE}/chatbot.php`, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query }),
		});
		hideTyping();

		if (res.status === 401) {
			window.location.href = "login.html";
			return;
		}

		const data = await res.json();
		if (data.error) {
			appendMessage("bot", data.error);
			return;
		}
		appendMessage("bot", data.answer, data.sources_used || []);
	} catch {
		hideTyping();
		appendMessage("bot", "Failed to reach the server. Please try again.");
	} finally {
		isLoading = false;
		document.getElementById(sendBtnId).disabled = false;
		input.focus();
	}
}

function setupChatInput(inputId, sendBtnId) {
	const input = document.getElementById(inputId);
	if (!input) return;

	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendQuery(inputId, sendBtnId);
		}
	});

	input.addEventListener("input", () => {
		input.style.height = "auto";
		input.style.height = Math.min(input.scrollHeight, 120) + "px";
	});

	document.getElementById(sendBtnId)?.addEventListener("click", () => {
		sendQuery(inputId, sendBtnId);
	});
}

function setupChatbotView() {
	setupChatInput("chatbotInput", "chatbotSendBtn");

	document.querySelectorAll("#view-chatbot .chip[data-suggest]").forEach((chip) => {
		chip.addEventListener("click", () => {
			document.getElementById("chatbotInput").value = chip.dataset.suggest;
			sendQuery("chatbotInput", "chatbotSendBtn");
		});
	});
}

function setupFloatingWidget() {
	const fab = document.getElementById("chatFab");
	const widget = document.getElementById("chatWidget");

	fab.addEventListener("click", () => {
		widgetOpen = !widgetOpen;
		widget.classList.toggle("hidden", !widgetOpen);
		fab.classList.toggle("hidden", widgetOpen);
	});

	document.getElementById("chatCloseBtn").addEventListener("click", () => {
		widgetOpen = false;
		widget.classList.add("hidden");
		fab.classList.remove("hidden");
	});

	document.getElementById("chatExpandBtn").addEventListener("click", () => {
		widgetOpen = false;
		widget.classList.add("hidden");
		fab.classList.remove("hidden");
		navigateTo("chatbot");
	});

	setupChatInput("widgetInput", "widgetSendBtn");
}

async function logout() {
	await fetch(`${API_BASE}/auth.php?action=logout`, {
		method: "POST",
		credentials: "include",
	});
	window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", async () => {
	const user = await checkAuth();
	if (!user) return;

	initUser(user);
	await loadData();

	renderDashboard();
	renderCases();
	renderReports();

	setupNavigation();
	setupCaseFilters();
	setupKnowledgeSearch();
	setupChatbotView();
	setupFloatingWidget();
	setupExportReport();

	document.getElementById("logoutBtn").addEventListener("click", logout);
});
