function buildStaffReport() {
	const cases = appData.cases || [];
	const transactions = appData.transactions || [];
	const policies = appData.policies || [];
	const openCases = cases.filter((c) => c.status === "Open");
	const resolvedCases = cases.filter((c) => c.status === "Resolved");
	const openHigh = openCases.filter((c) => c.severity === "High");
	const flagged = transactions
		.filter((t) => t.flagged)
		.sort((a, b) => riskRank(a.risk) - riskRank(b.risk) || recordNumber(b.id) - recordNumber(a.id));
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
		row.addEventListener("click", () => goToCaseDetail(row.dataset.caseId, "reports"));
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

async function initPage() {
	appData = await loadData();
	if (!appData) return;
	renderReports();
	setupExportReport();
}
