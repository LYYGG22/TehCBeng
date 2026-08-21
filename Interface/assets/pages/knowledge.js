let knowledgeSearchRequestId = 0;
let knowledgeSearchResults = [];

function renderRecentKnowledge() {
	const container = document.getElementById("recentKnowledgeRecords");
	if (!container || !appData) return;
	const recentCases = [...appData.cases].sort((a, b) => recordNumber(b.id) - recordNumber(a.id)).slice(0, 3)
		.map((record) => ({ ...record, type: "Case" }));
	const recentPolicies = [...appData.policies].sort((a, b) => recordNumber(b.id) - recordNumber(a.id)).slice(0, 3)
		.map((record) => ({ ...record, type: "Policy" }));
	const recentTransactions = [...appData.transactions].sort((a, b) => recordNumber(b.id) - recordNumber(a.id)).slice(0, 3)
		.map((record) => ({ ...record, type: "Transaction" }));
	knowledgeSearchResults = [...recentCases, ...recentPolicies, ...recentTransactions];

	const groups = [
		["Recent Cases", recentCases],
		["Recent Policies", recentPolicies],
		["Recent Transactions", recentTransactions],
	].map(([label, records]) => `
		<div class="search-result-group">
			<div class="search-result-group-title">${label}</div>
			${records.map((record) => `
				<button type="button" class="result-item clickable" data-record-id="${escapeHtml(record.id)}" data-record-type="${escapeHtml(record.type)}" title="View ${escapeHtml(record.type)} details">
					<div class="result-id">${escapeHtml(record.id)} · ${escapeHtml(record.type)}</div>
					<div class="result-meta">${renderSearchResultMeta(record)}</div>
					<div class="result-text">${escapeHtml(record.summary)}</div>
				</button>`).join("")}
		</div>`).join("");
	container.innerHTML = groups;
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
			<span class="badge ${result.flagged ? "badge-flagged" : "badge-clear"}">${result.flagged ? "Flagged" : "Unflagged"}</span>
			<span class="result-meta-label">$${escapeHtml(String(result.amount))}</span>`;
	}
	if (result.type === "Policy") {
		return `<span class="badge ${categoryBadgeClass(result.category)}">${escapeHtml(result.category)}</span>`;
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
		input.value = "";
		container.innerHTML = `<div id="recentKnowledgeRecords"></div>`;
		renderRecentKnowledge();
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
		if (result.type === "Case") goToCaseDetail(result.id, "knowledge");
		else goToRecordDetail(result.type, result.id, "knowledge");
	});
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") search();
	});
}

async function initPage() {
	appData = await loadData();
	if (appData) renderRecentKnowledge();
	setupKnowledgeSearch();
}
