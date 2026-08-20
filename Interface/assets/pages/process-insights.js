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

// Known fraud types get a concrete, domain-specific rule idea. Anything else
// (the newer, thinly-covered types) gets an honest fallback instead of a
// made-up trigger — automating a pattern nobody's documented yet isn't
// realistic, so the suggestion says so and points at writing the policy first.
const AUTOMATION_IDEAS = {
	"Card Testing": "auto-freeze the card once repeated small authorizations happen within a short window, instead of waiting for manual review.",
	"Geo-Velocity Anomaly": "auto-block the second transaction whenever the distance and time between two locations make that travel physically impossible.",
	"Account Takeover": "auto-require step-up verification (OTP) on any transfer attempted shortly after a password reset or login from a new device.",
	"Duplicate Charge": "auto-hold the second charge whenever the same amount hits the same card twice within a short window.",
	"Money Mule": "auto-hold outbound transfers attempted shortly after an unusually large or first-time inbound deposit.",
	"Phishing": "auto-lock the account and cancel pending transactions as soon as a phishing report comes in, rather than handling it case by case.",
	"Unauthorized Transfer": "auto-hold transfers that don't match the account's normal recipient or amount pattern, pending confirmation.",
};

// Returns ready-to-insert HTML — two separate paragraphs (bold markers already
// resolved via renderBold, same helper common.js uses for chat answers): the
// context sentence, then "Suggested automation" on its own line so the actual
// recommendation doesn't get lost inside a long run-on sentence.
function buildAutomationSuggestion(candidate) {
	const { type, count, department, policyIds, caseIds } = candidate;
	const idea = AUTOMATION_IDEAS[type];
	const policyRef = policyIds.length ? `matches **${escapeHtml(policyIds.join(", "))}**` : "has no policy currently matching it";

	const context = `**${escapeHtml(type)}** has recurred **${count} times** (${escapeHtml(caseIds.join(", "))}), always routed to **${escapeHtml(department)}** and ${policyRef}.`;
	const recommendation = idea
		? `**Suggested automation:** ${idea}`
		: `**Suggested next step:** this pattern doesn't have a clear numeric trigger to automate yet — document a policy that defines exactly what to detect, before a rule can be built around it.`;

	return `<p>${renderBold(context)}</p><p style="margin-top: 0.625rem">${renderBold(recommendation)}</p>`;
}

// Same two-paragraph shape as buildAutomationSuggestion: context sentence,
// then the recommendation on its own line.
function buildPolicyGapSuggestion(gap) {
	const { type, count, avgMatches, caseIds } = gap;
	const coverageDesc = avgMatches === 0
		? "no existing policy matches these cases at all"
		: `these cases only average **${avgMatches.toFixed(1)}** matched polic${avgMatches === 1 ? "y" : "ies"}`;

	const context = `**${escapeHtml(type)}** has **${count}** case${count === 1 ? "" : "s"} on file (${escapeHtml(caseIds.join(", "))}) where ${coverageDesc}.`;
	const recommendation = `**Suggested next step:** write a policy that explicitly describes ${escapeHtml(type)} — what the pattern looks like and what action to take — so future cases like this have documented guidance instead of relying on ad hoc judgement.`;

	return `<p>${renderBold(context)}</p><p style="margin-top: 0.625rem">${renderBold(recommendation)}</p>`;
}

