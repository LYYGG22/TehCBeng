// Small helpers shared by dashboard.js, cases.js, case-detail.js and reports.js.
// Relies on the global `appData` set by common.js's loadData().

function recordNumber(id) {
	const match = String(id).match(/(\d+)$/);
	return match ? Number(match[1]) : 0;
}

function extractKeywords(text) {
	const keywords = [
		"unauthorized", "transfer", "payee", "new", "card", "testing", "refund", "merchant",
		"device", "browser", "password", "reset", "transaction", "duplicate", "charge",
		"verification", "otp", "velocity", "geo", "fraud", "flagged", "frozen", "blocked",
		"reversed", "locked", "payout", "deposit", "payment", "high-value", "anomaly",
		"phishing", "social", "engineering", "sim", "swap", "mule", "identity", "chargeback",
		"travel", "country", "wallet", "fingerprint", "impersonat"
	];

	const found = [];
	const lowerText = text.toLowerCase();

	keywords.forEach(keyword => {
		if (lowerText.includes(keyword) && !found.includes(keyword)) {
			found.push(keyword);
		}
	});

	return found;
}

function matchPolicies(keywords, allPolicies) {
	const matched = [];

	allPolicies.forEach(policy => {
		const policyText = policy.summary.toLowerCase();
		let score = 0;

		keywords.forEach(keyword => {
			if (policyText.includes(keyword)) {
				score++;
			}
		});

		if (score > 0) {
			matched.push({
				id: policy.id,
				summary: policy.summary,
				relevance: score
			});
		}
	});

	return matched.sort((a, b) => b.relevance - a.relevance).slice(0, 3);
}

function casePolicyMatches(caseData) {
	const keywords = extractKeywords(`${caseData.original_message || ""} ${caseData.summary || ""}`);
	return matchPolicies(keywords, appData.policies || []);
}

function countBy(items, key) {
	return items.reduce((acc, item) => {
		const value = item[key] || "Unknown";
		acc[value] = (acc[value] || 0) + 1;
		return acc;
	}, {});
}

function severityRank(severity) {
	return { High: 0, Medium: 1, Low: 2 }[severity] ?? 3;
}

function renderBarChart(containerId, items) {
	const max = Math.max(...items.map((i) => i.value), 1);
	const el = document.getElementById(containerId);
	if (!items.length) {
		el.innerHTML = `<p class="text-muted">No data in your access scope.</p>`;
		return;
	}
	el.innerHTML = items
		.map(
			(item) => `
		<div class="bar-row">
			<span class="bar-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
			<div class="bar-track">
				<div class="bar-fill ${item.color}" style="width:${(item.value / max) * 100}%"></div>
			</div>
			<span class="bar-value">${item.value}</span>
		</div>`
		)
		.join("");
}
