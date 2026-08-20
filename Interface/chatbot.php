<?php
$activeView = 'chatbot';
$pageTitle = 'AI Chatbot';
$pageSubtitle = 'Intelligent fraud investigation assistant';
$pageScripts = ['pages/chatbot.js'];
$hideChatFab = true; // the full chat page replaces the floating widget
include __DIR__ . '/partials/chrome_head.php';
?>
					<section class="view-panel active" id="view-chatbot">
						<div class="chatbot-view">
							<div class="chatbot-view-header">
								<img
									src="assets/logo.png"
									alt="IntelliHub"
									class="chatbot-view-logo"
								/>
								<div>
									<h2>IntelliHub Assistant</h2>
									<p>Ask about fraud cases, transactions, and policies</p>
								</div>
							</div>
							<div class="chatbot-view-messages" id="chatbotMessages">
								<div class="welcome-state" id="chatbotWelcome">
									<div class="welcome-icon">💬</div>
									<h2>How can I help you today?</h2>
									<p>
										Ask about fraud cases, transaction anomalies, or compliance
										policies.
									</p>
									<div class="suggestion-chips">
										<button
											class="chip"
											data-suggest="Show recent flagged transactions"
										>
											Show recent flagged transactions
										</button>
										<button
											class="chip"
											data-suggest="What is the refund policy for fraud?"
										>
											What is the refund policy for fraud?
										</button>
										<button class="chip" data-suggest="Summarize case FC001">
											Summarize case FC001
										</button>
									</div>
								</div>
							</div>
							<div class="chatbot-view-input">
								<textarea
									id="chatbotInput"
									rows="1"
									placeholder="Ask a question…"
								></textarea>
								<button class="btn-send" id="chatbotSendBtn" aria-label="Send">
									<svg
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<line x1="22" y1="2" x2="11" y2="13" />
										<polygon points="22 2 15 22 11 13 2 9 22 2" />
									</svg>
								</button>
							</div>
						</div>
					</section>
<?php include __DIR__ . '/partials/chrome_foot.php'; ?>
