// Groups all cases (not just open ones) by fraud type. A pattern that already
// recurred is evidence for automation/documentation even if every instance so
// far got resolved manually.
function buildProcessInsights() {
	const cases = appData.cases || [];
	const byType = {};
	cases.forEach((c) => {
		(byType[c.type] ??= []).push(c);
	});

	const automationCandidates = Object.entries(byType)
		.filter(([, group]) => group.length >= 2)
		.map(([type, group]) => ({
			type,
			count: group.length,
			caseIds: group.map((c) => c.id),
			department: getRecommendedDepartment(type),
			policyIds: [...new Set(group.flatMap((c) => casePolicyMatches(c).map((p) => p.id)))],
		}))
		.sort((a, b) => b.count - a.count);

	const knowledgeGaps = Object.entries(byType)
		.map(([type, group]) => ({
			type,
			count: group.length,
			avgMatches: group.reduce((sum, c) => sum + casePolicyMatches(c).length, 0) / group.length,
			caseIds: group.map((c) => c.id),
		}))
		.filter((g) => g.avgMatches <= 1)
		.sort((a, b) => a.avgMatches - b.avgMatches || b.count - a.count);

	return { automationCandidates, knowledgeGaps };
}

function caseIdLinksHtml(caseIds) {
	return caseIds
		.map((id) => `<button type="button" class="result-item clickable" data-case-id="${escapeHtml(id)}" style="display:inline-block;width:auto;padding:0.125rem 0.5rem;margin:0.125rem;">${escapeHtml(id)}</button>`)
		.join("");
}

function renderProcessInsights() {
	const { automationCandidates, knowledgeGaps } = buildProcessInsights();

	document.getElementById("processInsightsKpis").innerHTML = `
		<div class="stat-card">
			<div class="stat-card-header">
				<span class="stat-label">Automation Candidates</span>
				<div class="stat-icon amber">⚡</div>
			</div>
			<div class="stat-value">${automationCandidates.length}</div>
			<div class="stat-change">recurring fraud types</div>
		</div>
		<div class="stat-card">
			<div class="stat-card-header">
				<span class="stat-label">Knowledge Gaps</span>
				<div class="stat-icon red">📘</div>
			</div>
			<div class="stat-value">${knowledgeGaps.length}</div>
			<div class="stat-change">thin or missing policy coverage</div>
		</div>
	`;

	document.getElementById("automationCandidatesTable").innerHTML = automationCandidates.length
		? automationCandidates
				.map(
					(a) => `
			<tr>
				<td><strong>${escapeHtml(a.type)}</strong></td>
				<td>${a.count}</td>
				<td>${escapeHtml(a.department)}</td>
				<td>${a.policyIds.length ? escapeHtml(a.policyIds.join(", ")) : "—"}</td>
				<td>${caseIdLinksHtml(a.caseIds)}</td>
			</tr>`
				)
				.join("")
		: `<tr><td colspan="5" style="text-align:center;color:var(--ih-muted)">No fraud type has recurred often enough yet to flag as an automation candidate.</td></tr>`;

	document.getElementById("knowledgeGapsTable").innerHTML = knowledgeGaps.length
		? knowledgeGaps
				.map(
					(g) => `
			<tr>
				<td><strong>${escapeHtml(g.type)}</strong></td>
				<td>${g.count}</td>
				<td>${g.avgMatches.toFixed(1)}</td>
				<td>${caseIdLinksHtml(g.caseIds)}</td>
			</tr>`
				)
				.join("")
		: `<tr><td colspan="4" style="text-align:center;color:var(--ih-muted)">Every fraud type on file has reasonable matching policy coverage.</td></tr>`;

	document.querySelectorAll("#automationCandidatesTable [data-case-id], #knowledgeGapsTable [data-case-id]").forEach((btn) => {
		btn.addEventListener("click", () => goToCaseDetail(btn.dataset.caseId, "cases"));
	});
}

async function fetchChatGaps() {
	const res = await fetch(`${API_BASE}/data.php?action=chat_gaps`, {
		credentials: "include",
	});
	if (!res.ok) return null;
	return res.json();
}

function renderChatGaps(data) {
	const summary = document.getElementById("chatGapsSummary");
	const table = document.getElementById("chatGapsTable");

	if (!data || data.total_logged === 0) {
		summary.textContent = "No questions logged yet — this fills in as the chatbot gets used.";
		table.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--ih-muted)">Nothing logged yet.</td></tr>`;
		return;
	}

	summary.textContent = `${data.total_low_confidence} of ${data.total_logged} logged questions got a low-confidence answer`;

	table.innerHTML = data.questions.length
		? data.questions
				.map(
					(q) => `
			<tr>
				<td>${escapeHtml(q.query)}</td>
				<td>${escapeHtml(q.role)}</td>
				<td>${escapeHtml(String(q.confidence))}%</td>
			</tr>`
				)
				.join("")
		: `<tr><td colspan="3" style="text-align:center;color:var(--ih-muted)">No low-confidence questions in the current log.</td></tr>`;
}

async function initPage() {
	if (!document.getElementById("processInsightsKpis")) return; // Staff sees the access-denied panel instead

	appData = await loadData();
	if (!appData) return;
	renderProcessInsights();

	renderChatGaps(await fetchChatGaps());
}
