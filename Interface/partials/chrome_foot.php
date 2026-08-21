<?php
// Included by every page. Reads optional $hideChatFab (bool, default false)
// and $pageScripts (array of assets/ paths, e.g. ['pages/cases.js']).
$hideChatFab = $hideChatFab ?? false;
$pageScripts = $pageScripts ?? [];
?>
				</main>
			</div>
		</div>

		<!-- Floating Chat Widget -->
		<div class="chat-widget hidden" id="chatWidget">
			<div class="chat-widget-header">
				<img src="assets/logo.png" alt="" class="chat-widget-logo" />
				<div class="chat-widget-title">
					IntelliHub Assistant
					<span>Fraud Investigation AI</span>
				</div>
				<div class="chat-widget-actions">
					<button
						class="chat-widget-btn"
						id="chatExpandBtn"
						title="Expand to full page"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<polyline points="15 3 21 3 21 9" />
							<polyline points="9 21 3 21 3 15" />
							<line x1="21" y1="3" x2="14" y2="10" />
							<line x1="3" y1="21" x2="10" y2="14" />
						</svg>
					</button>
					<button class="chat-widget-btn" id="chatCloseBtn" title="Close">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>
			</div>
			<div class="chat-widget-messages" id="widgetMessages">
				<div class="empty-state" id="widgetWelcome">
					Ask me anything about cases, policies, or transactions
				</div>
			</div>
			<div class="chat-widget-input">
				<textarea
					id="widgetInput"
					rows="1"
					placeholder="Ask a question…"
				></textarea>
				<button class="btn-send" id="widgetSendBtn" aria-label="Send">
					<svg
						width="14"
						height="14"
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

		<button class="chat-fab <?= $hideChatFab ? 'hidden' : '' ?>" id="chatFab" aria-label="Open chat assistant">
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
				/>
			</svg>
		</button>

		<!-- Document Viewer Modal -->
		<div class="doc-modal-overlay hidden" id="docModalOverlay">
			<div class="doc-modal" role="dialog" aria-modal="true" aria-labelledby="docModalTitle">
				<div class="doc-modal-header">
					<div class="doc-modal-title">
						<h3 id="docModalTitle">Document</h3>
						<div class="doc-modal-meta" id="docModalMeta"></div>
					</div>
					<button class="doc-modal-close" id="docModalClose" aria-label="Close">
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>
				<div class="doc-modal-body" id="docModalBody">
					<div class="doc-modal-loading">Loading document…</div>
				</div>
				<div class="doc-modal-footer">
					<button class="btn-outline" type="button" id="docModalCloseFooter">Close</button>
					<a class="btn btn-primary hidden" id="docModalOpenFile" href="#" target="_blank" rel="noopener" style="width: auto; text-decoration: none">Open File</a>
				</div>
			</div>
		</div>

		<script src="assets/common.js"></script>
		<script src="assets/shared-analytics.js"></script>
<?php foreach ($pageScripts as $script): ?>
		<script src="assets/<?= htmlspecialchars($script) ?>?v=<?= filemtime(__DIR__ . '/../assets/' . $script) ?>"></script>
<?php endforeach; ?>
	</body>
</html>
