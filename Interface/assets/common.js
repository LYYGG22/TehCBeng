// Loaded on every page. Handles auth, the shared top-of-page bootstrap, the
// floating chat widget, the document viewer modal, and the chat rendering
// logic shared between the widget and chatbot.php's full chat view.
//
// Each page defines its own `initPage()` (in assets/pages/<name>.js) which
// this file's bootstrap calls once auth/chrome setup is done.

const API_BASE = "../Logic";

let appData = null;
let currentUser = null;
let isLoading = false;
let chatHistory = [];
let widgetOpen = false;

const CHAT_CONTAINERS = {
	full: { messagesId: "chatbotMessages", welcomeId: "chatbotWelcome", inputId: "chatbotInput", sendId: "chatbotSendBtn" },
	widget: { messagesId: "widgetMessages", welcomeId: "widgetWelcome", inputId: "widgetInput", sendId: "widgetSendBtn" },
};

async function checkAuth() {
	const res = await fetch(`${API_BASE}/auth.php?action=check`, {
		credentials: "include",
	});
	const data = await res.json();
	if (!data.authenticated) {
		window.location.href = "login.html";
		return null;
	}
	return data.user;
}

function initUser(user) {
	currentUser = user;
	const initials = user.name
		.split(" ")
		.map((w) => w[0])
		.join("")
		.toUpperCase();
	document.getElementById("userName").textContent = user.name;
	document.getElementById("userRole").textContent = user.role;
	document.getElementById("userAvatar").textContent = initials;
}

function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

function badgeClass(value, type) {
	const map = {
		status: { Open: "badge-open", "In Progress": "badge-in-progress", Resolved: "badge-resolved" },
		severity: { High: "badge-high", Medium: "badge-medium", Low: "badge-low" },
		risk: { High: "badge-flagged", Medium: "badge-medium", Low: "badge-clear" },
	};
	return map[type]?.[value] || "";
}

// Policy categories (Geo-Velocity, Card Testing, ...) have no natural severity
// order like status/risk do, so they don't get red/amber/green — instead each
// category name deterministically picks one of a small set of neutral tag
// colors, so the same category always looks the same everywhere it appears.
const CATEGORY_BADGE_COLORS = ["badge-tag-purple", "badge-tag-teal", "badge-tag-orange", "badge-tag-pink", "badge-tag-cyan", "badge-tag-slate"];
function categoryBadgeClass(category) {
	if (!category) return "";
	let hash = 0;
	for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) | 0;
	return CATEGORY_BADGE_COLORS[Math.abs(hash) % CATEGORY_BADGE_COLORS.length];
}

async function loadData() {
	const res = await fetch(`${API_BASE}/data.php?action=all`, {
		credentials: "include",
	});
	if (res.status === 401) {
		window.location.href = "login.html";
		return null;
	}
	return res.json();
}

function canManageTransactionFlags() {
	return Boolean(currentUser);
}

// Posts the flag toggle and refreshes the shared `appData`. Callers are
// responsible for re-rendering whatever's actually on their page afterward —
// unlike the pre-split version, no page has every view mounted at once.
async function toggleTransactionFlag(id) {
	const response = await fetch(`${API_BASE}/data.php?action=toggle_transaction_flag`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ id }),
	});
	const result = await response.json();
	if (!response.ok) {
		alert(result.error || "Unable to update transaction flag.");
		return false;
	}
	appData = result.data;
	return true;
}

function goToCaseDetail(id, from) {
	window.location.href = `case-detail.php?id=${encodeURIComponent(id)}&from=${encodeURIComponent(from)}`;
}

function goToRecordDetail(type, id, from) {
	window.location.href = `record-detail.php?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}&from=${encodeURIComponent(from)}`;
}

async function logout() {
	await fetch(`${API_BASE}/auth.php?action=logout`, {
		method: "POST",
		credentials: "include",
	});
	window.location.href = "login.html";
}

// ── Document Viewer Modal ──

