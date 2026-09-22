// Shared engine used by content-whatsapp.js, content-messenger.js and
// content-instagram.js. Each of those files just calls relateiqInit(config)
// with its own platform name and selectors — everything else (the floating
// button, the coach panel, the automatic smart-reply chips, the per-chat
// consent toggle, talking to background.js) is identical across the three.
//
// config shape:
// {
//   platform: "whatsapp" | "messenger" | "instagram",
//   composeSelectors: [selector, ...],       // tried in order
//   messageRowSelectors: [selector, ...],     // tried in order, first that
//                                              // matches >0 elements wins
//   messageTextSelector: selector | null,     // within a row, optional
//   chatTitleSelectors: [selector, ...],      // used to key the per-chat
//                                              // "smart replies" toggle
//   threadIdFromUrl: (pathname) => id | null, // optional, more stable than
//                                              // chatTitleSelectors when the
//                                              // site puts a thread id in
//                                              // the URL (Messenger, IG)
// }

function relateiqGetOrCreateRoot() {
  let root = document.getElementById("relateiq-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "relateiq-root";
    document.documentElement.appendChild(root);
  }
  return root;
}

function relateiqBuildUI() {
  const root = relateiqGetOrCreateRoot();

  let fab = document.getElementById("relateiq-fab");
  if (!fab) {
    fab = document.createElement("button");
    fab.id = "relateiq-fab";
    fab.type = "button";
    fab.title = "Coach this message with RelateIQ";
    fab.textContent = "💬";
    root.appendChild(fab);
  }

  let panel = document.getElementById("relateiq-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "relateiq-panel";
    panel.innerHTML =
      '<div class="relateiq-panel-title">' +
      "<span>RelateIQ Message Coach</span>" +
      '<button class="relateiq-close" type="button" aria-label="Close">✕</button>' +
      "</div>" +
      '<div class="relateiq-body"></div>' +
      '<div class="relateiq-actions"></div>';
    root.appendChild(panel);
    panel.querySelector(".relateiq-close").addEventListener("click", () => {
      panel.classList.remove("visible");
    });
  }

  let toggle = document.getElementById("relateiq-consent-toggle");
  if (!toggle) {
    toggle = document.createElement("button");
    toggle.id = "relateiq-consent-toggle";
    toggle.type = "button";
    toggle.textContent = "Smart replies: off";
    root.appendChild(toggle);
  }

  let chips = document.getElementById("relateiq-chips");
  if (!chips) {
    chips = document.createElement("div");
    chips.id = "relateiq-chips";
    root.appendChild(chips);
  }

  return { fab, panel, toggle, chips };
}

function relateiqEscapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function relateiqShowPanel(panel, { bodyHtml, actions }) {
  panel.querySelector(".relateiq-body").innerHTML = bodyHtml;
  const actionsEl = panel.querySelector(".relateiq-actions");
  actionsEl.innerHTML = "";
  (actions || []).forEach((a) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "relateiq-btn " + (a.primary ? "relateiq-btn-primary" : "relateiq-btn-ghost");
    btn.textContent = a.label;
    btn.addEventListener("click", a.onClick);
    actionsEl.appendChild(btn);
  });
  panel.classList.add("visible");
}

// Finds the first connected element matching any of the given selectors —
// tried in order, since a platform's own markup/testids can change between
// releases and having several fallbacks keeps this working longer.
function relateiqFindFirst(selectors) {
  for (const sel of selectors || []) {
    try {
      const el = document.querySelector(sel);
      if (el && el.isConnected) return el;
    } catch (e) {
      /* an invalid selector on this page — skip it */
    }
  }
  return null;
}

// Same idea as relateiqFindFirst, but for a list of elements: tries each
// selector in order and returns the first one that actually matches
// something, rather than always querying the first selector only.
function relateiqFindAllFirst(selectors) {
  for (const sel of selectors || []) {
    try {
      const list = document.querySelectorAll(sel);
      if (list && list.length) return Array.from(list);
    } catch (e) {
      /* an invalid selector on this page — skip it */
    }
  }
  return [];
}

// Reads the plain-text content of a contenteditable compose box. innerText
// (rather than textContent) is used because it respects rendered line
// breaks the way a person would read them.
function relateiqGetComposeText(el) {
  if (!el) return "";
  return (el.innerText || el.textContent || "").replace(/ /g, " ").trim();
}

function relateiqSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Selects everything in a contenteditable compose box and deletes it. Used
// before EVERY insertion attempt below (not just when something is known to
// already be there) so neither insertion strategy can ever end up appending
// on top of the other's result.
function relateiqClearComposeText(el) {
  el.focus();
  try {
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
  } catch (e) {
    /* ignore — the insertion attempt below still gets a chance to work */
  }
}

// Replaces a contenteditable compose box's content the way a real person
// typing would. Setting el.textContent directly is invisible to WhatsApp's,
// Messenger's and Instagram's own React/Lexical-based editors — they only
// notice input that goes through a real edit command or a real paste event.
// Tries execCommand first (works on most contenteditable implementations),
// then falls back to a synthetic paste event if that didn't land.
//
// This is async and awaits a short pause before checking whether an attempt
// landed. That pause matters: these editors can take a tick to reflect an
// execCommand change in el.innerText, so checking synchronously right after
// insertText sometimes reported "didn't land" even though it had — which
// then ran the paste fallback too, inserting the same text a second time on
// top of the first. Clearing again immediately before the paste fallback
// (in addition to before the first attempt) closes that gap for good, even
// if a future timing quirk reintroduces a similar false negative.
async function relateiqSetComposeText(el, text) {
  relateiqClearComposeText(el);
  try {
    document.execCommand("insertText", false, text);
  } catch (e) {
    /* fall through to the paste-event strategy below */
  }

  await relateiqSleep(30);
  if (relateiqComposeTextLooksLike(el, text)) return true;

  relateiqClearComposeText(el);
  try {
    const dt = new DataTransfer();
    dt.setData("text/plain", text);
    el.focus();
    const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt });
    el.dispatchEvent(pasteEvent);
  } catch (e) {
    /* neither strategy is supported here */
  }

  await relateiqSleep(30);
  return relateiqComposeTextLooksLike(el, text);
}

// Loose check (not exact-match — the editor may add its own formatting)
// used to tell whether a text-insertion attempt actually landed.
function relateiqComposeTextLooksLike(el, text) {
  const now = relateiqGetComposeText(el);
  const probe = text.slice(0, Math.min(24, text.length)).trim();
  return probe.length > 0 && now.includes(probe);
}

// Copies text to the clipboard. Tries the modern Clipboard API first, but
// that can silently fail inside a content script on some pages (permissions
// policy, focus quirks), so it falls back to the older but very reliable
// hidden-textarea + execCommand("copy") trick. Returns true/false.
async function relateiqCopyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    /* fall through to the execCommand fallback below */
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.top = "0";
    textarea.style.left = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  } catch (e) {
    return false;
  }
}

function relateiqSendCoachRequest(draft, messages) {
  return new Promise((resolve) => {
    if (!relateiqExtensionContextValid()) {
      resolve({ ok: false, error: "This tab needs a refresh after the last extension update — reload the page and try again." });
      return;
    }
    try {
      chrome.runtime.sendMessage({ type: "relateiq:coachMessage", draft, messages }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: "Couldn't reach the RelateIQ extension. Try reloading the page." });
          return;
        }
        resolve(response || { ok: false, error: "No response from RelateIQ." });
      });
    } catch (e) {
      resolve({ ok: false, error: "This tab needs a refresh after the last extension update — reload the page and try again." });
    }
  });
}

function relateiqSendSuggestRequest(messages) {
  return new Promise((resolve) => {
    if (!relateiqExtensionContextValid()) {
      resolve({ ok: false, error: "This tab needs a refresh after the last extension update — reload the page and try again." });
      return;
    }
    try {
      chrome.runtime.sendMessage({ type: "relateiq:suggestReplies", messages }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: "Couldn't reach the RelateIQ extension. Try reloading the page." });
          return;
        }
        resolve(response || { ok: false, error: "No response from RelateIQ." });
      });
    } catch (e) {
      resolve({ ok: false, error: "This tab needs a refresh after the last extension update — reload the page and try again." });
    }
  });
}

// ---------------------------------------------------------------------------
// Reading the conversation — best effort, degrades gracefully
// ---------------------------------------------------------------------------

