// Messenger.com's compose box selectors, tried in order — same reasoning as
// content-whatsapp.js: prefer aria-label/role over Messenger's own hashed
// class names, since those change on nearly every deploy.
const RELATEIQ_MESSENGER_SELECTORS = [
  'div[aria-label="Message"][contenteditable="true"]',
  'div[aria-label^="Aa"][contenteditable="true"]',
  '[contenteditable="true"][role="textbox"]',
];

relateiqInit(RELATEIQ_MESSENGER_SELECTORS);