async function openDocumentViewer(docId) {
	const overlay = document.getElementById("docModalOverlay");
	const titleEl = document.getElementById("docModalTitle");
	const metaEl = document.getElementById("docModalMeta");
	const bodyEl = document.getElementById("docModalBody");
	const openFileBtn = document.getElementById("docModalOpenFile");

	overlay.classList.remove("hidden");
	titleEl.textContent = "Loading…";
	metaEl.textContent = "";
	bodyEl.innerHTML = `<div class="doc-modal-loading">Loading document…</div>`;
	openFileBtn.classList.add("hidden");

	try {
		const res = await fetch(
			`${API_BASE}/document.php?action=view&id=${encodeURIComponent(docId)}`,
			{ credentials: "include" }
		);
		const data = await res.json();

		if (!res.ok) {
			throw new Error(data.error || "Unable to load document.");
		}

		titleEl.textContent = data.title;
		const updated = formatSourceDate(data.last_updated);
		metaEl.innerHTML = `
			<span class="badge badge-clear">${escapeHtml(data.category)}</span>
			<span>${escapeHtml(data.id)}</span>
			${data.file_name ? `<span>${escapeHtml(data.file_name)}</span>` : ""}
			${updated ? `<span>Last updated ${escapeHtml(updated)}</span>` : ""}
		`;

		if (data.preview_type === "pdf" && data.file_url) {
			bodyEl.innerHTML = `<iframe src="${data.file_url}" title="${escapeHtml(data.title)}"></iframe>`;
			openFileBtn.href = data.file_url;
			openFileBtn.classList.remove("hidden");
		} else {
			bodyEl.innerHTML = `<div class="doc-modal-text">${escapeHtml(data.text)}</div>`;
			if (data.file_url) {
				openFileBtn.href = data.file_url;
				openFileBtn.classList.remove("hidden");
			}
		}
	} catch (err) {
		titleEl.textContent = "Document unavailable";
		metaEl.textContent = docId;
		bodyEl.innerHTML = `<div class="doc-modal-loading">${escapeHtml(err.message)}</div>`;
	}
}

function closeDocumentViewer() {
	document.getElementById("docModalOverlay").classList.add("hidden");
}

function setupDocumentViewer() {
	document.getElementById("docModalClose").addEventListener("click", closeDocumentViewer);
	document.getElementById("docModalCloseFooter").addEventListener("click", closeDocumentViewer);
	document.getElementById("docModalOverlay").addEventListener("click", (e) => {
		if (e.target.id === "docModalOverlay") closeDocumentViewer();
	});

	document.addEventListener("click", (e) => {
		const tag = e.target.closest(".source-tag[data-source-id]");
		if (tag) openDocumentViewer(tag.dataset.sourceId);
	});

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") closeDocumentViewer();
	});
}

// ── Chat (shared by the floating widget and chatbot.php) ──

function hideWelcome(welcomeId) {
	const el = document.getElementById(welcomeId);
	if (el) el.style.display = "none";
}

function sourceLabel(source) {
	if (typeof source === "string") return source;
	if (source && typeof source === "object") {
		return source.file_name || source.title || source.id || "Document";
	}
	return String(source);
}

function sourceId(source) {
	if (typeof source === "string") return source;
	if (source && typeof source === "object") return source.id || source.title || "";
	return String(source);
}

