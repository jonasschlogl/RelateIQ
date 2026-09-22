// Messenger.com selectors — same reasoning as content-whatsapp.js: prefer
// aria-label/role over Messenger's own hashed class names, since those
// change on nearly every deploy.
//
// Messenger's URL does include a thread id (messenger.com/t/<id>/), which
// is a more stable key for the per-chat "smart replies" toggle than the
// visible header text — threadIdFromUrl below is tried first.
relateiqInit({
  platform: "messenger",
  composeSelectors: [
    'div[aria-label="Message"][contenteditable="true"]',
    'div[aria-label^="Aa"][contenteditable="true"]',
    '[contenteditable="true"][role="textbox"]',
  ],
  messageRowSelectors: [
    'div[role="row"]',
    '[role="grid"] div[role="gridcell"]',
  ],
  messageTextSelector: 'div[dir="auto"]',
  chatTitleSelectors: ['h2 span[dir="auto"]', 'header span[dir="auto"]'],
  threadIdFromUrl: (pathname) => {
    const m = pathname.match(/\/t\/([^/]+)/);
    return m ? m[1] : null;
  },
});
