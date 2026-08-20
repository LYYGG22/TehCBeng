let currentCaseFilter = "all";

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
			goToCaseDetail(row.dataset.caseId, "cases");
		});
	});
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

async function initPage() {
	appData = await loadData();
	if (!appData) return;
	renderCases();
	setupCaseFilters();
}
