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
		`${currentUser?.role === "Manager" ? "Management" : "Staff"} view · generated ${report.generatedAt}`;

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
				<span class="stat-label">Flagged Transactions</span>
				<div class="stat-icon red">!</div>
			</div>
			<div class="stat-value">${flagged.length}</div>
			<div class="stat-change">requires transaction review</div>
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

	const priorityCases = report.queue.slice(0, 5);
	document.getElementById("reportPriorityNote").textContent = report.queue.length > 5
		? `Showing top 5 of ${report.queue.length} open cases`
		: "Open cases, highest severity first";
	document.getElementById("reportPriorityTable").innerHTML = priorityCases.length
		? priorityCases
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

	renderManagerBrief(report);

}

function transactionAmount(text) {
	const amount = String(text || "").match(/\$([\d,]+)/);
	return amount ? Number(amount[1].replace(/,/g, "")) : 0;
}

function getManagerReportDetails(report) {
	const highSeverityOpen = report.cases
		.filter((caseData) => caseData.severity === "High" && caseData.status !== "Resolved")
		.sort((a, b) => transactionAmount(b.summary) - transactionAmount(a.summary));
	return {
		highSeverityOpen,
		exposure: highSeverityOpen.reduce((total, caseData) => total + transactionAmount(caseData.summary), 0),
		highRiskFlagged: report.transactions.filter((transaction) => transaction.flagged && transaction.risk === "High"),
		inProgress: report.cases.filter((caseData) => caseData.status === "In Progress"),
	};
}

function renderManagerBrief(report) {
	const brief = document.getElementById("managerReportBrief");
	if (!brief) return;

	const { highSeverityOpen, exposure, highRiskFlagged, inProgress } = getManagerReportDetails(report);

	document.getElementById("managerBriefNote").textContent =
		`${highSeverityOpen.length} priority escalation${highSeverityOpen.length === 1 ? "" : "s"} require management visibility.`;
	document.getElementById("managerBriefMetrics").innerHTML = `
		<div><span>High-risk exposure</span><strong>$${exposure.toLocaleString()}</strong><small>Open high-severity cases</small></div>
		<div><span>High-risk flagged</span><strong>${highRiskFlagged.length}</strong><small>Transactions requiring review</small></div>
		<div><span>In progress</span><strong>${inProgress.length}</strong><small>Cases with an active workstream</small></div>
		<div><span>Resolution rate</span><strong>${report.resolutionRate}%</strong><small>Cases resolved in your scope</small></div>`;

	const managerRiskCases = highSeverityOpen.slice(0, 5);
	document.getElementById("managerRiskNote").textContent = highSeverityOpen.length > 5
		? `Top 5 of ${highSeverityOpen.length}`
		: `${highSeverityOpen.length} case${highSeverityOpen.length === 1 ? "" : "s"}`;
	document.getElementById("managerRiskRegister").innerHTML = managerRiskCases.length
		? managerRiskCases.map((caseData) => `
			<tr data-case-id="${escapeHtml(caseData.id)}" style="cursor:pointer;">
				<td><strong>${escapeHtml(caseData.id)}</strong></td>
				<td>${escapeHtml(caseData.type)}</td>
				<td>$${transactionAmount(caseData.summary).toLocaleString()}</td>
				<td><span class="badge ${badgeClass(caseData.status, "status")}">${escapeHtml(caseData.status)}</span></td>
			</tr>`).join("")
		: `<tr><td colspan="4" style="text-align:center;color:var(--ih-muted)">No open high-severity cases</td></tr>`;

	document.querySelectorAll("#managerRiskRegister tr[data-case-id]").forEach((row) => {
		row.addEventListener("click", () => goToCaseDetail(row.dataset.caseId, "reports"));
	});
}

