function setupChatbotView() {
	setupChatInput("chatbotInput", "chatbotSendBtn");

	document.querySelectorAll("#view-chatbot .chip[data-suggest]").forEach((chip) => {
		chip.addEventListener("click", () => {
			document.getElementById("chatbotInput").value = chip.dataset.suggest;
			sendQuery("chatbotInput", "chatbotSendBtn");
		});
	});
}

async function initPage() {
	setupChatbotView();
}
