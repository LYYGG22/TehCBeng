const API_BASE = "../Logic";

let isLoading = false;

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

// Renders bot text as Markdown (bold, lists, etc). Falls back to escaped
// plain text if the marked.js library failed to load for some reason.
function renderBotText(text) {
	if (typeof marked !== "undefined") {
		return marked.parse(text);
	}
	return escapeHtml(text);
}

function hideWelcome() {
	const welcome = document.getElementById("welcome");
	if (welcome) welcome.style.display = "none";
}

// Pulls a readable label out of a source item, whether it's a plain string
// or an object like { id, text, source_file, title }.
function sourceLabel(s) {
	if (typeof s === "string") return s;
	if (s && typeof s === "object") {
		return s.source_file || s.title || s.id || JSON.stringify(s);
	}
	return String(s);
}

function appendMessage(role, text, sources = []) {
	hideWelcome();

	const chat = document.getElementById("chatMessages");
	const msg = document.createElement("div");
	msg.className = `message ${role}`;

	const avatarLabel = role === "user" ? "You" : "IH";
	let sourcesHtml = "";

	if (sources.length > 0) {
		sourcesHtml = `<div class="message-sources">${sources
			.map(
				(s) => `<span class="source-tag">${escapeHtml(sourceLabel(s))}</span>`,
			)
			.join("")}</div>`;
	}

	const bubbleContent = role === "bot" ? renderBotText(text) : escapeHtml(text);

	msg.innerHTML = `
		<div class="message-avatar">${avatarLabel}</div>
		<div class="message-content">
			<div class="message-bubble">${bubbleContent}</div>
			${sourcesHtml}
		</div>
	`;

	chat.appendChild(msg);
	chat.scrollTop = chat.scrollHeight;
	return msg;
}

function showTyping() {
	hideWelcome();

	const chat = document.getElementById("chatMessages");
	const msg = document.createElement("div");
	msg.className = "message bot";
	msg.id = "typingIndicator";
	msg.innerHTML = `
		<div class="message-avatar">IH</div>
		<div class="message-content">
			<div class="typing-indicator">
				<span></span><span></span><span></span>
			</div>
		</div>
	`;
	chat.appendChild(msg);
	chat.scrollTop = chat.scrollHeight;
}

function hideTyping() {
	const el = document.getElementById("typingIndicator");
	if (el) el.remove();
}

function showError(text) {
	const chat = document.getElementById("chatMessages");
	const err = document.createElement("div");
	err.className = "error-message";
	err.textContent = text;
	chat.appendChild(err);
	chat.scrollTop = chat.scrollHeight;
	setTimeout(() => err.remove(), 5000);
}

async function sendQuery(queryText) {
	if (isLoading) return;

	const input = document.getElementById("queryInput");
	const query = (queryText || input.value).trim();
	if (!query) return;

	input.value = "";
	input.style.height = "auto";

	appendMessage("user", query);
	isLoading = true;
	document.getElementById("sendBtn").disabled = true;
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
			showError(data.error);
			return;
		}

		appendMessage("bot", data.answer, data.sources_used || []);
	} catch {
		hideTyping();
		showError("Failed to reach the server. Please try again.");
	} finally {
		isLoading = false;
		document.getElementById("sendBtn").disabled = false;
		input.focus();
	}
}

function setupInput() {
	const input = document.getElementById("queryInput");

	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendQuery();
		}
	});

	input.addEventListener("input", () => {
		input.style.height = "auto";
		input.style.height = Math.min(input.scrollHeight, 120) + "px";
	});
}

function setupSuggestions() {
	document.querySelectorAll(".chip").forEach((chip) => {
		chip.addEventListener("click", () => sendQuery(chip.textContent));
	});
}

async function logout() {
	await fetch(`${API_BASE}/auth.php?action=logout`, {
		method: "POST",
		credentials: "include",
	});
	window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", async () => {
	const user = await checkAuth();
	if (!user) return;

	initUser(user);
	setupInput();
	setupSuggestions();

	document
		.getElementById("sendBtn")
		.addEventListener("click", () => sendQuery());
	document.getElementById("logoutBtn").addEventListener("click", logout);
});