function setupExportReport() {
	document.getElementById("exportReportBtn").addEventListener("click", () => {
		const report = buildStaffReport();
		const format = document.getElementById("reportExportFormat").value;
		const reportName = currentUser?.role === "Manager" ? "intellihub-management-report" : "intellihub-staff-report";
		if (format === "excel") {
			downloadReportBlob(new Blob([buildReportExcel(report)], { type: "application/vnd.ms-excel;charset=utf-8" }), `${reportName}.xls`);
			return;
		}
		downloadReportBlob(new Blob([buildReportPdf(report)], { type: "application/pdf" }), `${reportName}.pdf`);
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
	const wideRow = (value, style) => `<Row>${`<Cell ss:MergeAcross="3" ss:StyleID="${style}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`}</Row>`;
	const section = (title) => `<Row ss:Height="8"></Row>${wideRow(title, "Section")}`;
	const viewName = currentUser?.role === "Manager" ? "Management" : "Staff";
	const metrics = [["Cases in scope", report.cases.length], ["Open cases", report.openCases.length], ["High severity open", report.openHigh.length], ["Resolution rate", `${report.resolutionRate}%`], ["Flagged transactions", report.flagged.length]];
	const priorityCases = report.queue.slice(0, 5);
	const managerDetails = getManagerReportDetails(report);
	const managerSection = viewName === "Management" ? `${section("Management risk register")}${row(["Case ID", "Type", "Amount", "Status"], "Header")}${managerDetails.highSeverityOpen.length ? managerDetails.highSeverityOpen.slice(0, 5).map((item) => row([item.id, item.type, `$${transactionAmount(item.summary).toLocaleString()}`, item.status], "Cell")).join("") : wideRow("No open high-severity cases", "Wrap")}${section("Management attention")}${row(["High-risk exposure", `$${managerDetails.exposure.toLocaleString()}`], "MetricLabel")}${row(["High-risk flagged transactions", managerDetails.highRiskFlagged.length], "MetricLabel")}${row(["Active workstreams", managerDetails.inProgress.length], "MetricLabel")}` : "";
	return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Cell"><Font ss:FontName="Calibri" ss:Size="10"/><Alignment ss:Vertical="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders></Style><Style ss:ID="Title"><Font ss:FontName="Calibri" ss:Size="18" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#1E3A8A" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style><Style ss:ID="Subtitle"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#475569"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/></Style><Style ss:ID="Section"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1E3A8A"/><Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style><Style ss:ID="Header"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2563EB" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style><Style ss:ID="MetricLabel"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#475569"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders></Style><Style ss:ID="MetricValue"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#1E3A8A"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders></Style><Style ss:ID="Wrap"><Font ss:FontName="Calibri" ss:Size="10"/><Alignment ss:WrapText="1" ss:Vertical="Top"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/></Borders></Style></Styles><Worksheet ss:Name="Investigation Report"><Table><Column ss:Width="120"/><Column ss:Width="280"/><Column ss:Width="115"/><Column ss:Width="115"/><Row ss:Height="32"><Cell ss:MergeAcross="3" ss:StyleID="Title"><Data ss:Type="String">IntelliHub ${viewName} Investigation Report</Data></Cell></Row>${wideRow(`Generated ${report.generatedAt} | Confidential internal report`, "Subtitle")}${section("Risk and workload snapshot")}${metrics.map(([label, value]) => `<Row>${cell(label, "MetricLabel")}${cell(value, "MetricValue")}</Row>`).join("")}${managerSection}${section(`Priority queue - top ${priorityCases.length} of ${report.queue.length}`)}${row(["Case ID", "Type", "Severity", "Matched policies"], "Header")}${priorityCases.length ? priorityCases.map((item) => row([item.id, item.type, item.severity, item.policyCount], "Cell")).join("") : wideRow("No open cases awaiting staff action", "Wrap")}${section("Key findings")}${report.findings.map((item) => `<Row>${cell(item.title, "Header")}${cell(item.text, "Wrap")}</Row>`).join("")}${section("Recommended actions")}${report.actions.map((item, index) => `<Row>${cell(`${index + 1}.`, "MetricValue")}${cell(item, "Wrap")}</Row>`).join("")}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>5</SplitHorizontal><TopRowBottomPane>5</TopRowBottomPane></WorksheetOptions></Worksheet></Workbook>`;
}

function buildReportPdf(report) {
	const pages = [];
	let commands = "";
	let y = 675;
	const viewName = currentUser?.role === "Manager" ? "Management" : "Staff";
	const startPage = () => {
		if (commands) pages.push(commands);
		commands = "0.118 0.227 0.541 rg\n0 710 612 82 re f\n";
		commands += pdfText(`IntelliHub ${viewName} Investigation Report`, 50, 753, 18, "F2", "1 1 1");
		commands += pdfText(`Generated ${report.generatedAt}  |  Confidential internal report`, 50, 733, 9, "F1", "0.86 0.92 1");
		commands += "0.86 0.92 1 rg\n50 704 512 1 re f\n";
		y = 675;
	};
	const addLine = (text, style = "body") => {
		const settings = { section: [12, "F2", "0.118 0.227 0.541", 22], label: [10, "F2", "0.12 0.12 0.15", 16], body: [10, "F1", "0.2 0.24 0.31", 15] }[style];
		if (style === "section" && y < 665) y -= 8;
		wrapPdfText(text, 85).forEach((line) => {
			if (y < 62) startPage();
			commands += pdfText(line, 50, y, settings[0], settings[1], settings[2]);
			y -= settings[3];
		});
	};
	const addKpiCards = (items) => {
		items.forEach(([label, value], index) => {
			const x = 50 + index * 170;
			commands += `0.94 0.97 1 rg\n${x} 608 154 48 re f\n`;
			commands += `0.75 0.84 0.97 RG\n${x} 608 154 48 re S\n`;
			commands += pdfText(label, x + 10, 641, 8, "F1", "0.28 0.36 0.48");
			commands += pdfText(value, x + 10, 620, 16, "F2", "0.118 0.227 0.541");
		});
		y = 585;
	};
	startPage();
	if (viewName === "Management") {
		const managerDetails = getManagerReportDetails(report);
		addKpiCards([
			["High-risk exposure", `$${managerDetails.exposure.toLocaleString()}`],
			["High-risk flagged", String(managerDetails.highRiskFlagged.length)],
			["Active workstreams", String(managerDetails.inProgress.length)],
		]);
		addLine("Management risk register", "section");
		if (managerDetails.highSeverityOpen.length) {
			managerDetails.highSeverityOpen.slice(0, 5).forEach((item) => addLine(`${item.id}  |  ${item.type}  |  $${transactionAmount(item.summary).toLocaleString()}  |  ${item.status}`));
		} else {
			addLine("No open high-severity cases.");
		}
	} else {
		addKpiCards([
			["Open cases", String(report.openCases.length)],
			["High severity", String(report.openHigh.length)],
			["Resolution rate", `${report.resolutionRate}%`],
		]);
	}
	addLine("Risk and workload snapshot", "section");
	[["Cases in scope", report.cases.length], ["Open cases", report.openCases.length], ["High severity open", report.openHigh.length], ["Resolution rate", `${report.resolutionRate}%`], ["Flagged transactions", report.flagged.length]].forEach(([label, value]) => addLine(`${label}: ${value}`));
	addLine(`${viewName === "Management" ? "Management" : "Staff"} priority queue - top ${Math.min(report.queue.length, 5)} of ${report.queue.length}`, "section");
	if (report.queue.length) report.queue.slice(0, 5).forEach((item) => addLine(`${item.id}  |  ${item.type}  |  ${item.severity} severity  |  ${item.policyCount} policies matched`));
	else addLine("No open cases awaiting staff action.");
	addLine("Findings", "section");
	report.findings.forEach((item) => { addLine(item.title, "label"); addLine(item.text); });
	const recommendedActionLines = report.actions.reduce(
		(total, action) => total + Math.max(1, Math.ceil(`${action}`.length / 85)),
		0
	);
	if (y < 60 + recommendedActionLines * 15) startPage();
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
