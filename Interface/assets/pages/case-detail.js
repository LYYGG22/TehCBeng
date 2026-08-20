function renderCaseDetail(caseId) {
	const caseData = appData.cases.find(c => c.id === caseId);
	if (!caseData) {
		document.getElementById("caseDetailId").textContent = caseId || "Not found";
		document.getElementById("caseDetailMessage").innerHTML =
			`<p class="text-muted">This case doesn't exist, or isn't in your access scope.</p>`;
		return;
	}

	const originalMessage = caseData.original_message || "";
	const keywords = extractKeywords(`${originalMessage} ${caseData.summary || ""}`);
	const matchedPolicies = matchPolicies(keywords, appData.policies);

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
}

async function initPage() {
	const caseId = new URLSearchParams(window.location.search).get("id") || "";
	appData = await loadData();
	if (!appData) return;
	renderCaseDetail(caseId);
}
