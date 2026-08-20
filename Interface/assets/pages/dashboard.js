function renderDashboard() {
	const { stats, cases, transactions, policies } = appData;

	document.getElementById("statsGrid").innerHTML = `
		<div class="stat-card">
			<div class="stat-card-header">
				<span class="stat-label">Total Cases</span>
				<div class="stat-icon blue">📋</div>
			</div>
			<div class="stat-value">${stats.total_cases}</div>
			<div class="stat-change">${stats.open_cases} currently open</div>
		</div>
		<div class="stat-card">
			<div class="stat-card-header">
				<span class="stat-label">Flagged Transactions</span>
				<div class="stat-icon red">⚠️</div>
			</div>
			<div class="stat-value">${stats.flagged_transactions}</div>
			<div class="stat-change">of ${stats.total_transactions} total</div>
		</div>
		<div class="stat-card">
			<div class="stat-card-header">
				<span class="stat-label">Active Policies</span>
				<div class="stat-icon green">📜</div>
			</div>
			<div class="stat-value">${stats.policies}</div>
			<div class="stat-change">compliance rules enforced</div>
		</div>
		<div class="stat-card">
			<div class="stat-card-header">
				<span class="stat-label">Resolved Cases</span>
				<div class="stat-icon amber">✓</div>
			</div>
			<div class="stat-value">${stats.resolved_cases}</div>
			<div class="stat-change">investigations closed</div>
		</div>
	`;

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
				dot: "red",
				text: `Transaction ${t.id} flagged`,
				meta: `$${t.amount} · High risk`,
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

	const flagged = transactions.filter((t) => t.flagged);
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

	document.getElementById("policiesTable").innerHTML = activePolicies.length
		? activePolicies
		.map(
			(p) => `
		<tr class="clickable" data-policy-id="${escapeHtml(p.id)}" title="View ${escapeHtml(p.id)} details">
			<td><strong>${escapeHtml(p.id)}</strong></td>
			<td>${escapeHtml(p.category)}</td>
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
