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

}

function setupExportReport() {
	document.getElementById("exportReportBtn").addEventListener("click", () => {
		const report = buildStaffReport();
		const format = document.getElementById("reportExportFormat").value;
		if (format === "excel") {
			downloadReportBlob(new Blob([buildReportExcel(report)], { type: "application/vnd.ms-excel;charset=utf-8" }), "intellihub-staff-report.xls");
			return;
		}
		downloadReportBlob(new Blob([buildReportPdf(report)], { type: "application/pdf" }), "intellihub-staff-report.pdf");
	});
}

function downloadReportBlob(blob, filename) {
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = filename;
	link.click();
	URL.revokeObjectURL(link.href);
}

function buildReportExcel(report) {
	const escapeXml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
	const cell = (value, style = "Cell") => `<Cell ss:StyleID="${style}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
	const row = (values, style) => `<Row>${values.map((value) => cell(value, style)).join("")}</Row>`;
	const section = (title) => `<Row ss:Height="8"></Row><Row>${cell(title, "Section")}</Row>`;
	const metrics = [["Cases in scope", report.cases.length], ["Open", report.openCases.length], ["Resolved", report.resolvedCases.length], ["Resolution rate", `${report.resolutionRate}%`], ["Flagged transactions", report.flagged.length]];
	return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Cell"><Font ss:FontName="Calibri" ss:Size="10"/></Style><Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2563EB" ss:Pattern="Solid"/></Style><Style ss:ID="Section"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1E3A8A"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/></Style><Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2563EB" ss:Pattern="Solid"/></Style><Style ss:ID="Wrap"><Font ss:FontName="Calibri" ss:Size="10"/><Alignment ss:WrapText="1" ss:Vertical="Top"/></Style></Styles><Worksheet ss:Name="Investigation Report"><Table><Column ss:Width="150"/><Column ss:Width="320"/><Column ss:Width="115"/><Column ss:Width="115"/><Row ss:Height="30">${cell("IntelliHub Staff Investigation Report", "Title")}</Row>${row(["Generated", report.generatedAt], "Wrap")}${section("Workload")}${metrics.map((item) => row(item, "Cell")).join("")}${section("Staff Priority Queue")}${row(["Case ID", "Type", "Severity", "Matched policies"], "Header")}${report.queue.length ? report.queue.map((item) => row([item.id, item.type, item.severity, item.policyCount], "Cell")).join("") : row(["No open cases awaiting staff action"], "Wrap")}${section("Findings")}${report.findings.map((item) => row([item.title, item.text], "Wrap")).join("")}${section("Recommended Actions")}${report.actions.map((item, index) => row([`${index + 1}.`, item], "Wrap")).join("")}</Table></Worksheet></Workbook>`;
}

function buildReportPdf(report) {
	const pages = [];
	let commands = "";
	let y = 695;
	const startPage = () => {
		if (commands) pages.push(commands);
		commands = "0.145 0.388 0.922 rg\n0 720 612 72 re f\n";
		commands += pdfText("IntelliHub Staff Investigation Report", 50, 752, 18, "F2", "1 1 1");
		commands += pdfText(`Generated ${report.generatedAt}`, 50, 733, 9, "F1", "0.86 0.92 1");
		y = 695;
	};
	const addLine = (text, style = "body") => {
		const settings = { section: [12, "F2", "0.118 0.227 0.541", 22], label: [10, "F2", "0.12 0.12 0.15", 16], body: [10, "F1", "0.2 0.24 0.31", 15] }[style];
		if (style === "section" && y < 685) y -= 7;
		wrapPdfText(text, 85).forEach((line) => {
			if (y < 62) startPage();
			commands += pdfText(line, 50, y, settings[0], settings[1], settings[2]);
			y -= settings[3];
		});
	};
	startPage();
	addLine("Workload", "section");
	[["Cases in scope", report.cases.length], ["Open", report.openCases.length], ["Resolved", report.resolvedCases.length], ["Resolution rate", `${report.resolutionRate}%`], ["Flagged transactions", report.flagged.length]].forEach(([label, value]) => addLine(`${label}: ${value}`));
	addLine("Staff Priority Queue", "section");
	if (report.queue.length) report.queue.forEach((item) => addLine(`${item.id}  |  ${item.type}  |  ${item.severity} severity  |  ${item.policyCount} policies matched`));
	else addLine("No open cases awaiting staff action.");
	addLine("Findings", "section");
	report.findings.forEach((item) => { addLine(item.title, "label"); addLine(item.text); });
	addLine("Recommended Actions", "section");
	report.actions.forEach((item, index) => addLine(`${index + 1}. ${item}`));
	pages.push(commands);
	const objects = [];
	objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
	objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
	objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
	const pageIds = [];
	pages.forEach((content, index) => {
		const pageId = 5 + index * 2;
		const contentId = pageId + 1;
		pageIds.push(`${pageId} 0 R`);
		objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
		objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
	});
	objects[2] = `<< /Type /Pages /Kids [${pageIds.join(" ")}] /Count ${pages.length} >>`;

	let pdf = "%PDF-1.4\n";
	const offsets = [0];
	for (let id = 1; id < objects.length; id += 1) {
		offsets[id] = pdf.length;
		pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
	}
	const xrefOffset = pdf.length;
	pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
	for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
	pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
	return pdf;
}

function pdfText(text, x, y, size, font, color) {
	return `BT /${font} ${size} Tf ${color} rg ${x} ${y} Td (${escapePdfText(text)}) Tj ET\n`;
}

function wrapPdfText(text, maxLength) {
	const words = String(text).split(/\s+/);
	const lines = [];
	let line = "";
	words.forEach((word) => {
		if (`${line} ${word}`.trim().length > maxLength && line) { lines.push(line); line = word; }
		else line = `${line} ${word}`.trim();
	});
	if (line) lines.push(line);
	return lines;
}

function escapePdfText(text) {
	return String(text)
		.normalize("NFKD")
		.replace(/[^\x20-\x7E]/g, "")
		.replace(/([\\()])/g, "\\$1");
}

async function initPage() {
	appData = await loadData();
	if (!appData) return;
	renderReports();
	setupExportReport();
}
