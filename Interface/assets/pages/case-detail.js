function getDemoCustomerName(caseId) {
	const names = [
		"Aina Rahman", "Daniel Lim", "Priya Nair", "Jason Tan", "Nurul Huda",
		"Marcus Lee", "Siti Farah", "Kavin Raj", "Mei Ling Wong", "Hafiz Ismail",
		"Chloe Ong", "Amirul Hakim", "Rina Kaur", "Ethan Goh", "Sofia Aziz",
		"Bryan Teo", "Nadia Karim", "Kelvin Chua", "Izzati Noor", "Ryan Yap",
	];
	const caseNumber = Number(caseId.match(/\d+/)?.[0] || 1);
	return names[(caseNumber - 1) % names.length];
}

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

	const managerInsights = document.getElementById("managerCaseInsights");
	if (managerInsights) {
		const caseNumber = caseId.match(/\d+/)?.[0]?.padStart(5, "0") || "00000";
		const caseText = `${originalMessage} ${caseData.summary || ""}`;
		const amount = caseText.match(/\$[\d,]+/)?.[0] || "No amount recorded";
		const accountStatus = /locked|frozen|blocked/i.test(caseText) ? "Protected / restricted" : "Review required";

		document.getElementById("managerCustomerAccount").innerHTML = `
			<div class="suggestion-item"><strong>Account number</strong>${escapeHtml(caseData.account_number || `ACC-${caseNumber}`)}</div>
			<div class="suggestion-item"><strong>Customer name</strong>${escapeHtml(caseData.customer_name || getDemoCustomerName(caseId))}</div>
			<div class="suggestion-item"><strong>Account status</strong>${escapeHtml(accountStatus)}</div>`;

		const abnormalTransactionPanel = document.getElementById("managerAbnormalTransactionPanel");
		abnormalTransactionPanel.hidden = caseData.severity !== "High";
		if (caseData.severity === "High") {
			document.getElementById("managerAbnormalTransaction").innerHTML = `
				<div class="suggestion-item"><strong>Abnormal transaction amount</strong>${escapeHtml(amount)}</div>`;
		}
	}

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
	const isInProgress = caseData.status === "In Progress";
	const actionButtons = document.querySelector("#caseDetailActionsSection .case-actions");
	const assignedDepartment = caseData.assigned_department || recommendedDepartment;
	document.getElementById("caseDetailActionsTitle").textContent = isInProgress ? "Department Routing" : isResolved ? "Case Status" : "Case Actions";
	document.getElementById("caseDetailActionHelper").textContent = isResolved
		? "This case has been resolved. No further action is required."
		: isInProgress
			? `Case sent to ${assignedDepartment} department and currently in progress.`
		: needsDepartmentRecommendation
			? `This ${caseData.severity.toLowerCase()}-severity case should be handled by ${recommendedDepartment}.`
			: "Resolve the case when the investigation is complete, or route it to the responsible department.";
	actionButtons.hidden = isInProgress || isResolved;
	document.getElementById("resolveCaseBtn").disabled = isResolved;
	document.getElementById("resolveCaseBtn").textContent = isResolved ? "Case resolved" : "Mark as resolved";
	document.getElementById("forwardCaseBtn").disabled = isResolved;
	document.getElementById("forwardCaseBtn").textContent = `Send to ${recommendedDepartment}`;
	document.getElementById("caseDetailActionFeedback").textContent = "";
	document.getElementById("caseDetailActionFeedback").className = "case-action-feedback";
	document.getElementById("resolveCaseBtn").onclick = () => performCaseAction(caseId, "resolve");
	document.getElementById("forwardCaseBtn").onclick = () => performCaseAction(caseId, "forward");
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

async function initPage() {
	const caseId = new URLSearchParams(window.location.search).get("id") || "";
	appData = await loadData();
	if (!appData) return;
	renderCaseDetail(caseId);
}
