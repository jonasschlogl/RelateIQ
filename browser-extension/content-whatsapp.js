// WhatsApp Web's compose box selectors, tried in order. WhatsApp changes its
// class names often (they're hashed/obfuscated on every release), so this
// leans on more stable attributes — data-testid and role — with an older
// aria-label fallback for versions that don't have the testid yet. If
// WhatsApp ships a change that breaks all of these, the floating button
// simply won't appear; nothing else on the page is affected.
const RELATEIQ_WHATSAPP_SELECTORS = [
  '[data-testid="conversation-compose-box-input"]',
  'footer [contenteditable="true"][role="textbox"]',
  'div[aria-label="Type a message"][contenteditable="true"]',
];

relateiqInit(RELATEIQ_WHATSAPP_SELECTORS);
