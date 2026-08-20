function renderDashboard() {
	const { stats, cases, transactions, policies } = appData;

	document.getElementById("statsGrid").innerHTML = `
		<button type="button" class="stat-card clickable" data-dashboard-action="all-cases" title="View all cases">
			<div class="stat-card-header">
				<span class="stat-label">Total Cases</span>
				<div class="stat-icon blue">📋</div>
			</div>
			<div class="stat-value">${stats.total_cases}</div>
			<div class="stat-change">${stats.open_cases} currently open</div>
		</button>
		<button type="button" class="stat-card clickable" data-dashboard-action="flagged-transactions" title="View flagged transactions">
			<div class="stat-card-header">
				<span class="stat-label">Flagged Transactions</span>
				<div class="stat-icon red">⚠️</div>
			</div>
			<div class="stat-value">${stats.flagged_transactions}</div>
			<div class="stat-change">of ${stats.total_transactions} total</div>
		</button>
		<button type="button" class="stat-card clickable" data-dashboard-action="active-policies" title="View active policies">
			<div class="stat-card-header">
				<span class="stat-label">Active Policies</span>
				<div class="stat-icon green">📜</div>
			</div>
			<div class="stat-value" id="activePoliciesValue">${stats.policies}</div>
			<div class="stat-change">policies used in cases</div>
		</button>
		<button type="button" class="stat-card clickable" data-dashboard-action="resolved-cases" title="View resolved cases">
			<div class="stat-card-header">
				<span class="stat-label">Resolved Cases</span>
				<div class="stat-icon amber">✓</div>
			</div>
			<div class="stat-value">${stats.resolved_cases}</div>
			<div class="stat-change">investigations closed</div>
		</button>
	`;

	document.querySelectorAll("#statsGrid [data-dashboard-action]").forEach((card) => {
		card.addEventListener("click", () => {
			switch (card.dataset.dashboardAction) {
				case "all-cases":
					window.location.href = "cases.php";
					break;
				case "flagged-transactions":
					document.getElementById("flaggedTable").closest(".content-card")
						.scrollIntoView({ behavior: "smooth", block: "start" });
					break;
				case "active-policies":
					document.getElementById("policiesTable").closest(".content-card")
						.scrollIntoView({ behavior: "smooth", block: "start" });
					break;
				case "resolved-cases":
					window.location.href = "cases.php?filter=Resolved";
					break;
			}
		});
	});

	const activities = [
		...cases.map((c) => ({
			type: "case",
			record: c,
			sortOrder: recordNumber(c.id),
			dot: c.severity === "High" ? "red" : c.severity === "Low" ? "green" : "amber",
			text: `Case ${c.id}: ${c.type}`,
			meta: `${c.status} · ${c.severity} severity`,
		})),
		...transactions
			.filter((t) => t.flagged)
			.map((t) => ({
				type: "transaction",
				record: t,
				sortOrder: recordNumber(t.id),
				dot: t.risk === "High" ? "red" : t.risk === "Medium" ? "amber" : "green",
				text: `Transaction ${t.id} flagged`,
				meta: `$${t.amount} · ${t.risk} risk`,
			})),
	].sort((a, b) => b.sortOrder - a.sortOrder).slice(0, 5);

	document.getElementById("activityList").innerHTML = activities
		.map(
			(a) => `
		<button type="button" class="activity-item clickable" data-activity-type="${a.type}" data-record-id="${escapeHtml(a.record.id)}" title="View ${escapeHtml(a.record.id)} details">
			<div class="activity-dot ${a.dot}"></div>
			<div>
				<div class="activity-text">${escapeHtml(a.text)}</div>
				<div class="activity-meta">${escapeHtml(a.meta)}</div>
			</div>
		</button>`
		)
		.join("") || `<div class="empty-state">No recent activity in your access scope.</div>`;

	document.querySelectorAll("#activityList [data-activity-type]").forEach((item) => {
		item.addEventListener("click", () => {
			const id = item.dataset.recordId;
			if (item.dataset.activityType === "case") {
				goToCaseDetail(id, "dashboard");
			} else {
				goToRecordDetail("Transaction", id, "dashboard");
			}
		});
	});

	const flagged = transactions
		.filter((t) => t.flagged)
		.sort((a, b) => riskRank(a.risk) - riskRank(b.risk) || recordNumber(b.id) - recordNumber(a.id));
	document.getElementById("flaggedTable").innerHTML =
		flagged.length > 0
			? flagged
					.map(
						(t) => `
			<tr class="clickable" data-transaction-id="${escapeHtml(t.id)}" title="View ${escapeHtml(t.id)} details">
				<td><strong>${escapeHtml(t.id)}</strong></td>
				<td>$${escapeHtml(t.amount)}</td>
				<td><span class="badge ${badgeClass(t.risk, "risk")}">${t.risk}</span></td>
			</tr>`
					)
					.join("")
			: `<tr><td colspan="3" style="text-align:center;color:var(--ih-muted)">No flagged transactions</td></tr>`;

	document.querySelectorAll("#flaggedTable tr[data-transaction-id]").forEach((row) => {
		row.addEventListener("click", () => {
			goToRecordDetail("Transaction", row.dataset.transactionId, "dashboard");
		});
	});

	const activePolicies = policies
		.map((policy) => ({
			...policy,
			usedIn: cases.filter((caseData) =>
				casePolicyMatches(caseData).some((matched) => matched.id === policy.id)
			).length,
		}))
		.filter((policy) => policy.usedIn > 0)
		.sort((a, b) => b.usedIn - a.usedIn || a.id.localeCompare(b.id));
	document.getElementById("activePoliciesValue").textContent = activePolicies.length;

	document.getElementById("policiesTable").innerHTML = activePolicies.length
		? activePolicies
		.map(
			(p) => `
		<tr class="clickable" data-policy-id="${escapeHtml(p.id)}" title="View ${escapeHtml(p.id)} details">
			<td><strong>${escapeHtml(p.id)}</strong></td>
			<td><span class="badge ${categoryBadgeClass(p.category)}">${escapeHtml(p.category)}</span></td>
			<td>${p.usedIn} case${p.usedIn === 1 ? "" : "s"}</td>
			<td>${escapeHtml(p.summary)}</td>
		</tr>`
		)
		.join("")
		: `<tr><td colspan="4" style="text-align:center;color:var(--ih-muted)">No active policies in your access scope</td></tr>`;

	document.querySelectorAll("#policiesTable tr[data-policy-id]").forEach((row) => {
		row.addEventListener("click", () => {
			goToRecordDetail("Policy", row.dataset.policyId, "dashboard");
		});
	});
}

async function initPage() {
	appData = await loadData();
	if (!appData) return;
	renderDashboard();
}