// A handful of lines that are almost certainly a date/timestamp separator
// rather than an actual message, so they don't pollute the transcript sent
// to the AI (e.g. WhatsApp/Messenger render "Today", "12:04 PM", or a plain
// date as their own row in the message list).
const RELATEIQ_NOISE_LINE = /^(today|yesterday|\d{1,2}:\d{2}(\s?[ap]m)?|\d{1,2}\/\d{1,2}\/\d{2,4}|[a-z]+ \d{1,2}(,\s?\d{4})?)$/i;

// Right-aligned vs. left-aligned is the one visual convention every one of
// these chat UIs share for "sent by me" vs. "sent by them" — far more
// stable across redesigns than any class name or data-testid. Compares the
// message bubble's horizontal center against its row's horizontal center.
function relateiqDetectDirection(row, bubbleEl) {
  try {
    const rowRect = row.getBoundingClientRect();
    const bubbleRect = (bubbleEl || row).getBoundingClientRect();
    if (!rowRect.width || !bubbleRect.width) return "them";
    const rowCenter = rowRect.left + rowRect.width / 2;
    const bubbleCenter = bubbleRect.left + bubbleRect.width / 2;
    return bubbleCenter > rowCenter ? "me" : "them";
  } catch (e) {
    return "them";
  }
}

// Pulls the last `maxMessages` messages currently rendered on screen as
// [{from: "me"|"them", text}], oldest first. This only ever reads what's
// already visible in the DOM — it never scrolls the chat or fetches
// anything — and if the site's markup doesn't match any of the configured
// selectors it simply returns an empty array rather than throwing, so a
// platform redesign silently turns off the context-aware features instead
// of breaking anything else.
function relateiqExtractRecentMessages(config, maxMessages) {
  const rows = relateiqFindAllFirst(config.messageRowSelectors || []);
  if (!rows.length) return [];

  const out = [];
  for (const row of rows) {
    if (!row.isConnected) continue;
    let textEl = row;
    if (config.messageTextSelector) {
      const found = row.querySelector(config.messageTextSelector);
      if (found) textEl = found;
    }
    const text = (textEl.innerText || textEl.textContent || "").replace(/ /g, " ").trim();
    if (!text || RELATEIQ_NOISE_LINE.test(text)) continue;

    const from = relateiqDetectDirection(row, textEl);
    const last = out[out.length - 1];
    if (last && last.from === from && last.text === text) continue; // de-dupe accessibility echoes
    out.push({ from, text: text.slice(0, 600) });
  }
  return out.slice(-maxMessages);
}

// ---------------------------------------------------------------------------
// Per-chat "smart replies" consent — off by default, remembered per chat
// ---------------------------------------------------------------------------

// Identifies "this chat" well enough to remember a per-chat toggle. Prefers
// a thread id straight from the URL (Messenger and Instagram both put one
// there); WhatsApp Web doesn't, so it falls back to the visible chat header
// text, and finally to the tab title. None of these are a perfect unique
// key (two contacts with the same name would share a toggle state) but
// that's an acceptable trade-off for a convenience setting, not a security
// boundary — the actual privacy control is that it defaults to OFF.
function relateiqGetThreadKey(config) {
  if (typeof config.threadIdFromUrl === "function") {
    try {
      const id = config.threadIdFromUrl(location.pathname);
      if (id) return `${config.platform}:${id}`;
    } catch (e) {
      /* fall through */
    }
  }
  const header = relateiqFindFirst(config.chatTitleSelectors || []);
  if (header) {
    const text = (header.innerText || header.textContent || "").trim();
    if (text) return `${config.platform}:${text}`;
  }
  if (document.title) return `${config.platform}:${document.title}`;
  return `${config.platform}:default`;
}