function formatSourceDate(dateStr) {
	if (!dateStr) return "";
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return "";
	return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function buildSourceTagsHtml(sources = []) {
	if (!sources.length) return "";
	return `<div class="message-sources">${sources
		.map((source) => {
			const id = sourceId(source);
			const label = sourceLabel(source);
			const confidence = typeof source === "object" ? source.confidence : null;
			const updated = formatSourceDate(typeof source === "object" ? source.last_updated : null);

			const metaParts = [];
			if (confidence !== null && confidence !== undefined) {
				metaParts.push(`<span class="source-tag-confidence">${escapeHtml(String(confidence))}% match</span>`);
			}
			if (updated) {
				metaParts.push(`<span class="source-tag-updated">Updated ${escapeHtml(updated)}</span>`);
			}
			const metaHtml = metaParts.length
				? `<span class="source-tag-meta">${metaParts.join('<span class="source-tag-dot">·</span>')}</span>`
				: "";

			return `<button type="button" class="source-tag" data-source-id="${escapeHtml(id)}" title="View ${escapeHtml(label)}">
				<span class="source-tag-label">${escapeHtml(label)}</span>
				${metaHtml}
			</button>`;
		})
		.join("")}</div>`;
}

function renderBold(escapedText) {
	return escapedText.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

// Bot answers come back as Markdown, so bullets, numbered steps and headings
// render as real blocks instead of one long line. The text is escaped first so
// any raw HTML in the model output is shown, never executed. Falls back to
// bold-only rendering if marked.js did not load.
function renderBotText(text) {
	const escaped = escapeHtml(text);
	if (typeof marked !== "undefined") {
		return marked.parse(escaped, { breaks: true, gfm: true });
	}
	return renderBold(escaped).replace(/\n/g, "<br>");
}

function confidenceLevel(confidence) {
	if (confidence >= 70) return "high";
	if (confidence >= 40) return "medium";
	return "low";
}

// Progress bar shown under a bot answer, reporting how well the retrieved
// sources matched the question.
function buildConfidenceHtml(confidence) {
	if (confidence === null || confidence === undefined || isNaN(confidence)) return "";

	const pct = Math.max(0, Math.min(100, Math.round(confidence)));
	const level = confidenceLevel(pct);

	return `
		<div class="answer-confidence answer-confidence-${level}">
			<div class="answer-confidence-head">
				<span class="answer-confidence-label">Confidence</span>
				<span class="answer-confidence-value">${pct}%</span>
			</div>
			<div class="answer-confidence-track" role="progressbar" aria-label="Answer confidence"
				aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
				<div class="answer-confidence-fill" style="width: ${pct}%"></div>
			</div>
		</div>`;
}

// Told apart from a plain "no results" answer: this fires only when
// permission-aware retrieval actually dropped a matching record for the
// current user's role before it reached the AI.
function buildRestrictedNoteHtml(restrictedCount) {
	if (!restrictedCount) return "";
	const plural = restrictedCount === 1 ? "record" : "records";
	return `<div class="answer-restricted-note">${restrictedCount} matching ${plural} withheld — restricted to a higher access level</div>`;
}

function buildMessageHtml(role, text, sources = [], confidence = null, restrictedCount = 0) {
	const isBot = role === "bot";
	const sourcesHtml = isBot ? buildSourceTagsHtml(sources) : "";
	const confidenceHtml = isBot ? buildConfidenceHtml(confidence) : "";
	const restrictedHtml = isBot ? buildRestrictedNoteHtml(restrictedCount) : "";
	const bubbleContent = isBot ? renderBotText(text) : escapeHtml(text);
	return `
		<div class="message-avatar">${role === "user" ? "You" : "IH"}</div>
		<div class="message-content">
			<div class="message-bubble${isBot ? " message-bubble-rich" : ""}">${bubbleContent}</div>
			${confidenceHtml}
			${restrictedHtml}
			${sourcesHtml}
		</div>`;
}

function renderChatContainer(containerKey) {
	const cfg = CHAT_CONTAINERS[containerKey];
	if (!cfg) return;

	const chat = document.getElementById(cfg.messagesId);
	if (!chat) return;

	if (chatHistory.length === 0) {
		const welcome = document.getElementById(cfg.welcomeId);
		if (welcome) welcome.style.display = "";
		chat.querySelectorAll(".message, .typing-indicator-wrap").forEach((el) => el.remove());
		return;
	}

	hideWelcome(cfg.welcomeId);
	chat.querySelectorAll(".message, .typing-indicator-wrap").forEach((el) => el.remove());

	chatHistory.forEach(({ role, text, sources, confidence, restrictedCount }) => {
		const msg = document.createElement("div");
		msg.className = `message ${role}`;
		msg.innerHTML = buildMessageHtml(role, text, sources, confidence, restrictedCount);
		chat.appendChild(msg);
	});

	chat.scrollTop = chat.scrollHeight;
}

function renderAllChats() {
	renderChatContainer("full");
	renderChatContainer("widget");
}

function appendMessage(role, text, sources = [], confidence = null, restrictedCount = 0) {
	chatHistory.push({ role, text, sources, confidence, restrictedCount });
	renderAllChats();
}

function showTyping() {
	["full", "widget"].forEach((key) => {
		const cfg = CHAT_CONTAINERS[key];
		const chat = document.getElementById(cfg.messagesId);
		if (!chat) return;

		hideWelcome(cfg.welcomeId);
		if (chat.querySelector(`#typingIndicator-${key}`)) return;

		const msg = document.createElement("div");
		msg.className = "message bot typing-indicator-wrap";
		msg.id = `typingIndicator-${key}`;
		msg.innerHTML = `
			<div class="message-avatar">IH</div>
			<div class="message-content">
				<div class="typing-indicator"><span></span><span></span><span></span></div>
			</div>`;
		chat.appendChild(msg);
		chat.scrollTop = chat.scrollHeight;
	});
}

function hideTyping() {
	document.querySelectorAll(".typing-indicator-wrap").forEach((el) => el.remove());
}

async function sendQuery(inputId, sendBtnId) {
	if (isLoading) return;

	const input = document.getElementById(inputId);
	const query = input.value.trim();
	if (!query) return;

	input.value = "";
	input.style.height = "auto";

	appendMessage("user", query);
	isLoading = true;
	document.getElementById(sendBtnId).disabled = true;
	showTyping();

	try {
		const res = await fetch(`${API_BASE}/chatbot.php`, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query }),
		});
		hideTyping();

		if (res.status === 401) {
			window.location.href = "login.html";
			return;
		}

		const data = await res.json();
		if (data.error) {
			appendMessage("bot", data.error);
			return;
		}
		appendMessage(
			"bot",
			data.answer,
			data.sources_used || [],
			data.confidence ?? null,
			data.restricted_count ?? 0
		);
	} catch {
		hideTyping();
		appendMessage("bot", "Failed to reach the server. Please try again.");
	} finally {
		isLoading = false;
		document.getElementById(sendBtnId).disabled = false;
		input.focus();
	}
}