// Wires up click-to-expand for a table built with the insight-row /
// insight-suggestion-row pattern (used by both Automation Candidates and
// Policy Coverage Gaps). Only one panel open at a time within that table.
function wireInsightRowToggles(tableId) {
	document.querySelectorAll(`#${tableId} tr[data-suggestion-toggle]`).forEach((row) => {
		row.addEventListener("click", (event) => {
			if (event.target.closest("[data-case-id]")) return; // let case links navigate as normal
			const index = row.dataset.suggestionToggle;
			const panel = document.querySelector(`#${tableId} tr[data-suggestion-panel="${index}"]`);
			const isOpen = !panel.classList.contains("hidden");
			document.querySelectorAll(`#${tableId} .insight-suggestion-row`).forEach((p) => p.classList.add("hidden"));
			document.querySelectorAll(`#${tableId} .insight-row`).forEach((r) => r.classList.remove("insight-row-active"));
			if (!isOpen) {
				panel.classList.remove("hidden");
				row.classList.add("insight-row-active");
			}
		});
	});
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
					(a, i) => `
			<tr class="insight-row" data-suggestion-toggle="${i}" title="Click for the AI's automation suggestion">
				<td><strong>${escapeHtml(a.type)}</strong> <span class="insight-hint">💡</span></td>
				<td>${a.count}</td>
				<td>${escapeHtml(a.department)}</td>
				<td>${a.policyIds.length ? escapeHtml(a.policyIds.join(", ")) : "—"}</td>
				<td>${caseIdLinksHtml(a.caseIds)}</td>
			</tr>
			<tr class="insight-suggestion-row hidden" data-suggestion-panel="${i}">
				<td colspan="5">
					<div class="report-finding info">
						<strong>AI Suggestion</strong>
						${buildAutomationSuggestion(a)}
					</div>
				</td>
			</tr>`
				)
				.join("")
		: `<tr><td colspan="5" style="text-align:center;color:var(--ih-muted)">No fraud type has recurred often enough yet to flag as an automation candidate.</td></tr>`;

	wireInsightRowToggles("automationCandidatesTable");

	document.getElementById("knowledgeGapsTable").innerHTML = knowledgeGaps.length
		? knowledgeGaps
				.map(
					(g, i) => `
			<tr class="insight-row" data-suggestion-toggle="${i}" title="Click for the AI's suggestion">
				<td><strong>${escapeHtml(g.type)}</strong> <span class="insight-hint">💡</span></td>
				<td>${g.count}</td>
				<td>${g.avgMatches.toFixed(1)}</td>
				<td>${caseIdLinksHtml(g.caseIds)}</td>
			</tr>
			<tr class="insight-suggestion-row hidden" data-suggestion-panel="${i}">
				<td colspan="4">
					<div class="report-finding info">
						<strong>AI Suggestion</strong>
						${buildPolicyGapSuggestion(g)}
					</div>
				</td>
			</tr>`
				)
				.join("")
		: `<tr><td colspan="4" style="text-align:center;color:var(--ih-muted)">Every fraud type on file has reasonable matching policy coverage.</td></tr>`;

	wireInsightRowToggles("knowledgeGapsTable");

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

const DELETE_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>`;

function renderChatGaps(data) {
	const summary = document.getElementById("chatGapsSummary");
	const table = document.getElementById("chatGapsTable");

	if (!data || data.total_logged === 0) {
		summary.textContent = "No questions logged yet — this fills in as the chatbot gets used.";
		table.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--ih-muted)">Nothing logged yet.</td></tr>`;
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
				<td><button type="button" class="btn-delete-row" data-delete-log-id="${q.id}" title="Delete this logged question (e.g. if it was just a test/nonsense query)">${DELETE_ICON_SVG}</button></td>
			</tr>`
				)
				.join("")
		: `<tr><td colspan="4" style="text-align:center;color:var(--ih-muted)">No low-confidence questions in the current log.</td></tr>`;

	document.querySelectorAll("#chatGapsTable [data-delete-log-id]").forEach((btn) => {
		btn.addEventListener("click", () => deleteChatLogEntry(btn.dataset.deleteLogId));
	});
}

async function deleteChatLogEntry(id) {
	if (!confirm("Remove this logged question? This can't be undone.")) return;

	const res = await fetch(`${API_BASE}/data.php?action=delete_chat_log`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ id }),
	});

	if (!res.ok) {
		alert("Unable to delete that entry.");
		return;
	}

	renderChatGaps(await fetchChatGaps());
}

async function initPage() {
	if (!document.getElementById("processInsightsKpis")) return; // Staff sees the access-denied panel instead

	appData = await loadData();
	if (!appData) return;
	renderProcessInsights();

	renderChatGaps(await fetchChatGaps());
}
