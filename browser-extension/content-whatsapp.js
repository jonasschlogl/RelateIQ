// WhatsApp Web selectors. WhatsApp changes its class names often (they're
// hashed/obfuscated on every release), so this leans on more stable
// attributes — data-testid and role — with older aria-label fallbacks for
// versions that don't have the testid yet. If WhatsApp ships a change that
// breaks all of these, the affected feature simply stops appearing; nothing
// else on the page is affected.
//
// WhatsApp Web doesn't encode the open chat in the URL, so the per-chat
// "smart replies" toggle is keyed off the visible chat header name instead
// (see chatTitleSelectors — relateiqGetThreadKey in shared.js handles the
// fallback chain).
relateiqInit({
  platform: "whatsapp",
  composeSelectors: [
    '[data-testid="conversation-compose-box-input"]',
    'footer [contenteditable="true"][role="textbox"]',
    'div[aria-label="Type a message"][contenteditable="true"]',
  ],
  messageRowSelectors: [
    '[data-testid="conversation-panel-messages"] [role="row"]',
    'div#main div[role="row"]',
  ],
  messageTextSelector: 'span.selectable-text, .copyable-text',
  chatTitleSelectors: [
    'header [data-testid="conversation-info-header"] span[dir="auto"]',
    "header span[title]",
  ],
});