function setupChatInput(inputId, sendBtnId) {
	const input = document.getElementById(inputId);
	if (!input) return;

	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendQuery(inputId, sendBtnId);
		}
	});

	input.addEventListener("input", () => {
		input.style.height = "auto";
		input.style.height = Math.min(input.scrollHeight, 120) + "px";
	});

	document.getElementById(sendBtnId)?.addEventListener("click", () => {
		sendQuery(inputId, sendBtnId);
	});
}

function setupFloatingWidget() {
	const fab = document.getElementById("chatFab");
	const widget = document.getElementById("chatWidget");

	fab.addEventListener("click", () => {
		widgetOpen = !widgetOpen;
		widget.classList.toggle("hidden", !widgetOpen);
		fab.classList.toggle("hidden", widgetOpen);
	});

	document.getElementById("chatCloseBtn").addEventListener("click", () => {
		widgetOpen = false;
		widget.classList.add("hidden");
		fab.classList.remove("hidden");
	});

	document.getElementById("chatExpandBtn").addEventListener("click", () => {
		window.location.href = "chatbot.php";
	});

	setupChatInput("widgetInput", "widgetSendBtn");
}

// ── Bootstrap (runs on every page) ──

document.addEventListener("DOMContentLoaded", async () => {
	const user = await checkAuth();
	if (!user) return;

	initUser(user);
	setupFloatingWidget();
	setupDocumentViewer();
	document.getElementById("logoutBtn").addEventListener("click", logout);

	if (typeof initPage === "function") {
		await initPage(user);
	}
});
