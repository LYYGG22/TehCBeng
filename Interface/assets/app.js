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
	caseDetail: {
		title: "Case Detail",
		subtitle: "Detailed investigation and analysis",
	},
	recordDetail: {
		title: "Record Detail",
		subtitle: "Transaction or policy information",
	},
	reports: {
		title: "Analysis & Report",
		subtitle: "Staff workload, case patterns, and next actions",
	},
	chatbot: {
		title: "AI Chatbot",
		subtitle: "Intelligent fraud investigation assistant",
	},
};

let appData = null;
let isLoading = false;
let currentCaseFilter = "all";
let currentSelectedCaseId = null;
let chatHistory = [];
let widgetOpen = false;
let knowledgeSearchRequestId = 0;
let caseDetailReturnView = "cases";
let recordDetailReturnView = "knowledge";
let knowledgeSearchResults = [];

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

function extractKeywords(text) {
	const keywords = [
		"unauthorized", "transfer", "payee", "new", "card", "testing", "refund", "merchant",
		"device", "browser", "password", "reset", "transaction", "duplicate", "charge",
		"verification", "otp", "velocity", "geo", "fraud", "flagged", "frozen", "blocked",
		"reversed", "locked", "payout", "deposit", "payment", "high-value", "anomaly",
		"phishing", "social", "engineering", "sim", "swap", "mule", "identity", "chargeback",
		"travel", "country", "wallet", "fingerprint", "impersonat"
	];
	
	const found = [];
	const lowerText = text.toLowerCase();
	
	keywords.forEach(keyword => {
		if (lowerText.includes(keyword) && !found.includes(keyword)) {
			found.push(keyword);
		}
	});
	
	return found;
}

function matchPolicies(keywords, allPolicies) {
	const matched = [];
	
	allPolicies.forEach(policy => {
		const policyText = policy.summary.toLowerCase();
		let score = 0;
		
		keywords.forEach(keyword => {
			if (policyText.includes(keyword)) {
				score++;
			}
		});
		
		if (score > 0) {
			matched.push({
				id: policy.id,
				summary: policy.summary,
				relevance: score
			});
		}
	});
	
	return matched.sort((a, b) => b.relevance - a.relevance).slice(0, 3);
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
			type: "case",
			record: c,
			sortOrder: recordNumber(c.id),
			dot: c.severity === "High" ? "red" : c.severity === "Low" ? "green" : "amber",
			text: `Case ${c.id}: ${c.type}`,
			meta: `${c.status} · ${c.severity} severity`,
		})),
		...transactions
			.filter((t) => t.flagged)
			.map((t) => ({
				type: "transaction",
				record: t,
				sortOrder: recordNumber(t.id),
				dot: "red",
				text: `Transaction ${t.id} flagged`,
				meta: `$${t.amount} · High risk`,
			})),
	].sort((a, b) => b.sortOrder - a.sortOrder).slice(0, 5);

	document.getElementById("activityList").innerHTML = activities
		.map(
			(a) => `
		<button type="button" class="activity-item clickable" data-activity-type="${a.type}" data-record-id="${escapeHtml(a.record.id)}" title="View ${escapeHtml(a.record.id)} details">
			<div class="activity-dot ${a.dot}"></div>
			<div>
				<div class="activity-text">${escapeHtml(a.text)}</div>
				<div class="activity-meta">${escapeHtml(a.meta)}</div>
			</div>
		</button>`
		)
		.join("") || `<div class="empty-state">No recent activity in your access scope.</div>`;

	document.querySelectorAll("#activityList [data-activity-type]").forEach((item) => {
		item.addEventListener("click", () => {
			const id = item.dataset.recordId;
			if (item.dataset.activityType === "case") {
				openCaseDetail(id, "dashboard");
			} else {
				const transaction = transactions.find((t) => t.id === id);
				if (transaction) openRecordDetail({ ...transaction, type: "Transaction" }, "dashboard");
			}
		});
	});

	const flagged = transactions.filter((t) => t.flagged);
	document.getElementById("flaggedTable").innerHTML =
		flagged.length > 0
			? flagged
					.map(
						(t) => `
			<tr class="clickable" data-transaction-id="${escapeHtml(t.id)}" title="View ${escapeHtml(t.id)} details">
				<td><strong>${escapeHtml(t.id)}</strong></td>
				<td>$${escapeHtml(t.amount)}</td>
				<td><span class="badge ${badgeClass(t.risk, "risk")}">${t.risk}</span></td>
			</tr>`
					)
					.join("")
			: `<tr><td colspan="3" style="text-align:center;color:var(--ih-muted)">No flagged transactions</td></tr>`;

	document.querySelectorAll("#flaggedTable tr[data-transaction-id]").forEach((row) => {
		row.addEventListener("click", () => {
			const transaction = transactions.find((t) => t.id === row.dataset.transactionId);
			if (transaction) openRecordDetail({ ...transaction, type: "Transaction" }, "dashboard");
		});
	});

	const activePolicies = policies
		.map((policy) => ({
			...policy,
			usedIn: cases.filter((caseData) =>
				casePolicyMatches(caseData).some((matched) => matched.id === policy.id)
			).length,
		}))
		.filter((policy) => policy.usedIn > 0)
		.sort((a, b) => b.usedIn - a.usedIn || a.id.localeCompare(b.id));

	document.getElementById("policiesTable").innerHTML = activePolicies.length
		? activePolicies
		.map(
			(p) => `
		<tr class="clickable" data-policy-id="${escapeHtml(p.id)}" title="View ${escapeHtml(p.id)} details">
			<td><strong>${escapeHtml(p.id)}</strong></td>
			<td>${escapeHtml(p.category)}</td>
			<td>${p.usedIn} case${p.usedIn === 1 ? "" : "s"}</td>
			<td>${escapeHtml(p.summary)}</td>
		</tr>`
		)
		.join("")
		: `<tr><td colspan="4" style="text-align:center;color:var(--ih-muted)">No active policies in your access scope</td></tr>`;

	document.querySelectorAll("#policiesTable tr[data-policy-id]").forEach((row) => {
		row.addEventListener("click", () => {
			const policy = policies.find((p) => p.id === row.dataset.policyId);
			if (policy) openRecordDetail({ ...policy, type: "Policy" }, "dashboard");
		});
	});
}

