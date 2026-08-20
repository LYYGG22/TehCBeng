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

async function initPage() {
	const params = new URLSearchParams(window.location.search);
	const type = params.get("type") || "";
	const id = params.get("id") || "";

	appData = await loadData();
	if (!appData) return;

	const source = type === "Transaction" ? appData.transactions : appData.policies;
	const record = (source || []).find((r) => r.id === id);

	if (!record) {
		document.getElementById("recordDetailId").textContent = "Not found";
		document.getElementById("recordDetailDescription").innerHTML =
			`<p class="text-muted">This record doesn't exist, or isn't in your access scope.</p>`;
		return;
	}

	renderRecordDetail({ ...record, type });
}
