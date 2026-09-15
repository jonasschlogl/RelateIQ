// Shared engine used by both content-whatsapp.js and content-messenger.js.
// Each of those files just calls relateiqInit(selectors) with its own list
// of compose-box selectors — everything else (the floating button, the
// panel, talking to background.js) is identical between the two sites.

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

  return { fab, panel };
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
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el && el.isConnected) return el;
    } catch (e) {
      /* an invalid selector on this page — skip it */
    }
  }
  return null;
}

// Reads the plain-text content of a contenteditable compose box. innerText
// (rather than textContent) is used because it respects rendered line
// breaks the way a person would read them.
function relateiqGetComposeText(el) {
  if (!el) return "";
  return (el.innerText || el.textContent || "").replace(/ /g, " ").trim();
}

// Replaces a contenteditable compose box's content the way a real person
// typing would. Setting el.textContent directly is invisible to WhatsApp's
// and Messenger's own React-based editors — they only pick up input that
// goes through the browser's real edit commands, so execCommand (despite
// being deprecated elsewhere) is the reliable way to do this here.
function relateiqSetComposeText(el, text) {
  el.focus();
  document.execCommand("selectAll", false, null);
  document.execCommand("insertText", false, text);
}

function relateiqSendCoachRequest(draft) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "relateiq:coachMessage", draft }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: "Couldn't reach the RelateIQ extension. Try reloading the page." });
        return;
      }
      resolve(response || { ok: false, error: "No response from RelateIQ." });
    });
  });
}

// Wires up the floating button + panel against whichever element on the
// page currently matches `selectors`. Safe to call once per content script;
// it re-checks the DOM on an interval and via MutationObserver, since both
// WhatsApp Web and Messenger are single-page apps that swap the compose box
// out (e.g. when you switch chats) without a full page reload.
function relateiqInit(selectors) {
  const { fab, panel } = relateiqBuildUI();
  let composeEl = null;
  let boundEl = null;

  function updateFabVisibility() {
    const hasText = composeEl && relateiqGetComposeText(composeEl).length > 0;
    fab.classList.toggle("visible", !!hasText);
  }

  function updateComposeEl() {
    const found = relateiqFindFirst(selectors);
    if (found !== composeEl) {
      composeEl = found;
    }
    if (composeEl && composeEl !== boundEl) {
      composeEl.addEventListener("input", updateFabVisibility);
      composeEl.addEventListener("keyup", updateFabVisibility);
      boundEl = composeEl;
    }
    updateFabVisibility();
  }

  fab.addEventListener("click", async () => {
    if (!composeEl) return;
    const draft = relateiqGetComposeText(composeEl);
    if (!draft) return;

    fab.classList.add("loading");
    relateiqShowPanel(panel, { bodyHtml: "<p>Thinking about the best way to say this…</p>", actions: [] });

    const response = await relateiqSendCoachRequest(draft);
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
          onClick: () => {
            if (composeEl) relateiqSetComposeText(composeEl, rewrite);
            panel.classList.remove("visible");
          },
        },
        {
          label: "Copy",
          onClick: () => {
            navigator.clipboard?.writeText(rewrite).catch(() => {});
          },
        },
        { label: "Dismiss", onClick: () => panel.classList.remove("visible") },
      ],
    });
  });

  const observer = new MutationObserver(() => updateComposeEl());
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(updateComposeEl, 1500); // belt-and-suspenders in case the observer misses a change
  updateComposeEl();
}