function recordNumber(id) {
	const match = String(id).match(/(\d+)$/);
	return match ? Number(match[1]) : 0;
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
		<tr data-case-id="${escapeHtml(c.id)}" style="cursor:pointer;">
			<td><strong>${escapeHtml(c.id)}</strong></td>
			<td>${escapeHtml(c.type)}</td>
			<td><span class="badge ${badgeClass(c.status, "status")}">${c.status}</span></td>
			<td><span class="badge ${badgeClass(c.severity, "severity")}">${c.severity}</span></td>
			<td style="max-width:360px">${escapeHtml(c.summary)}</td>
		</tr>`
		)
		.join("");

	document.querySelectorAll("#casesTable tr[data-case-id]").forEach((row) => {
		row.addEventListener("click", () => {
			openCaseDetail(row.dataset.caseId, "cases");
		});
	});
}

function openCaseDetail(caseId, returnView = "cases") {
	currentSelectedCaseId = caseId;
	caseDetailReturnView = returnView;
	document.getElementById("backFromCaseDetailBtn").textContent =
		returnView === "knowledge"
			? "← Back to Knowlegde Search"
			: returnView === "reports"
				? "← Back to Analysis & Report"
				: "← Back to Cases";
	renderCaseDetail(caseId);
	if (returnView === "dashboard") {
		document.getElementById("backFromCaseDetailBtn").textContent = "← Back to Dashboard";
	}
	navigateTo("caseDetail");
}

function renderRecordDetail(record) {
	const isTransaction = record.type === "Transaction";
	const badge = document.getElementById("recordDetailBadge");
	const summary = record.summary || record.text || "No details available.";

	document.getElementById("recordDetailId").textContent = `${record.type}: ${record.id}`;
	document.getElementById("recordDetailDescriptionTitle").textContent =
		isTransaction ? "Transaction Description" : "Policy Description";
	document.getElementById("recordDetailDescription").innerHTML = `<p>${escapeHtml(summary)}</p>`;

	if (isTransaction) {
		badge.textContent = `${record.risk} Risk`;
		badge.className = `badge ${badgeClass(record.risk, "risk")}`;
		const time = summary.match(/time\s+([^,]+)/i)?.[1] || "Not provided";
		const location = summary.match(/location\s+([^,]+)/i)?.[1] || "Not provided";
		document.getElementById("recordDetailInformation").innerHTML = `
			<div class="suggestion-item"><strong>Transaction ID</strong>${escapeHtml(record.id)}</div>
			<div class="suggestion-item"><strong>Amount</strong>$${escapeHtml(String(record.amount))}</div>
			<div class="suggestion-item"><strong>Risk level</strong>${escapeHtml(record.risk)}</div>
			<div class="suggestion-item"><strong>Flagged</strong>${record.flagged ? "Yes" : "No"}</div>
			<div class="suggestion-item"><strong>Time</strong>${escapeHtml(time)}</div>
			<div class="suggestion-item"><strong>Location</strong>${escapeHtml(location)}</div>`;
	} else {
		badge.textContent = record.category;
		badge.className = "badge";
		document.getElementById("recordDetailInformation").innerHTML = `
			<div class="suggestion-item"><strong>Policy ID</strong>${escapeHtml(record.id)}</div>
			<div class="suggestion-item"><strong>Category</strong>${escapeHtml(record.category)}</div>
			<div class="suggestion-item"><strong>Guidance</strong>This policy is applied when its stated conditions are met during transaction monitoring.</div>`;
	}
}

function openRecordDetail(record, returnView = "knowledge") {
	recordDetailReturnView = returnView;
	document.getElementById("backFromRecordDetailBtn").textContent = "← Back to Search Results";
	renderRecordDetail(record);
	if (returnView === "dashboard") {
		document.getElementById("backFromRecordDetailBtn").textContent = "← Back to Dashboard";
	}
	navigateTo("recordDetail");
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

function renderCaseDetail(caseId) {
	const caseData = appData.cases.find(c => c.id === caseId);
	if (!caseData) return;

	const originalMessage = caseData.original_message || "";
	const keywords = extractKeywords(`${originalMessage} ${caseData.summary || ""}`);
	const matchedPolicies = matchPolicies(keywords, appData.policies);
	const recommendedDepartment = getRecommendedDepartment(caseData.type);
	const needsDepartmentRecommendation = ["Medium", "High"].includes(caseData.severity);

	document.getElementById("caseDetailId").textContent = caseId;
	document.getElementById("caseDetailStatus").textContent = caseData.status;
	document.getElementById("caseDetailStatus").className = `badge ${badgeClass(caseData.status, "status")}`;

	document.getElementById("caseDetailMessage").innerHTML = originalMessage
		? `<p>${escapeHtml(originalMessage)}</p>`
		: `<p class="text-muted">No original customer message is on file for this case.</p>`;

	document.getElementById("caseDetailKeywords").innerHTML = keywords.length > 0
		? `<div class="keywords-list">${keywords.map(kw => `<span class="keyword-tag">${escapeHtml(kw)}</span>`).join("")}</div>`
		: `<p class="text-muted">No keywords detected</p>`;

	const suggestionsText = `
		<div class="suggestion-item">
			<strong>Case Type:</strong> ${escapeHtml(caseData.type)}
		</div>
		<div class="suggestion-item">
			<strong>Severity:</strong> <span class="badge ${badgeClass(caseData.severity, "severity")}">${escapeHtml(caseData.severity)}</span>
		</div>
		<div class="suggestion-item">
			<strong>Status:</strong> <span class="badge ${badgeClass(caseData.status, "status")}">${escapeHtml(caseData.status)}</span>
		</div>
		<div class="suggestion-item" style="margin-top: 12px;">
			<strong>Recommendations:</strong>
			<p>Based on the detected keywords and case analysis, review the matched policies below for compliance and investigation guidance.</p>
		</div>
		${needsDepartmentRecommendation ? `<div class="suggestion-item"><strong>Recommended department:</strong> ${escapeHtml(recommendedDepartment)}</div>` : ""}
		${caseData.assigned_department ? `<div class="suggestion-item"><strong>Sent to:</strong> ${escapeHtml(caseData.assigned_department)}</div>` : ""}
	`;

	document.getElementById("caseDetailSuggestions").innerHTML = suggestionsText;

	const policiesHtml = matchedPolicies.length > 0
		? `<div class="policies-list">${matchedPolicies.map(p => `
			<div class="policy-item">
				<div class="policy-id">${escapeHtml(p.id)}</div>
				<div class="policy-summary">${escapeHtml(p.summary)}</div>
			</div>
		`).join("")}</div>`
		: `<p class="text-muted">No matching policies found</p>`;

	document.getElementById("caseDetailPolicies").innerHTML = `
		<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--ih-border);">
			<h3 style="margin-top: 0;">Relevant Policies</h3>
			${policiesHtml}
		</div>
	`;

	const isResolved = caseData.status === "Resolved";
	document.getElementById("caseDetailActionHelper").textContent = needsDepartmentRecommendation
		? `This ${caseData.severity.toLowerCase()}-severity case should be handled by ${recommendedDepartment}.`
		: "Resolve the case when the investigation is complete, or route it to the responsible department.";
	document.getElementById("resolveCaseBtn").disabled = isResolved;
	document.getElementById("resolveCaseBtn").textContent = isResolved ? "Case resolved" : "Mark as resolved";
	document.getElementById("forwardCaseBtn").disabled = isResolved;
	document.getElementById("forwardCaseBtn").textContent = `Send to ${recommendedDepartment}`;
	document.getElementById("caseDetailActionFeedback").textContent = "";
	document.getElementById("caseDetailActionFeedback").className = "case-action-feedback";
	document.getElementById("resolveCaseBtn").onclick = () => performCaseAction(caseId, "resolve");
	document.getElementById("forwardCaseBtn").onclick = () => performCaseAction(caseId, "forward");
}

function getRecommendedDepartment(caseType) {
	const departments = {
		"Account Takeover": "Account Security", "SIM Swap": "Account Security",
		Phishing: "Account Security", "Social Engineering": "Account Security",
		"Identity Theft": "Identity Verification", "Card Testing": "Card Operations",
		"Geo-Velocity Anomaly": "Card Operations", "Merchant Refund Abuse": "Merchant Risk",
		"Duplicate Charge": "Payments & Billing", "Friendly Fraud": "Chargebacks",
		"Money Mule": "Financial Crime Investigations", "Unauthorized Transfer": "Payments Investigations",
	};
	return departments[caseType] || "Fraud Operations";
}

async function performCaseAction(caseId, action) {
	const buttons = [document.getElementById("resolveCaseBtn"), document.getElementById("forwardCaseBtn")];
	const feedback = document.getElementById("caseDetailActionFeedback");
	buttons.forEach((button) => { button.disabled = true; });
	feedback.textContent = "Updating case...";
	feedback.className = "case-action-feedback";

	try {
		const response = await fetch(`${API_BASE}/case_actions.php`, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ case_id: caseId, action }),
		});
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "Unable to update the case.");

		const caseData = appData.cases.find((item) => item.id === caseId);
		if (caseData) {
			caseData.status = result.status;
			caseData.assigned_department = result.department || null;
		}
		renderDashboard();
		renderCases(currentCaseFilter);
		renderReports();
		renderCaseDetail(caseId);
		const updatedFeedback = document.getElementById("caseDetailActionFeedback");
		updatedFeedback.textContent = result.message;
		updatedFeedback.className = "case-action-feedback success";
	} catch (error) {
		buttons.forEach((button) => { button.disabled = false; });
		feedback.textContent = error.message;
		feedback.className = "case-action-feedback error";
	}
}

function renderBarChart(containerId, items) {
	const max = Math.max(...items.map((i) => i.value), 1);
	const el = document.getElementById(containerId);
	if (!items.length) {
		el.innerHTML = `<p class="text-muted">No data in your access scope.</p>`;
		return;
	}
	el.innerHTML = items
		.map(
			(item) => `
		<div class="bar-row">
			<span class="bar-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
			<div class="bar-track">
				<div class="bar-fill ${item.color}" style="width:${(item.value / max) * 100}%"></div>
			</div>
			<span class="bar-value">${item.value}</span>
		</div>`
		)
		.join("");
}

function countBy(items, key) {
	return items.reduce((acc, item) => {
		const value = item[key] || "Unknown";
		acc[value] = (acc[value] || 0) + 1;
		return acc;
	}, {});
}

function casePolicyMatches(caseData) {
	const keywords = extractKeywords(`${caseData.original_message || ""} ${caseData.summary || ""}`);
	return matchPolicies(keywords, appData.policies || []);
}

function severityRank(severity) {
	return { High: 0, Medium: 1, Low: 2 }[severity] ?? 3;
}

function buildStaffReport() {
	const cases = appData.cases || [];
	const transactions = appData.transactions || [];
	const policies = appData.policies || [];
	const openCases = cases.filter((c) => c.status === "Open");
	const resolvedCases = cases.filter((c) => c.status === "Resolved");
	const openHigh = openCases.filter((c) => c.severity === "High");
	const flagged = transactions.filter((t) => t.flagged);
	const resolutionRate = cases.length
		? Math.round((resolvedCases.length / cases.length) * 100)
		: 0;

	const typeCounts = countBy(cases, "type");
	const openTypeCounts = countBy(openCases, "type");
	const topOpenType = Object.entries(openTypeCounts).sort((a, b) => b[1] - a[1])[0];

	const queue = openCases
		.map((c) => ({
			...c,
			policyCount: casePolicyMatches(c).length,
		}))
		.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.id.localeCompare(b.id));

	const weakCoverage = queue.filter((c) => c.policyCount <= 1);
	const generatedAt = new Date().toLocaleString();

	const findings = [];
	if (openHigh.length) {
		findings.push({
			tone: "danger",
			title: `${openHigh.length} high-severity case${openHigh.length === 1 ? "" : "s"} still open`,
			text: `Work ${openHigh.map((c) => c.id).join(", ")} first. These are the highest-risk items in the staff queue.`,
		});
	} else if (openCases.length) {
		findings.push({
			tone: "warning",
			title: `${openCases.length} open case${openCases.length === 1 ? "" : "s"} in the queue`,
			text: "No high-severity items are waiting, but open cases still need a documented decision.",
		});
	} else {
		findings.push({
			tone: "success",
			title: "No open cases in your queue",
			text: "All cases in your access scope are marked resolved. Continue monitoring new reports.",
		});
	}

	if (topOpenType) {
		findings.push({
			tone: "info",
			title: `Most common open type: ${topOpenType[0]}`,
			text: `${topOpenType[1]} open case${topOpenType[1] === 1 ? "" : "s"} share this pattern. Use the matching policy on the case detail page before closing.`,
		});
	}

	if (weakCoverage.length) {
		findings.push({
			tone: "warning",
			title: `${weakCoverage.length} open case${weakCoverage.length === 1 ? "" : "s"} have thin policy coverage`,
			text: `${weakCoverage.map((c) => c.id).join(", ")} matched one policy or fewer. Read the customer message and confirm the playbook before acting.`,
		});
	}

	if (flagged.length) {
		findings.push({
			tone: "danger",
			title: `${flagged.length} flagged transaction${flagged.length === 1 ? "" : "s"}`,
			text: "Compare these against velocity, device, and payee policies before releasing funds.",
		});
	}

	const actions = [];
	if (openHigh.length) {
		actions.push(`Review and update ${openHigh.map((c) => c.id).join(", ")} (high severity, still open).`);
	}
	const remainingOpen = queue.filter((c) => c.severity !== "High").slice(0, 3);
	if (remainingOpen.length) {
		actions.push(`Clear the next open items: ${remainingOpen.map((c) => `${c.id} (${c.type})`).join(", ")}.`);
	}
	if (topOpenType) {
		actions.push(`For ${topOpenType[0]} cases, apply the matching staff policy and record the outcome on the case.`);
	}
	if (weakCoverage.length) {
		actions.push(`Double-check policy fit on ${weakCoverage.map((c) => c.id).join(", ")} before marking them resolved.`);
	}
	if (!actions.length) {
		actions.push("No outstanding staff actions. Re-run this report after new cases arrive.");
	}

	return {
		cases,
		transactions,
		policies,
		openCases,
		resolvedCases,
		openHigh,
		flagged,
		resolutionRate,
		typeCounts,
		queue,
		findings,
		actions,
		generatedAt,
	};
}

function renderReports() {
	const report = buildStaffReport();
	const { cases, transactions, policies, openCases, resolvedCases, openHigh, flagged, resolutionRate } = report;

	document.getElementById("reportGeneratedAt").textContent =
		`Staff view · generated ${report.generatedAt}`;

	document.getElementById("reportKpis").innerHTML = `
		<div class="stat-card">
			<div class="stat-card-header">
				<span class="stat-label">Open Workload</span>
				<div class="stat-icon amber">!</div>
			</div>
			<div class="stat-value">${openCases.length}</div>
			<div class="stat-change">${cases.length} cases in your scope</div>
		</div>
		<div class="stat-card">
			<div class="stat-card-header">
				<span class="stat-label">High Severity Open</span>
				<div class="stat-icon red">↑</div>
			</div>
			<div class="stat-value">${openHigh.length}</div>
			<div class="stat-change">needs action today</div>
		</div>
		<div class="stat-card">
			<div class="stat-card-header">
				<span class="stat-label">Resolution Rate</span>
				<div class="stat-icon green">%</div>
			</div>
			<div class="stat-value">${resolutionRate}%</div>
			<div class="stat-change">${resolvedCases.length} resolved</div>
		</div>
		<div class="stat-card">
			<div class="stat-card-header">
				<span class="stat-label">Playbooks</span>
				<div class="stat-icon blue">P</div>
			</div>
			<div class="stat-value">${policies.length}</div>
			<div class="stat-change">${flagged.length} flagged transaction${flagged.length === 1 ? "" : "s"}</div>
		</div>
	`;

	renderBarChart("caseStatusChart", [
		{ label: "Open", value: openCases.length, color: "amber" },
		{ label: "Resolved", value: resolvedCases.length, color: "green" },
	]);

	renderBarChart("severityChart", [
		{ label: "High", value: cases.filter((c) => c.severity === "High").length, color: "red" },
		{ label: "Medium", value: cases.filter((c) => c.severity === "Medium").length, color: "amber" },
		{ label: "Low", value: cases.filter((c) => c.severity === "Low").length, color: "green" },
	]);

	const typeColors = ["blue", "red", "amber", "green"];
	const typeItems = Object.entries(report.typeCounts)
		.sort((a, b) => b[1] - a[1])
		.map(([label, value], i) => ({
			label,
			value,
			color: typeColors[i % typeColors.length],
		}));
	renderBarChart("caseTypeChart", typeItems);

	const categories = countBy(policies, "category");
	renderBarChart(
		"policyChart",
		Object.entries(categories)
			.sort((a, b) => b[1] - a[1])
			.map(([label, value]) => ({ label, value, color: "blue" }))
	);

	document.getElementById("reportPriorityTable").innerHTML = report.queue.length
		? report.queue
				.map(
					(c) => `
		<tr data-case-id="${escapeHtml(c.id)}" style="cursor:pointer;">
			<td><strong>${escapeHtml(c.id)}</strong></td>
			<td>${escapeHtml(c.type)}</td>
			<td><span class="badge ${badgeClass(c.severity, "severity")}">${escapeHtml(c.severity)}</span></td>
			<td>${c.policyCount} matched</td>
		</tr>`
				)
				.join("")
		: `<tr><td colspan="4" style="text-align:center;color:var(--ih-muted)">No open cases in your queue</td></tr>`;

	document.querySelectorAll("#reportPriorityTable tr[data-case-id]").forEach((row) => {
		row.addEventListener("click", () => openCaseDetail(row.dataset.caseId, "reports"));
	});

	document.getElementById("reportFindings").innerHTML = report.findings
		.map(
			(f) => `
		<div class="report-finding ${f.tone}">
			<strong>${escapeHtml(f.title)}</strong>
			<p>${escapeHtml(f.text)}</p>
		</div>`
		)
		.join("");

	document.getElementById("reportActions").innerHTML = report.actions
		.map((action) => `<li>${escapeHtml(action)}</li>`)
		.join("");

	const highRisk = transactions.filter((t) => t.risk === "High").length;
	document.getElementById("reportSummary").innerHTML = `
		<p>This staff report covers <strong>${cases.length} case${cases.length !== 1 ? "s" : ""}</strong> you can access,
		<strong>${transactions.length} transaction${transactions.length !== 1 ? "s" : ""}</strong>
		(${flagged.length} flagged), and <strong>${policies.length} polic${policies.length !== 1 ? "ies" : "y"}</strong>.</p>
		<p style="margin-top:0.75rem"><strong>${openCases.length}</strong> remain open
		(${openHigh.length} high severity). Resolution rate is <strong>${resolutionRate}%</strong>.
		${highRisk} transaction${highRisk !== 1 ? "s are" : " is"} classified as high risk.</p>
		<p style="margin-top:0.75rem">Use the priority queue to open a case, read the customer's original message, then apply the matched policies before you close the file.</p>
	`;

	window.__staffReportExport = buildReportExportText(report);
}

function buildReportExportText(report) {
	const lines = [
		"IntelliHub Staff Investigation Report",
		"=".repeat(40),
		`Generated: ${report.generatedAt}`,
		"",
		"Workload",
		`- Cases in scope: ${report.cases.length}`,
		`- Open: ${report.openCases.length}`,
		`- High-severity open: ${report.openHigh.length}`,
		`- Resolved: ${report.resolvedCases.length}`,
		`- Resolution rate: ${report.resolutionRate}%`,
		`- Policies: ${report.policies.length}`,
		`- Flagged transactions: ${report.flagged.length}`,
		"",
		"Open priority queue",
	];

	if (report.queue.length) {
		report.queue.forEach((c) => {
			lines.push(`- ${c.id} | ${c.type} | ${c.severity} | ${c.policyCount} policies matched`);
		});
	} else {
		lines.push("- None");
	}

	lines.push("", "Findings");
	report.findings.forEach((f) => lines.push(`- ${f.title}: ${f.text}`));
	lines.push("", "Recommended actions");
	report.actions.forEach((action, i) => lines.push(`${i + 1}. ${action}`));
	return lines.join("\n");
}

function setupExportReport() {
	document.getElementById("exportReportBtn").addEventListener("click", () => {
		const text =
			window.__staffReportExport ||
			document.getElementById("reportSummary").innerText;
		const blob = new Blob([text], { type: "text/plain" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = "intellihub-staff-report.txt";
		a.click();
		URL.revokeObjectURL(a.href);
	});
}

function renderSearchResultMeta(result) {
	if (result.type === "Case") {
		return `
			<span class="badge ${badgeClass(result.status, "status")}">${escapeHtml(result.status)}</span>
			<span class="badge ${badgeClass(result.severity, "severity")}">${escapeHtml(result.severity)}</span>
			<span class="result-meta-label">${escapeHtml(result.type)}</span>`;
	}
	if (result.type === "Transaction") {
		return `
			<span class="badge ${badgeClass(result.risk, "risk")}">${escapeHtml(result.risk)} Risk</span>
			<span class="result-meta-label">$${escapeHtml(String(result.amount))}</span>`;
	}
	if (result.type === "Policy") {
		return `<span class="badge">${escapeHtml(result.category)}</span>`;
	}
	return "";
}

async function searchKnowledge(query) {
	const container = document.getElementById("searchResults");
	const requestId = ++knowledgeSearchRequestId;
	container.innerHTML = `<div class="empty-state">Searching…</div>`;

	const res = await fetch(`${API_BASE}/data.php?action=search`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query }),
	});

	if (res.status === 401) {
		window.location.href = "login.html";
		return;
	}

	const data = await res.json();
	if (requestId !== knowledgeSearchRequestId) return;
	knowledgeSearchResults = data.results || [];

	if (!data.results?.length) {
		container.innerHTML = `<div class="empty-state">No results found for "${escapeHtml(query)}"</div>`;
		return;
	}

	const grouped = { Case: [], Transaction: [], Policy: [] };
	for (const result of data.results) {
		if (grouped[result.type]) grouped[result.type].push(result);
	}

	const sections = [
		["Case", "Cases"],
		["Transaction", "Transactions"],
		["Policy", "Policies"],
	]
		.filter(([type]) => grouped[type].length > 0)
		.map(
			([type, label]) => `
		<div class="search-result-group">
			<div class="search-result-group-title">${label} (${grouped[type].length})</div>
			${grouped[type]
				.map(
					(r) => `
			<button type="button" class="result-item clickable" data-record-id="${escapeHtml(r.id)}" data-record-type="${escapeHtml(r.type)}" title="View ${escapeHtml(r.type)} details">
				<div class="result-id">${escapeHtml(r.id)} · ${escapeHtml(r.type)}</div>
				<div class="result-meta">${renderSearchResultMeta(r)}</div>
				<div class="result-text">${escapeHtml(r.summary || r.text)}</div>
			</button>`
				)
				.join("")}
		</div>`
		)
		.join("");

	container.innerHTML = sections;
}

function setupKnowledgeSearch() {
	const input = document.getElementById("knowledgeSearchInput");
	const container = document.getElementById("searchResults");
	const search = () => {
		const q = input.value.trim();
		if (q) searchKnowledge(q);
	};
	const clearSearch = () => {
		knowledgeSearchRequestId++;
		knowledgeSearchResults = [];
		input.value = "";
		container.innerHTML = `<div class="empty-state">Enter a keyword to search the knowledge base</div>`;
		input.focus();
	};
	document.getElementById("knowledgeSearchBtn").addEventListener("click", search);
	document.getElementById("knowledgeSearchCancelBtn").addEventListener("click", clearSearch);
	container.addEventListener("click", (event) => {
		const item = event.target.closest(".result-item[data-record-id]");
		if (!item) return;
		const result = knowledgeSearchResults.find(
			(r) => r.id === item.dataset.recordId && r.type === item.dataset.recordType
		);
		if (!result) return;
		if (result.type === "Case") openCaseDetail(result.id, "knowledge");
		else openRecordDetail(result, "knowledge");
	});
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") search();
	});
}

function hideWelcome(welcomeId) {
	const el = document.getElementById(welcomeId);
	if (el) el.style.display = "none";
}

function sourceLabel(source) {
	if (typeof source === "string") return source;
	if (source && typeof source === "object") {
		return source.file_name || source.title || source.id || "Document";
	}
	return String(source);
}

function sourceId(source) {
	if (typeof source === "string") return source;
	if (source && typeof source === "object") return source.id || source.title || "";
	return String(source);
}

function formatSourceDate(dateStr) {
	if (!dateStr) return "";
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return "";
	return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function buildSourceTagsHtml(sources = []) {
	if (!sources.length) return "";
	return `<div class="message-sources">${sources
		.map((source) => {
			const id = sourceId(source);
			const label = sourceLabel(source);
			const confidence = typeof source === "object" ? source.confidence : null;
			const updated = formatSourceDate(typeof source === "object" ? source.last_updated : null);

			const metaParts = [];
			if (confidence !== null && confidence !== undefined) {
				metaParts.push(`<span class="source-tag-confidence">${escapeHtml(String(confidence))}% match</span>`);
			}
			if (updated) {
				metaParts.push(`<span class="source-tag-updated">Updated ${escapeHtml(updated)}</span>`);
			}
			const metaHtml = metaParts.length
				? `<span class="source-tag-meta">${metaParts.join('<span class="source-tag-dot">·</span>')}</span>`
				: "";

			return `<button type="button" class="source-tag" data-source-id="${escapeHtml(id)}" title="View ${escapeHtml(label)}">
				<span class="source-tag-label">${escapeHtml(label)}</span>
				${metaHtml}
			</button>`;
		})
		.join("")}</div>`;
}

function renderBold(escapedText) {
	return escapedText.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

// Bot answers come back as Markdown, so bullets, numbered steps and headings
// render as real blocks instead of one long line. The text is escaped first so
// any raw HTML in the model output is shown, never executed. Falls back to
// bold-only rendering if marked.js did not load.
function renderBotText(text) {
	const escaped = escapeHtml(text);
	if (typeof marked !== "undefined") {
		return marked.parse(escaped, { breaks: true, gfm: true });
	}
	return renderBold(escaped).replace(/\n/g, "<br>");
}

function confidenceLevel(confidence) {
	if (confidence >= 70) return "high";
	if (confidence >= 40) return "medium";
	return "low";
}

// Progress bar shown under a bot answer, reporting how well the retrieved
// sources matched the question.
function buildConfidenceHtml(confidence) {
	if (confidence === null || confidence === undefined || isNaN(confidence)) return "";

	const pct = Math.max(0, Math.min(100, Math.round(confidence)));
	const level = confidenceLevel(pct);

	return `
		<div class="answer-confidence answer-confidence-${level}">
			<div class="answer-confidence-head">
				<span class="answer-confidence-label">Confidence</span>
				<span class="answer-confidence-value">${pct}%</span>
			</div>
			<div class="answer-confidence-track" role="progressbar" aria-label="Answer confidence"
				aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
				<div class="answer-confidence-fill" style="width: ${pct}%"></div>
			</div>
		</div>`;
}

// Told apart from a plain "no results" answer: this fires only when
// permission-aware retrieval actually dropped a matching record for the
// current user's role before it reached the AI.
function buildRestrictedNoteHtml(restrictedCount) {
	if (!restrictedCount) return "";
	const plural = restrictedCount === 1 ? "record" : "records";
	return `<div class="answer-restricted-note">${restrictedCount} matching ${plural} withheld — restricted to a higher access level</div>`;
}

function buildMessageHtml(role, text, sources = [], confidence = null, restrictedCount = 0) {
	const isBot = role === "bot";
	const sourcesHtml = isBot ? buildSourceTagsHtml(sources) : "";
	const confidenceHtml = isBot ? buildConfidenceHtml(confidence) : "";
	const restrictedHtml = isBot ? buildRestrictedNoteHtml(restrictedCount) : "";
	const bubbleContent = isBot ? renderBotText(text) : escapeHtml(text);
	return `
		<div class="message-avatar">${role === "user" ? "You" : "IH"}</div>
		<div class="message-content">
			<div class="message-bubble${isBot ? " message-bubble-rich" : ""}">${bubbleContent}</div>
			${confidenceHtml}
			${restrictedHtml}
			${sourcesHtml}
		</div>`;
}

async function openDocumentViewer(docId) {
	const overlay = document.getElementById("docModalOverlay");
	const titleEl = document.getElementById("docModalTitle");
	const metaEl = document.getElementById("docModalMeta");
	const bodyEl = document.getElementById("docModalBody");
	const openFileBtn = document.getElementById("docModalOpenFile");

	overlay.classList.remove("hidden");
	titleEl.textContent = "Loading…";
	metaEl.textContent = "";
	bodyEl.innerHTML = `<div class="doc-modal-loading">Loading document…</div>`;
	openFileBtn.classList.add("hidden");

	try {
		const res = await fetch(
			`${API_BASE}/document.php?action=view&id=${encodeURIComponent(docId)}`,
			{ credentials: "include" }
		);
		const data = await res.json();

		if (!res.ok) {
			throw new Error(data.error || "Unable to load document.");
		}

		titleEl.textContent = data.title;
		const updated = formatSourceDate(data.last_updated);
		metaEl.innerHTML = `
			<span class="badge badge-clear">${escapeHtml(data.category)}</span>
			<span>${escapeHtml(data.id)}</span>
			${data.file_name ? `<span>${escapeHtml(data.file_name)}</span>` : ""}
			${updated ? `<span>Last updated ${escapeHtml(updated)}</span>` : ""}
		`;

		if (data.preview_type === "pdf" && data.file_url) {
			bodyEl.innerHTML = `<iframe src="${data.file_url}" title="${escapeHtml(data.title)}"></iframe>`;
			openFileBtn.href = data.file_url;
			openFileBtn.classList.remove("hidden");
		} else {
			bodyEl.innerHTML = `<div class="doc-modal-text">${escapeHtml(data.text)}</div>`;
			if (data.file_url) {
				openFileBtn.href = data.file_url;
				openFileBtn.classList.remove("hidden");
			}
		}
	} catch (err) {
		titleEl.textContent = "Document unavailable";
		metaEl.textContent = docId;
		bodyEl.innerHTML = `<div class="doc-modal-loading">${escapeHtml(err.message)}</div>`;
	}
}

function closeDocumentViewer() {
	document.getElementById("docModalOverlay").classList.add("hidden");
}

function setupDocumentViewer() {
	document.getElementById("docModalClose").addEventListener("click", closeDocumentViewer);
	document.getElementById("docModalCloseFooter").addEventListener("click", closeDocumentViewer);
	document.getElementById("docModalOverlay").addEventListener("click", (e) => {
		if (e.target.id === "docModalOverlay") closeDocumentViewer();
	});

	document.addEventListener("click", (e) => {
		const tag = e.target.closest(".source-tag[data-source-id]");
		if (tag) openDocumentViewer(tag.dataset.sourceId);
	});

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") closeDocumentViewer();
	});
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

	chatHistory.forEach(({ role, text, sources, confidence, restrictedCount }) => {
		const msg = document.createElement("div");
		msg.className = `message ${role}`;
		msg.innerHTML = buildMessageHtml(role, text, sources, confidence, restrictedCount);
		chat.appendChild(msg);
	});

	chat.scrollTop = chat.scrollHeight;
}

function renderAllChats() {
	renderChatContainer("full");
	renderChatContainer("widget");
}

function appendMessage(role, text, sources = [], confidence = null, restrictedCount = 0) {
	chatHistory.push({ role, text, sources, confidence, restrictedCount });
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
		appendMessage(
			"bot",
			data.answer,
			data.sources_used || [],
			data.confidence ?? null,
			data.restricted_count ?? 0
		);
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
	setupDocumentViewer();
	setupExportReport();

	document.getElementById("logoutBtn").addEventListener("click", logout);
	document.getElementById("backFromCaseDetailBtn").addEventListener("click", () => navigateTo(caseDetailReturnView));
	document.getElementById("backFromRecordDetailBtn").addEventListener("click", () => navigateTo(recordDetailReturnView));
});