// True once the extension has been reloaded/updated (from chrome://extensions
// or an auto-update) while this content script's tab was already open. When
// that happens, every chrome.* call this already-running copy of the script
// makes throws "Extension context invalidated" — there's no way to recover
// short of the page itself being reloaded, so every function below that
// touches a chrome.* API checks this first and fails quietly instead of
// throwing an unhandled rejection into the extension's error log every 1.5s.
function relateiqExtensionContextValid() {
  try {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

async function relateiqGetChatConsent(threadKey) {
  if (!relateiqExtensionContextValid()) return false;
  try {
    const { relateiq_chat_consent } = await chrome.storage.local.get("relateiq_chat_consent");
    return !!(relateiq_chat_consent && relateiq_chat_consent[threadKey]);
  } catch (e) {
    return false;
  }
}

async function relateiqSetChatConsent(threadKey, enabled) {
  if (!relateiqExtensionContextValid()) return;
  try {
    const { relateiq_chat_consent } = await chrome.storage.local.get("relateiq_chat_consent");
    const next = Object.assign({}, relateiq_chat_consent || {});
    if (enabled) {
      next[threadKey] = true;
    } else {
      delete next[threadKey];
    }
    await chrome.storage.local.set({ relateiq_chat_consent: next });
  } catch (e) {
    /* context went away mid-write — nothing to do but drop it */
  }
}

// ---------------------------------------------------------------------------
// Wiring it all up against the live page
// ---------------------------------------------------------------------------

// Wires up the floating button, coach panel, consent toggle and smart-reply
// chips against whichever elements on the page currently match `config`'s
// selectors. Safe to call once per content script; it re-checks the DOM on
// an interval and via MutationObserver, since WhatsApp Web, Messenger and
// Instagram are all single-page apps that swap the compose box and message
// list out (e.g. when you switch chats) without a full page reload.
function relateiqInit(config) {
  const { fab, panel, toggle, chips } = relateiqBuildUI();

  let composeEl = null;
  let boundEl = null;
  let threadKey = null;
  let consentEnabled = false;
  let lastSuggestSignature = null;
  let isFetchingSuggestions = false;
  let cachedSuggestions = null;

  function updateFabVisibility() {
    const hasText = composeEl && relateiqGetComposeText(composeEl).length > 0;
    fab.classList.toggle("visible", !!hasText);
    // Chips propose what to send next — once the user is drafting their own
    // reply, get out of the way rather than competing with the FAB.
    chips.classList.toggle("relateiq-hidden-by-draft", !!hasText);
  }

  function renderChips(suggestions) {
    cachedSuggestions = suggestions;
    if (!suggestions || !suggestions.length) {
      chips.innerHTML = "";
      chips.classList.remove("visible");
      return;
    }
    chips.innerHTML = suggestions
      .map(
        (text, i) =>
          `<button type="button" class="relateiq-chip" data-i="${i}" title="${relateiqEscapeHtml(text)}">${relateiqEscapeHtml(
            text.length > 90 ? text.slice(0, 87) + "…" : text
          )}</button>`
      )
      .join("");
    chips.querySelectorAll(".relateiq-chip").forEach((btn, i) => {
      btn.addEventListener("click", async () => {
        if (!composeEl) return;
        await relateiqSetComposeText(composeEl, suggestions[i]);
        chips.classList.remove("visible");
      });
    });
    chips.classList.add("visible");
  }

  async function updateSuggestions() {
    if (!consentEnabled || !composeEl) {
      chips.classList.remove("visible");
      return;
    }
    if (relateiqGetComposeText(composeEl).length > 0) return; // handled by updateFabVisibility's hide

    const recent = relateiqExtractRecentMessages(config, 16);
    if (!recent.length || recent[recent.length - 1].from !== "them") {
      chips.classList.remove("visible");
      return;
    }

    const signature = recent
      .slice(-3)
      .map((m) => m.from + ":" + m.text)
      .join("|");
    if (signature === lastSuggestSignature) {
      if (cachedSuggestions) renderChips(cachedSuggestions);
      return;
    }
    if (isFetchingSuggestions) return;

    isFetchingSuggestions = true;
    lastSuggestSignature = signature;
    chips.classList.add("relateiq-chips-loading");
    const response = await relateiqSendSuggestRequest(recent);
    chips.classList.remove("relateiq-chips-loading");
    isFetchingSuggestions = false;

    if (!response.ok) {
      renderChips(null);
      return;
    }
    renderChips(response.suggestions);
  }

  async function updateConsentUi() {
    const newKey = relateiqGetThreadKey(config);
    if (newKey === threadKey) return;
    threadKey = newKey;
    lastSuggestSignature = null;
    cachedSuggestions = null;
    chips.classList.remove("visible");
    consentEnabled = await relateiqGetChatConsent(threadKey);
    toggle.textContent = consentEnabled ? "Smart replies: on" : "Smart replies: off";
    toggle.classList.toggle("relateiq-on", consentEnabled);
  }

  toggle.addEventListener("click", async () => {
    if (!threadKey) return;
    consentEnabled = !consentEnabled;
    await relateiqSetChatConsent(threadKey, consentEnabled);
    toggle.textContent = consentEnabled ? "Smart replies: on" : "Smart replies: off";
    toggle.classList.toggle("relateiq-on", consentEnabled);
    lastSuggestSignature = null; // force a fresh fetch now that it's on
    if (!consentEnabled) chips.classList.remove("visible");
    updateSuggestions();
  });

  function updateComposeEl() {
    // The extension was reloaded/updated while this tab was already open —
    // this copy of the script can never talk to it again. Stop polling
    // instead of continuing to throw "Extension context invalidated" every
    // 1.5s; a page refresh (which the RelateIQ error messages above now
    // prompt for) starts a fresh, working copy.
    if (!relateiqExtensionContextValid()) {
      observer.disconnect();
      clearInterval(pollTimer);
      return;
    }

    const found = relateiqFindFirst(config.composeSelectors);
    if (found !== composeEl) {
      composeEl = found;
    }
    if (composeEl && composeEl !== boundEl) {
      composeEl.addEventListener("input", updateFabVisibility);
      composeEl.addEventListener("keyup", updateFabVisibility);
      boundEl = composeEl;
    }
    updateFabVisibility();
    updateConsentUi();
    updateSuggestions();
  }

  fab.addEventListener("click", async () => {
    const draft = composeEl ? relateiqGetComposeText(composeEl) : "";
    const recentMessages = relateiqExtractRecentMessages(config, 16);

    if (!draft && !recentMessages.length) return; // nothing to work with yet

    fab.classList.add("loading");
    relateiqShowPanel(panel, {
      bodyHtml: draft ? "<p>Thinking about the best way to say this…</p>" : "<p>Reading the conversation so far…</p>",
      actions: [],
    });

    const response = await relateiqSendCoachRequest(draft, recentMessages);
    fab.classList.remove("loading");

    if (!response.ok) {
      relateiqShowPanel(panel, {
        bodyHtml: `<p class="relateiq-error">${relateiqEscapeHtml(response.error || "Something went wrong.")}</p>`,
        actions: [{ label: "Dismiss", onClick: () => panel.classList.remove("visible") }],
      });
      return;
    }

    const rewrite = response.rewrite;
    const bodyHtml =
      `<div>${relateiqEscapeHtml(rewrite)}</div>` +
      (response.why
        ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(250,235,215,0.14);font-size:12px;opacity:0.8;">${relateiqEscapeHtml(response.why)}</div>`
        : "");

    relateiqShowPanel(panel, {
      bodyHtml,
      actions: [
        {
          label: "Use this",
          primary: true,
          onClick: async (event) => {
            const btn = event.currentTarget;
            const inserted = composeEl ? await relateiqSetComposeText(composeEl, rewrite) : false;
            if (inserted) {
              panel.classList.remove("visible");
              return;
            }
            // Couldn't insert it directly (the site's compose box didn't
            // respond the way we expected) — copy it instead so the user
            // isn't stuck with nothing, and say so clearly rather than
            // failing silently.
            const copied = await relateiqCopyText(rewrite);
            btn.textContent = copied ? "Couldn't insert — copied instead, press Ctrl+V" : "Couldn't insert or copy — select the text above";
          },
        },
        {
          label: "Copy",
          onClick: async (event) => {
            const btn = event.currentTarget;
            const original = btn.textContent;
            const ok = await relateiqCopyText(rewrite);
            btn.textContent = ok ? "Copied!" : "Couldn't copy — select the text above";
            setTimeout(() => {
              btn.textContent = original;
            }, 1800);
          },
        },
        { label: "Dismiss", onClick: () => panel.classList.remove("visible") },
      ],
    });
  });

  const observer = new MutationObserver(() => updateComposeEl());
  observer.observe(document.body, { childList: true, subtree: true });
  const pollTimer = setInterval(updateComposeEl, 1500); // belt-and-suspenders in case the observer misses a change
  updateComposeEl();
}
