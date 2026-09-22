// Instagram Direct (instagram.com/direct/...) selectors. Instagram's DOM is
// the least documented/most-frequently-changed of the three platforms this
// extension supports, so these are a best-effort first pass — if Instagram
// ships a redesign that breaks all of these, the affected feature simply
// stops appearing; nothing else on the page is affected. The message-row
// and text selectors deliberately fall back to very generic patterns
// (div[role="row"], div[dir="auto"]) that Instagram's React app tends to
// reuse across redesigns even when specific class names churn.
//
// Instagram's URL includes a thread id (instagram.com/direct/t/<id>/),
// used as the per-chat "smart replies" toggle key.
relateiqInit({
  platform: "instagram",
  composeSelectors: [
    'div[aria-label="Message"][contenteditable="true"]',
    'textarea[placeholder="Message..."]',
    '[contenteditable="true"][role="textbox"]',
  ],
  messageRowSelectors: [
    'div[role="row"]',
    'div[role="grid"] > div',
  ],
  messageTextSelector: 'div[dir="auto"] span, div[dir="auto"]',
  chatTitleSelectors: ["header span", "header h1"],
  threadIdFromUrl: (pathname) => {
    const m = pathname.match(/\/direct\/t\/([^/]+)/);
    return m ? m[1] : null;
  },
});
