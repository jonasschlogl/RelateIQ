let currentConversationId = null;
let conversations = [];
let partners = [];
let currentMode = "coach"; // 'coach' | 'practice' — mirrors the mode of whatever is on screen
let currentConvCtx = { mode: "coach", partnerName: null };
let isSending = false;
// Set while the person is editing & resending their last Coach Chat message
// (see startEditLastMessage/cancelEditLastMessage below) — the id of the
// user message being replaced, or null the rest of the time. Threaded
// through to the server as editMessageId on the next send.
let editingMessageId = null;
let currentConvHasUserMessage = false; // drives whether the "Export for therapist" button shows
// The currently-open sidebar-history "⋮" popover (task #97), and the
// chat-item-menu-btn that opened it — see openHistoryMenu/closeHistoryMenu.
// Only one can be open at a time, in the sidebar or inside the "View all"
// modal alike.
let openHistoryMenuEl = null;
let openHistoryMenuTriggerBtn = null;

// Attachments (images, screen recordings, other files) picked but not yet sent
let pendingAttachments = [];
let composerErrorTimeout = null;
let practiceSetupErrorTimeout = null;
// Mirrors MAX_FILES_PER_MESSAGE_BY_PLAN in server.js — keep the two in sync.
const MAX_FILES_PER_MESSAGE_BY_PLAN = { free: 1, pro: 3, premium: 5 };
function maxFilesPerMessage() {
  const plan = getUser()?.plan;
  return MAX_FILES_PER_MESSAGE_BY_PLAN[plan] ?? MAX_FILES_PER_MESSAGE_BY_PLAN.free;
}
const MAX_TOTAL_UPLOAD_BYTES = 15 * 1024 * 1024;
const TRASH_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a2 2 0 012-2h0a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
const PENCIL_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
const SPEAKER_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>';
const THUMBS_UP_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>';
const THUMBS_DOWN_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zM17 2h3a2 2 0 012 2v7a2 2 0 01-2 2h-3"/></svg>';
// Sidebar history kebab menu (task #97) — trigger icon and the pin glyph
// used both as the pinned-row indicator and the "Pin"/"Unpin" menu item.
const KEBAB_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>';
const PIN_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79L15 12V6a1 1 0 011-1 1 1 0 000-2H8a1 1 0 000 2 1 1 0 011 1v6l-2.89 1.45A2 2 0 005 15.24V17z"/></svg>';

// null when the partner form (see renderPracticeSetup) is creating a new
// profile, or a partner id when it's editing an existing one — swaps the
// submit handler between POST (create) and PATCH (update) and what happens
// after a successful save (start practicing vs. just return to the list).
let editingPartnerId = null;
// Set once per renderPracticeSetup() call (see there) — the resize function
// autoGrowTextarea returns for #partner-traits, so openPartnerForm can
// re-trigger it after pre-filling an existing partner's traits by setting
// .value directly (which, unlike typing, never fires an "input" event).
let resizePartnerTraits = () => {};
// Set once at startup (see DOMContentLoaded) — the resize function
// autoGrowTextarea returns for the main composer #input, so sendMessage can
// re-trigger it after restoring a failed send's text by setting .value
// directly (which never fires a real "input" event on its own).
let resizeComposerInput = () => {};

// Starter ideas shown when someone clicks "Need an idea?" on the practice
// setup screen — a lot of people stall on a blank scenario field even
// though they know roughly what's bothering them. Purely a convenience:
// clicking one just fills the (still freely editable) scenario input, it
// doesn't lock anything in.
const PRACTICE_SCENARIO_LIBRARY = [
  "Asking for more help with chores/kids without it turning into a fight",
  "Telling them I feel unheard when we disagree",
  "Asking for more alone time without it sounding like rejection",
  "Bringing up a recurring argument we keep having",
  "Talking about money stress without it becoming blame",
  "Saying no to something without feeling guilty",
  "Reconnecting after a fight neither of us really resolved",
  "Bringing up wanting more affection/closeness",
  "Addressing something a friend or family member said that upset me",
  "Talking about a big next step (moving in, a trip, the future)",
];

// The full desktop placeholder text ("Tell me what's going on in your
// relationship…") is too long to fit on one line in the composer at phone
// widths, and the box only reserves room for a single line — so it used to
// get visually clipped mid-word. A shorter phone-only variant keeps the
// placeholder fully visible instead of growing the box to fit 2-3 lines of
// placeholder text.
function composerPlaceholder(mode) {
  const isNarrow = window.matchMedia("(max-width: 640px)").matches;
  if (mode === "practice") {
    return isNarrow ? "Type what you'd say…" : "Type what you'd actually say…";
  }
  return isNarrow ? "What's going on?" : "Tell me what's going on in your relationship…";
}

document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  const user = getUser();
  const userLabel = document.getElementById("user-label");
  if (userLabel && user) userLabel.textContent = user.name || user.email;
  renderPlanBadge(user?.plan);
  renderUsageBadge(user);
  refreshPlanBadge();

  const disclaimer = document.getElementById("chat-disclaimer");
  if (disclaimer) {
    const limit = maxFilesPerMessage();
    disclaimer.textContent += ` Attachments: up to ${limit} file${limit === 1 ? "" : "s"}, 15MB total per message.`;
  }

  // Covers the empty-state landing (no conversations yet), which never
  // calls setActiveTab() and so would otherwise keep the static long
  // placeholder from the HTML. Also keeps it correct across an orientation
  // change / window resize.
  const inputEl0 = document.getElementById("input");
  if (inputEl0) inputEl0.placeholder = composerPlaceholder(currentMode);
  window.addEventListener("resize", () => {
    const el = document.getElementById("input");
    if (el && document.activeElement !== el) el.placeholder = composerPlaceholder(currentMode);
  });

  document.getElementById("logout-btn")?.addEventListener("click", logout);
  document.getElementById("new-chat-btn")?.addEventListener("click", () => {
    startNewChat(currentMode);
    closeSidebarDrawer();
  });
  document.getElementById("send-btn")?.addEventListener("click", sendMessage);
  document.getElementById("cancel-edit-btn")?.addEventListener("click", cancelEditLastMessage);
  document.getElementById("history-search")?.addEventListener("input", renderHistory);

  // Mobile off-canvas drawer (harmless no-op on desktop, where the sidebar
  // is always visible and .open has no matching CSS rule).
  document.getElementById("sidebar-toggle")?.addEventListener("click", openSidebarDrawer);
  document.getElementById("sidebar-close-btn")?.addEventListener("click", closeSidebarDrawer);
  document.getElementById("sidebar-backdrop")?.addEventListener("click", closeSidebarDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebarDrawer();
  });
  document.getElementById("debrief-btn")?.addEventListener("click", requestPracticeDebrief);
  document.getElementById("export-summary-btn")?.addEventListener("click", () => {
    if (!currentConversationId) return;
    window.open("summary.html?id=" + encodeURIComponent(currentConversationId), "_blank");
  });
  document.getElementById("share-conversation-btn")?.addEventListener("click", openShareModal);
  document.getElementById("attach-btn")?.addEventListener("click", () => document.getElementById("file-input")?.click());
  document.getElementById("file-input")?.addEventListener("change", handleFilesSelected);
  wireVoiceInput(document.getElementById("mic-btn"), document.getElementById("input"));

  // Only the real mode tabs (Coach/Practice) switch mode in-page — the
  // Insights tab is a plain link to its own page (no data-mode), so it's
  // excluded here and just navigates normally.
  document.querySelectorAll(".mode-tab[data-mode]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.mode;
      if (mode === "practice") {
        setActiveTab("practice");
        currentConversationId = null;
        currentConvCtx = { mode: "practice", partnerName: null };
        showPartnerBanner(false);
        showComposer(false);
        renderCoachTagBar();
        renderHistory();
        renderPracticeSetup();
      } else {
        startNewChat("coach");
      }
      closeSidebarDrawer();
    });
  });

  const input = document.getElementById("input");
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  resizeComposerInput = autoGrowTextarea(input, 140);

  // Loaded here (not just inside the Practice setup screen) because Coach
  // Chat also needs to know how many partner profiles exist, to decide
  // whether the "who is this about" tag bar is even relevant — see
  // renderCoachTagBar. Harmless/cheap for users with 0-1 partner profiles,
  // which is the common case.
  await Promise.all([loadConversations(), loadPartners()]);

  const params = new URLSearchParams(window.location.search);
  const requested = params.get("c");
  if (params.get("mode") === "practice") {
    setActiveTab("practice");
    currentConvCtx = { mode: "practice", partnerName: null };
    showPartnerBanner(false);
    showComposer(false);
    renderCoachTagBar();
    renderPracticeSetup();
  } else if (params.get("new") === "1") {
    await startNewChat("coach");
  } else if (requested) {
    await openConversation(requested);
  } else if (conversations.length > 0) {
    await openConversation(conversations[0].id);
  } else {
    renderEmptyState();
  }
});

// ---------------------------------------------------------------------------
// mode / composer visibility helpers
// ---------------------------------------------------------------------------

function setActiveTab(mode) {
  currentMode = mode;
  document.querySelectorAll(".mode-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });
  const newBtn = document.getElementById("new-chat-btn");
  if (newBtn) newBtn.textContent = mode === "practice" ? "+ New practice" : "+ New chat";
  const input = document.getElementById("input");
  if (input) {
    input.placeholder = composerPlaceholder(mode);
  }
  updateExportButtonVisibility();
}

function openSidebarDrawer() {
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("sidebar-backdrop")?.classList.add("open");
}

function closeSidebarDrawer() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebar-backdrop")?.classList.remove("open");
}

function showComposer(visible) {
  const area = document.getElementById("input-area");
  const disclaimer = document.getElementById("chat-disclaimer");
  if (area) area.style.display = visible ? "flex" : "none";
  if (disclaimer) disclaimer.style.display = visible ? "block" : "none";
}

function updateExportButtonVisibility() {
  const btn = document.getElementById("export-summary-btn");
  if (btn) {
    btn.style.display = currentMode === "coach" && currentConversationId && currentConvHasUserMessage ? "inline-flex" : "none";
  }
  // Share button: same "there's actually something to share" condition as
  // the therapist export above, but not restricted to Coach — a Partner
  // Practice rehearsal is just as shareable (e.g. showing a therapist or a
  // friend how a rehearsal went), so this one shows in both modes.
  const shareBtn = document.getElementById("share-conversation-btn");
  if (shareBtn) {
    shareBtn.style.display = currentConversationId && currentConvHasUserMessage ? "inline-flex" : "none";
  }
}

function showPartnerBanner(visible, name, scenario, meta) {
  const banner = document.getElementById("partner-banner");
  if (!banner) return;
  banner.style.display = visible ? "flex" : "none";
  if (visible) {
    const nameEl = document.getElementById("partner-banner-name");
    if (nameEl) nameEl.textContent = name || "your partner";
    const scenarioEl = document.getElementById("partner-banner-scenario");
    if (scenarioEl) {
      if (scenario) {
        scenarioEl.textContent = `Practicing: ${scenario}`;
        scenarioEl.style.display = "block";
      } else {
        scenarioEl.style.display = "none";
      }
    }
    const tagsEl = document.getElementById("partner-banner-tags");
    if (tagsEl) {
      const tags = [];
      if (meta?.roleSwap) tags.push("🔄 Roles swapped");
      if (meta?.intensity === "supportive") tags.push("🌱 Supportive mode");
      if (tags.length) {
        tagsEl.textContent = tags.join(" · ");
        tagsEl.style.display = "block";
      } else {
        tagsEl.style.display = "none";
      }
    }
  }
}

// Lets the user say which partner profile a Coach Chat conversation is
// about — self-reported, not guessed. Shown for any Coach Chat conversation
// as long as there's at least one partner profile to reference (task #96 —
// previously this required MORE than one, so with exactly one partner
// profile — the single most common case — there was no visible "who is
// this about" at all, even though that's exactly the orientation cue
// someone with one relationship in the app benefits from most). With only
// one partner the automatic learning in server.js already treats all Coach
// Chat history as belonging to that relationship regardless of this tag —
// see learnPartnerProfileIfStale in server.js — so the tag itself stays
// optional either way; this only changes whether the label is visible.
function renderCoachTagBar() {
  const bar = document.getElementById("coach-tag-bar");
  if (!bar) return;

  if (currentConvCtx.mode !== "coach" || !currentConversationId || partners.length === 0) {
    bar.style.display = "none";
    return;
  }

  bar.style.display = "flex";
  const chipsDiv = document.getElementById("coach-tag-chips");
  const current = currentConvCtx.aboutPartnerId || null;
  const options = [...partners.map((p) => ({ id: p.id, label: p.name })), { id: null, label: "Not sure" }];

  chipsDiv.innerHTML = options
    .map(
      (opt) =>
        `<button type="button" class="coach-tag-chip${opt.id === current ? " active" : ""}" data-id="${opt.id ? escapeHtml(opt.id) : ""}">${escapeHtml(opt.label)}</button>`
    )
    .join("");

  chipsDiv.querySelectorAll(".coach-tag-chip").forEach((chip) => {
    chip.addEventListener("click", async () => {
      const newId = chip.dataset.id || null;
      if (newId === (currentConvCtx.aboutPartnerId || null)) return;
      chip.disabled = true;
      try {
        const res = await authFetch(`/api/conversations/${encodeURIComponent(currentConversationId)}`, {
          method: "PATCH",
          body: JSON.stringify({ aboutPartnerId: newId }),
        });
        if (!res.ok) return;
        currentConvCtx.aboutPartnerId = newId;
        const entry = conversations.find((c) => c.id === currentConversationId);
        if (entry) entry.aboutPartnerId = newId;
        renderCoachTagBar();
      } catch (err) {
        console.error(err);
        chip.disabled = false;
      }
    });
  });
}

// ---------------------------------------------------------------------------
// attachments (images, screen recordings, other files) — picking + preview
// ---------------------------------------------------------------------------

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Couldn't read file"));
    reader.readAsDataURL(file);
  });
}

function classifyAttachmentKind(mimeType) {
  if (!mimeType) return "file";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "file";
}

function formatFileSize(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// `opts.upgradeRequired` renders a real "Upgrade to Pro" button alongside
// the message (wired straight to Stripe Checkout via startCheckout, same as
// the pricing page buttons) and skips the auto-hide timeout — a plan-limit
// notice needs to stay up long enough to actually be read and acted on, not
// vanish after 4.5s like a routine validation error (e.g. "paste a message
// first").
function showComposerError(msg, opts) {
  let el = document.getElementById("composer-error");
  if (!el) {
    el = document.createElement("div");
    el.id = "composer-error";
    el.className = "form-error";
    el.style.margin = "0 0 10px";
    document.getElementById("composer")?.before(el);
  }
  el.innerHTML = "";
  el.classList.toggle("form-error-with-action", !!(opts && opts.upgradeRequired));

  const textSpan = document.createElement("span");
  textSpan.textContent = msg;
  el.appendChild(textSpan);

  clearTimeout(composerErrorTimeout);
  el.style.display = opts && opts.upgradeRequired ? "flex" : "block";

  if (opts && opts.upgradeRequired) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-gradient btn-sm";
    btn.textContent = "Upgrade to Pro";
    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.textContent = "Redirecting…";
      startCheckout("pro").finally(() => {
        btn.disabled = false;
        btn.textContent = "Upgrade to Pro";
      });
    });
    el.appendChild(btn);
  } else {
    composerErrorTimeout = setTimeout(() => {
      el.style.display = "none";
    }, 4500);
  }
}

async function handleFilesSelected(event) {
  const files = Array.from(event.target.files || []);
  event.target.value = ""; // allow re-selecting the same file later

  const limit = maxFilesPerMessage();
  for (const file of files) {
    if (pendingAttachments.length >= limit) {
      const upgradeHint = getUser()?.plan === "free" ? " Upgrade to Pro for up to 3 files per message." : "";
      showComposerError(`You can attach up to ${limit} file${limit === 1 ? "" : "s"} per message.${upgradeHint}`);
      break;
    }
    const currentTotal = pendingAttachments.reduce((sum, a) => sum + a.size, 0);
    if (currentTotal + file.size > MAX_TOTAL_UPLOAD_BYTES) {
      showComposerError(`Attachments are limited to ${Math.round(MAX_TOTAL_UPLOAD_BYTES / 1024 / 1024)}MB total per message.`);
      break;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      pendingAttachments.push({
        localId: "local_" + Math.random().toString(36).slice(2),
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl,
        kind: classifyAttachmentKind(file.type),
      });
    } catch (err) {
      showComposerError(`Couldn't read "${file.name}".`);
    }
  }

  renderAttachmentPreview();
}

function renderAttachmentPreview() {
  const preview = document.getElementById("attachment-preview");
  if (!preview) return;
  preview.innerHTML = "";

  if (pendingAttachments.length === 0) {
    preview.style.display = "none";
    return;
  }

  preview.style.display = "flex";
  pendingAttachments.forEach((a) => {
    const chip = document.createElement("div");
    chip.className = "attachment-chip";

    const thumb =
      a.kind === "image"
        ? `<img class="attachment-chip-thumb" src="${a.dataUrl}" alt="" />`
        : `<span class="attachment-chip-thumb" style="display:flex;align-items:center;justify-content:center;">${a.kind === "video" ? "🎬" : "📄"}</span>`;

    chip.innerHTML = `${thumb}<span class="attachment-chip-name">${escapeHtml(a.name)}</span>`;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "attachment-chip-remove";
    removeBtn.setAttribute("aria-label", "Remove attachment");
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      pendingAttachments = pendingAttachments.filter((x) => x.localId !== a.localId);
      renderAttachmentPreview();
    });
    chip.appendChild(removeBtn);

    preview.appendChild(chip);
  });
}

function clearPendingAttachments() {
  pendingAttachments = [];
  renderAttachmentPreview();
}

function renderAttachments(bubble, attachments) {
  if (!attachments || attachments.length === 0) return;

  const wrap = document.createElement("div");
  wrap.className = "message-attachments";

  attachments.forEach((att) => {
    const src = att.url || att.dataUrl;
    if (!src) return;

    if (att.kind === "image") {
      const a = document.createElement("a");
      a.href = src;
      a.target = "_blank";
      a.rel = "noopener";
      a.className = "attachment-image-link";
      const img = document.createElement("img");
      img.src = src;
      img.alt = att.name || "attached image";
      a.appendChild(img);
      wrap.appendChild(a);
    } else if (att.kind === "video") {
      const div = document.createElement("div");
      div.className = "attachment-video-wrap";
      const video = document.createElement("video");
      video.src = src;
      video.controls = true;
      div.appendChild(video);
      wrap.appendChild(div);
    } else {
      const a = document.createElement("a");
      a.href = src;
      a.target = "_blank";
      a.rel = "noopener";
      a.className = "attachment-file-chip";
      a.innerHTML = `<span class="attachment-file-icon">📄</span><span class="attachment-file-meta"><span class="attachment-file-name">${escapeHtml(
        att.name || "file"
      )}</span><span class="attachment-file-size">${formatFileSize(att.size)}</span></span>`;
      wrap.appendChild(a);
    }
  });

  bubble.appendChild(wrap);
}

// ---------------------------------------------------------------------------
// conversation history (sidebar)
// ---------------------------------------------------------------------------

async function loadConversations() {
  try {
    const res = await authFetch("/api/conversations");
    const data = await safeJson(res);
    conversations = Array.isArray(data) ? data : [];
    renderHistory();
  } catch (err) {
    console.error(err);
  }
}

// Recency buckets for the sidebar history (task #95) — same idea as
// ChatGPT's own history sidebar, so someone with dozens of conversations
// has actual landmarks to scan for instead of one long undifferentiated
// list. Order matters here (render order below follows this exactly);
// "Today" covers anything from the start of the current calendar day,
// including a moment in the future (clock skew) — never negative.
const HISTORY_BUCKETS = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];

function historyBucketLabel(updatedAt) {
  const now = new Date();
  const date = new Date(updatedAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday - startOfDate) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Previous 7 days";
  if (diffDays <= 30) return "Previous 30 days";
  return "Older";
}

// opts.onSelect (used by openHistoryModal below) runs after a row is
// clicked and the conversation opened, so the modal can close itself.
function buildHistoryItem(c, opts) {
  const div = document.createElement("div");
  div.className = "chat-item" + (c.id === currentConversationId ? " active" : "");

  // Same 💬/🎭 pairing as the mode tabs right below this list (and as
  // dashboard.js's own conversation list) — instantly recognizable at a
  // glance, unlike the old plain color dot this replaces.
  const icon = document.createElement("span");
  icon.className = "chat-item-icon";
  icon.textContent = c.mode === "practice" ? "🎭" : "💬";
  div.appendChild(icon);

  if (c.pinned) {
    const pinIcon = document.createElement("span");
    pinIcon.className = "chat-item-pin-icon";
    pinIcon.innerHTML = PIN_ICON_SVG;
    pinIcon.title = "Pinned";
    div.appendChild(pinIcon);
  }

  const label = document.createElement("span");
  label.className = "chat-item-label";
  label.textContent = c.title || "New conversation";
  div.appendChild(label);

  // "⋮" options menu (task #97) — Pin/Unpin, Rename, Delete. Replaces the
  // old always-visible trash-can button; Delete now lives inside the menu.
  const menuBtn = document.createElement("button");
  menuBtn.type = "button";
  menuBtn.className = "chat-item-menu-btn";
  menuBtn.setAttribute("aria-label", "Conversation options");
  menuBtn.setAttribute("aria-haspopup", "true");
  menuBtn.setAttribute("aria-expanded", "false");
  menuBtn.innerHTML = KEBAB_ICON_SVG;
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (openHistoryMenuTriggerBtn === menuBtn) {
      closeHistoryMenu();
    } else {
      openHistoryMenu(c, menuBtn);
    }
  });
  div.appendChild(menuBtn);

  div.addEventListener("click", () => {
    openConversation(c.id);
    closeSidebarDrawer();
    if (opts && opts.onSelect) opts.onSelect();
  });
  return div;
}

// Opens the anchored "⋮" popover for conversation c, positioned off
// triggerBtn's own bounding rect. Appended to <body> (not .sidebar-history
// or .history-modal-list) specifically so it's never clipped by either
// container's overflow-y: auto — see the .chat-item-menu CSS comment.
function openHistoryMenu(c, triggerBtn) {
  closeHistoryMenu();

  const menu = document.createElement("div");
  menu.className = "chat-item-menu";
  menu.innerHTML = `
    <button type="button" class="chat-item-menu-item" data-action="pin">${PIN_ICON_SVG}<span>${c.pinned ? "Unpin" : "Pin"}</span></button>
    <button type="button" class="chat-item-menu-item" data-action="rename">${PENCIL_ICON_SVG}<span>Rename</span></button>
    <button type="button" class="chat-item-menu-item chat-item-menu-item-danger" data-action="delete">${TRASH_ICON_SVG}<span>Delete</span></button>
  `;
  document.body.appendChild(menu);

  const triggerRect = triggerBtn.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  let top = triggerRect.bottom + 4;
  if (top + menuRect.height > window.innerHeight - 8) {
    top = triggerRect.top - menuRect.height - 4;
  }
  let left = triggerRect.right - menuRect.width;
  left = Math.max(8, Math.min(left, window.innerWidth - menuRect.width - 8));
  menu.style.top = `${Math.max(8, top)}px`;
  menu.style.left = `${left}px`;

  triggerBtn.setAttribute("aria-expanded", "true");
  openHistoryMenuEl = menu;
  openHistoryMenuTriggerBtn = triggerBtn;

  menu.querySelector('[data-action="pin"]').addEventListener("click", (e) => {
    e.stopPropagation();
    closeHistoryMenu();
    toggleConversationPin(c);
  });
  menu.querySelector('[data-action="rename"]').addEventListener("click", (e) => {
    e.stopPropagation();
    closeHistoryMenu();
    renameConversation(c);
  });
  menu.querySelector('[data-action="delete"]').addEventListener("click", (e) => {
    e.stopPropagation();
    closeHistoryMenu();
    deleteConversation(c.id);
  });

  // Deferred by a tick so the click that opened the menu (still bubbling
  // when this runs synchronously) doesn't immediately close it again.
  setTimeout(() => {
    document.addEventListener("click", onHistoryMenuOutsideClick, true);
    document.addEventListener("keydown", onHistoryMenuKeydown, true);
    window.addEventListener("scroll", closeHistoryMenu, true);
    window.addEventListener("resize", closeHistoryMenu);
  }, 0);
}

function closeHistoryMenu() {
  if (!openHistoryMenuEl) return;
  openHistoryMenuEl.remove();
  if (openHistoryMenuTriggerBtn) openHistoryMenuTriggerBtn.setAttribute("aria-expanded", "false");
  document.removeEventListener("click", onHistoryMenuOutsideClick, true);
  document.removeEventListener("keydown", onHistoryMenuKeydown, true);
  window.removeEventListener("scroll", closeHistoryMenu, true);
  window.removeEventListener("resize", closeHistoryMenu);
  openHistoryMenuEl = null;
  openHistoryMenuTriggerBtn = null;
}

function onHistoryMenuOutsideClick(e) {
  if (!openHistoryMenuEl || openHistoryMenuEl.contains(e.target)) return;
  // Leave a click on the trigger button that opened this very menu alone —
  // this listener runs in the capture phase, before that button's own click
  // handler (buildHistoryItem) gets to toggle it closed, so closing here too
  // would just cause openHistoryMenu() to immediately reopen it right after.
  if (openHistoryMenuTriggerBtn && openHistoryMenuTriggerBtn.contains(e.target)) return;
  closeHistoryMenu();
}

function onHistoryMenuKeydown(e) {
  if (e.key !== "Escape") return;
  // Stop here (this listener runs in the capture phase, before the "View
  // all" modal's own Escape handler) so Escape closes just the popover when
  // one is open over the modal, not both layers in one keypress.
  e.stopPropagation();
  closeHistoryMenu();
}

async function toggleConversationPin(c) {
  const nextPinned = !c.pinned;
  try {
    const res = await authFetch("/api/conversations/" + encodeURIComponent(c.id), {
      method: "PATCH",
      body: JSON.stringify({ pinned: nextPinned }),
    });
    if (!res.ok) {
      const data = await safeJson(res);
      await showAppAlert(data.error || "Couldn't update that conversation.");
      return;
    }
    c.pinned = nextPinned;
    renderHistory();
  } catch (err) {
    console.error(err);
    await showAppAlert("Couldn't update that conversation. Check your connection and try again.");
  }
}

async function renameConversation(c) {
  const newTitle = await showAppPrompt("Rename conversation", c.title || "", { confirmLabel: "Rename", maxLength: 120 });
  if (newTitle === null || newTitle === (c.title || "")) return;

  try {
    const res = await authFetch("/api/conversations/" + encodeURIComponent(c.id), {
      method: "PATCH",
      body: JSON.stringify({ title: newTitle }),
    });
    if (!res.ok) {
      const data = await safeJson(res);
      await showAppAlert(data.error || "Couldn't rename that conversation.");
      return;
    }
    c.title = newTitle;
    renderHistory();
  } catch (err) {
    console.error(err);
    await showAppAlert("Couldn't rename that conversation. Check your connection and try again.");
  }
}

// Groups `list` into a "📌 Pinned" section (if any) followed by the
// HISTORY_BUCKETS date groups, appending header + row elements straight
// into `container`. Shared by the sidebar (#history) and the "View all"
// modal's list so both render identically — see renderHistory and
// openHistoryModal.
function appendHistoryGroups(container, list, opts) {
  const pinned = list.filter((c) => c.pinned).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const rest = list.filter((c) => !c.pinned);

  if (pinned.length > 0) {
    const header = document.createElement("div");
    header.className = "history-group-label";
    header.textContent = "📌 Pinned";
    container.appendChild(header);
    pinned.forEach((c) => container.appendChild(buildHistoryItem(c, opts)));
  }

  // rest is already sorted most-recent-first (see GET /api/conversations in
  // server.js), so grouping by bucket below preserves that order within
  // each group without needing to re-sort anything.
  const groups = new Map();
  rest.forEach((c) => {
    const bucket = historyBucketLabel(c.updatedAt);
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket).push(c);
  });

  HISTORY_BUCKETS.forEach((bucket) => {
    const items = groups.get(bucket);
    if (!items || items.length === 0) return;

    const header = document.createElement("div");
    header.className = "history-group-label";
    header.textContent = bucket;
    container.appendChild(header);

    items.forEach((c) => container.appendChild(buildHistoryItem(c, opts)));
  });
}

// How many non-pinned conversations the sidebar itself shows before
// deferring the rest to "View all conversations" (task #97) — keeps the
// sidebar short and scannable the way task #95 originally intended, now
// that a long history no longer means a long sidebar. Pinned conversations
// are exempt: a user only pins a handful on purpose, so there's no reason
// to hide any of them here.
const HISTORY_SIDEBAR_RECENT_LIMIT = 8;

function renderHistory() {
  const historyDiv = document.getElementById("history");
  historyDiv.innerHTML = "";

  if (conversations.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "No conversations yet";
    historyDiv.appendChild(empty);
    return;
  }

  // Client-side title search (task #95) — cheap and instant since the full
  // list is already loaded; no reason to round-trip to the server for
  // something this small. #history-search's input listener just calls
  // renderHistory() again, so this always reflects the current box value.
  // Search always runs over the FULL conversations list (never just the
  // capped view below), so it can always find what it's looking for.
  const query = (document.getElementById("history-search")?.value || "").trim().toLowerCase();
  const filtered = query ? conversations.filter((c) => (c.title || "New conversation").toLowerCase().includes(query)) : conversations;

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = `No conversations match "${query}"`;
    historyDiv.appendChild(empty);
    return;
  }

  if (query) {
    appendHistoryGroups(historyDiv, filtered);
    return;
  }

  const pinned = filtered.filter((c) => c.pinned);
  const unpinned = filtered.filter((c) => !c.pinned).slice(0, HISTORY_SIDEBAR_RECENT_LIMIT);
  appendHistoryGroups(historyDiv, pinned.concat(unpinned));

  const viewAllBtn = document.createElement("button");
  viewAllBtn.type = "button";
  viewAllBtn.className = "history-view-all-btn";
  viewAllBtn.textContent = `View all conversations (${conversations.length}) →`;
  viewAllBtn.addEventListener("click", openHistoryModal);
  historyDiv.appendChild(viewAllBtn);
}

// "View all conversations" (task #97) — a bigger, dedicated view of the
// complete, searchable history, for when the sidebar's own capped list
// (HISTORY_SIDEBAR_RECENT_LIMIT) doesn't have what the user is looking for.
// Reuses the exact same row markup and "⋮" menu as the sidebar.
function openHistoryModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const card = document.createElement("div");
  card.className = "modal-card history-modal-card";
  card.innerHTML = `
    <div class="history-modal-header">
      <h3>All conversations</h3>
      <button type="button" class="history-modal-close" aria-label="Close">✕</button>
    </div>
    <input type="search" class="history-search history-modal-search" id="history-modal-search" placeholder="Search conversations…" aria-label="Search conversations" autocomplete="off" />
    <div class="history-modal-list" id="history-modal-list"></div>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function renderModalList() {
    const listEl = card.querySelector("#history-modal-list");
    listEl.innerHTML = "";
    const query = (card.querySelector("#history-modal-search")?.value || "").trim().toLowerCase();
    const filtered = query ? conversations.filter((c) => (c.title || "New conversation").toLowerCase().includes(query)) : conversations;

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history-empty";
      empty.textContent = query ? `No conversations match "${query}"` : "No conversations yet";
      listEl.appendChild(empty);
      return;
    }
    appendHistoryGroups(listEl, filtered, { onSelect: closeModal });
  }

  function closeModal() {
    closeHistoryMenu();
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
  }
  function onKeydown(e) {
    if (e.key === "Escape") closeModal();
  }
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
  card.querySelector(".history-modal-close").addEventListener("click", closeModal);
  card.querySelector("#history-modal-search").addEventListener("input", renderModalList);

  document.addEventListener("keydown", onKeydown);
  renderModalList();
  card.querySelector("#history-modal-search").focus();
}

async function deleteConversation(id) {
  const target = conversations.find((c) => c.id === id);
  const label = target?.title ? `"${target.title}"` : "this conversation";
  const ok = await showAppConfirm(`Delete ${label}? This can't be undone.`, { confirmLabel: "Delete", danger: true });
  if (!ok) return;

  try {
    const res = await authFetch("/api/conversations/" + encodeURIComponent(id), { method: "DELETE" });
    if (!res.ok) {
      const data = await safeJson(res);
      await showAppAlert(data.error || "Couldn't delete that conversation.");
      return;
    }

    conversations = conversations.filter((c) => c.id !== id);
    renderHistory();

    if (id === currentConversationId) {
      currentConversationId = null;
      if (conversations.length > 0) {
        await openConversation(conversations[0].id);
      } else {
        resetEditState();
        currentConvCtx = { mode: "coach", partnerName: null };
        setActiveTab("coach");
        showPartnerBanner(false);
        showComposer(true);
        renderEmptyState();
      }
    }
  } catch (err) {
    console.error(err);
    await showAppAlert("Couldn't connect to the server.");
  }
}

// Dismissible one-time tip (task #97, competitive-differentiation pass):
// the single biggest lever a USER has over how good Coach Chat's answer is
// — more specific detail in, more specific (less generic) advice out — so
// it's worth teaching explicitly rather than hoping people discover it.
// Shown only for Coach Chat's empty state (not Practice, where it doesn't
// apply the same way), and only until dismissed once.
const DETAIL_TIP_DISMISSED_KEY = "relateiq_detail_tip_dismissed";

function isDetailTipDismissed() {
  try {
    return localStorage.getItem(DETAIL_TIP_DISMISSED_KEY) === "1";
  } catch (e) {
    return false;
  }
}

function dismissDetailTip() {
  try {
    localStorage.setItem(DETAIL_TIP_DISMISSED_KEY, "1");
  } catch (e) {
    /* ignore storage errors */
  }
}

function renderEmptyState() {
  const chatDiv = document.getElementById("chat");
  const showTip = currentConvCtx.mode !== "practice" && !isDetailTipDismissed();
  const tipHtml = showTip
    ? `<div class="empty-chat-tip" id="empty-chat-tip">
         <span>💡 The more specific detail you give — exactly what happened, what was actually said — the more specific (and less generic) the advice back will be.</span>
         <button type="button" id="empty-chat-tip-close" aria-label="Dismiss tip">✕</button>
       </div>`
    : "";
  chatDiv.innerHTML =
    `<div id="empty-state" class="empty-chat"><h2>Hi there! 👋</h2><p>Tell me what's going on in your relationship, and let's work through it together.</p>${tipHtml}</div>`;
  document.getElementById("empty-chat-tip-close")?.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissDetailTip();
    document.getElementById("empty-chat-tip")?.remove();
  });
}

// ---------------------------------------------------------------------------
// Practice mode — partner profile setup screen
// ---------------------------------------------------------------------------

async function loadPartners() {
  try {
    const res = await authFetch("/api/partners");
    const data = await safeJson(res);
    partners = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(err);
    partners = [];
  }
}

// Shared by "+ Create a new partner profile" and each card's edit button
// (see buildPartnerCard) — both act on the #partner-form rendered inside
// renderPracticeSetup. Passing a partner pre-fills the form and swaps the
// submit handler over to PATCH (see editingPartnerId); passing nothing
// resets it to a blank create form. Top-level (not nested inside
// renderPracticeSetup) so buildPartnerCard's edit button, which is built
// separately when the list re-renders, can call it directly.
function openPartnerForm(partner) {
  editingPartnerId = partner ? partner.id : null;
  document.getElementById("partner-name").value = partner?.name || "";
  document.getElementById("partner-traits").value = partner?.traits || "";
  resizePartnerTraits();
  document.getElementById("partner-context").value = partner?.context || "";
  document.getElementById("partner-attachment").value = partner?.attachmentStyle || "";
  document.getElementById("partner-form-error").style.display = "none";
  document.getElementById("partner-form-submit").textContent = partner ? "Save changes" : "Save & start practicing";
  document.getElementById("partner-form-cancel-btn").style.display = partner ? "block" : "none";
  document.getElementById("partner-form").style.display = "block";
  document.getElementById("show-partner-form-btn").style.display = "none";
}

function closePartnerForm() {
  editingPartnerId = null;
  const form = document.getElementById("partner-form");
  form.reset();
  form.style.display = "none";
  document.getElementById("show-partner-form-btn").style.display = "block";
}

async function renderPracticeSetup() {
  const chatDiv = document.getElementById("chat");
  chatDiv.innerHTML = `
    <div class="practice-setup" id="practice-setup">
      <div class="practice-setup-intro">
        <h2>Practice a real conversation</h2>
        <p class="text-muted">Pick who you want to practice talking to. The AI will roleplay as them, in character, so you can rehearse before the real thing.</p>
      </div>

      <div class="practice-limit-banner" id="practice-limit-banner" style="display:none;"></div>

      <div class="practice-setup-card">
        <div class="practice-setup-field">
          <label class="practice-setup-field-label" for="practice-scenario">What do you want to practice today? <span class="text-muted">(optional)</span></label>
          <input type="text" id="practice-scenario" maxlength="300" placeholder="e.g. asking for more help with the kids without it turning into a fight" autocomplete="off" />
          <button type="button" class="scenario-library-toggle" id="scenario-library-toggle">💡 Need an idea? Browse scenarios</button>
          <div class="scenario-chip-row" id="scenario-chip-row" style="display:none;"></div>
        </div>

        <div class="practice-setup-divider"></div>

        <div class="practice-setup-field">
          <label class="practice-setup-field-label">Intensity</label>
          <div class="intensity-toggle" id="intensity-toggle" role="group" aria-label="Practice intensity">
            <button type="button" class="intensity-option is-active" data-value="realistic" aria-pressed="true">
              <span class="intensity-option-title">Realistic</span>
              <span class="intensity-option-desc">Real friction &amp; pushback</span>
            </button>
            <button type="button" class="intensity-option" data-value="supportive" aria-pressed="false">
              <span class="intensity-option-title">Supportive</span>
              <span class="intensity-option-desc">Gentler, for building confidence</span>
            </button>
          </div>
          <select id="practice-intensity" style="display:none;" aria-hidden="true" tabindex="-1">
            <option value="realistic">Realistic — real friction &amp; pushback</option>
            <option value="supportive">Supportive — gentler, for building confidence</option>
          </select>
        </div>

        <label class="role-swap-row" for="practice-role-swap">
          <span class="role-swap-text">
            <span class="role-swap-title">Swap roles</span>
            <span class="role-swap-desc">I'll voice my partner, AI plays me</span>
          </span>
          <span class="switch">
            <input type="checkbox" id="practice-role-swap" />
            <span class="switch-track"><span class="switch-thumb"></span></span>
          </span>
        </label>
      </div>

      <div class="practice-setup-partners">
        <label class="practice-setup-field-label">Who do you want to practice with?</label>
        <div class="form-error" id="practice-setup-error" style="display:none;"></div>
        <div class="partner-list" id="partner-list"><p class="text-muted">Loading…</p></div>
        <button class="btn btn-ghost btn-block" id="show-partner-form-btn" type="button">+ Create a new partner profile</button>
      </div>
      <form class="partner-form" id="partner-form" style="display:none;">
        <div class="form-error" id="partner-form-error" style="display:none;"></div>
        <label for="partner-name">Name</label>
        <input type="text" id="partner-name" required maxlength="60" placeholder="e.g. Alex" autocomplete="off" />
        <label for="partner-traits">Personality — how they usually are</label>
        <textarea id="partner-traits" rows="3" maxlength="500" placeholder="e.g. warm but avoids conflict, gets quiet when stressed, jokes to deflect difficult topics"></textarea>
        <label for="partner-context">Context (optional)</label>
        <input type="text" id="partner-context" maxlength="200" placeholder="e.g. together 2 years, we just moved in together" autocomplete="off" />
        <label for="partner-attachment">Their attachment style <span class="text-muted">(optional — only if you already know it)</span></label>
        <select id="partner-attachment">
          <option value="">Not sure / skip</option>
          <option value="secure">Secure</option>
          <option value="anxious">Anxious</option>
          <option value="avoidant">Avoidant</option>
          <option value="disorganized">Disorganized (Fearful-Avoidant)</option>
        </select>
        <p class="text-muted" style="font-size:12px; margin-top:-6px;">When set, RelateIQ plays them with realistic patterns for that style — like pulling back under pressure, or needing more reassurance — so the practice feels closer to the real thing.</p>
        <p class="text-muted" style="font-size:11.5px; margin-top:6px;">You're entering information about another real person here, not just yourself — please use this to prepare for a kinder conversation, not to build a case against them. Only you can see this profile.</p>
        <div class="partner-form-actions">
          <button type="submit" class="btn btn-gradient btn-block" id="partner-form-submit">Save &amp; start practicing</button>
          <button type="button" class="btn btn-ghost btn-block" id="partner-form-cancel-btn" style="display:none;">Cancel</button>
        </div>
      </form>
    </div>
  `;

  const form = document.getElementById("partner-form");
  const showFormBtn = document.getElementById("show-partner-form-btn");

  showFormBtn.addEventListener("click", () => openPartnerForm(null));
  document.getElementById("partner-form-cancel-btn").addEventListener("click", closePartnerForm);
  resizePartnerTraits = autoGrowTextarea(document.getElementById("partner-traits"));

  // Scenario library — a "need an idea?" toggle that reveals a row of chips;
  // clicking one fills the scenario input but leaves it freely editable.
  const scenarioInput = document.getElementById("practice-scenario");
  const chipToggle = document.getElementById("scenario-library-toggle");
  const chipRow = document.getElementById("scenario-chip-row");
  chipToggle.addEventListener("click", () => {
    const showing = chipRow.style.display !== "none";
    if (!showing && chipRow.children.length === 0) {
      PRACTICE_SCENARIO_LIBRARY.forEach((s) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "scenario-chip";
        chip.textContent = s;
        chip.addEventListener("click", () => {
          scenarioInput.value = s;
          chipRow.style.display = "none";
          chipToggle.textContent = "💡 Need an idea? Browse scenarios";
        });
        chipRow.appendChild(chip);
      });
    }
    chipRow.style.display = showing ? "none" : "flex";
    chipToggle.textContent = showing ? "💡 Need an idea? Browse scenarios" : "Hide suggestions";
  });

  // Intensity segmented control — two visible buttons that drive a hidden
  // <select id="practice-intensity">, which stays the source of truth read
  // by selectPartnerAndStart(). Keeping the real <select> in the DOM (just
  // visually hidden, not removed) means none of that existing read logic
  // needs to change.
  const intensitySelect = document.getElementById("practice-intensity");
  document.querySelectorAll(".intensity-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".intensity-option").forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-pressed", "true");
      intensitySelect.value = btn.dataset.value;
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("partner-name").value.trim();
    const traits = document.getElementById("partner-traits").value.trim();
    const context = document.getElementById("partner-context").value.trim();
    const attachmentStyle = document.getElementById("partner-attachment").value;
    const errorBox = document.getElementById("partner-form-error");
    errorBox.style.display = "none";

    if (!name) return;

    try {
      if (editingPartnerId) {
        const res = await authFetch(`/api/partners/${encodeURIComponent(editingPartnerId)}`, {
          method: "PATCH",
          body: JSON.stringify({ name, traits, context, attachmentStyle }),
        });
        const updated = await safeJson(res);
        if (!res.ok) {
          errorBox.textContent = updated.error || "Couldn't save those changes.";
          errorBox.style.display = "block";
          return;
        }
        const idx = partners.findIndex((x) => x.id === updated.id);
        if (idx !== -1) partners[idx] = updated;
        closePartnerForm();
        renderPartnerList();
      } else {
        const res = await authFetch("/api/partners", {
          method: "POST",
          body: JSON.stringify({ name, traits, context, attachmentStyle }),
        });
        const partner = await safeJson(res);
        if (!res.ok) {
          errorBox.textContent = partner.error || "Couldn't save that partner profile.";
          errorBox.style.display = "block";
          return;
        }
        partners.unshift(partner);
        await selectPartnerAndStart(partner.id);
      }
    } catch (err) {
      errorBox.textContent = "Couldn't connect to the server.";
      errorBox.style.display = "block";
    }
  });

  // Rendered immediately from the cached session (no flash of nothing), then
  // refreshed from the server — the cached count can be stale right after
  // finishing a rehearsal elsewhere in the same session (POST
  // /api/conversations doesn't return the updated user object, only the new
  // conversation), and this screen in particular is exactly where a stale
  // "1 left" would be misleading right before someone clicks a partner card.
  renderPracticeLimitBanner(getUser());
  authFetch("/api/me")
    .then(safeJson)
    .then((data) => {
      if (!data || !data.plan) return;
      renderPracticeLimitBanner(data);
      const token = getToken();
      if (token) setSession(token, data);
    })
    .catch(() => {
      // Non-critical — the banner just stays at whatever the cached plan said.
    });

  await loadPartners();
  renderPartnerList();
}

// Free-plan-only "N of LIMIT free rehearsals left" banner on the Practice
// setup screen (task #92) — shown BEFORE anyone picks a partner, so hitting
// FREE_LIFETIME_PRACTICE_CONVERSATIONS is never a surprise 403 after
// already filling out a scenario and picking someone to practice with.
// Pro/Premium have no lifetime cap (practiceConversations is null for
// them — see publicUser in server.js), so this stays hidden. Once the free
// rehearsal(s) are used up, this doubles as the primary "upgrade" nudge for
// Practice mode, right where someone would otherwise hit a dead end.
function renderPracticeLimitBanner(user) {
  const banner = document.getElementById("practice-limit-banner");
  if (!banner) return; // setup screen isn't showing (e.g. this resolved after navigating away)

  const pc = user && user.practiceConversations;
  if (!user || user.plan !== "free" || !pc) {
    banner.style.display = "none";
    return;
  }

  const remaining = Math.max(0, pc.limit - pc.used);
  banner.innerHTML = "";
  banner.classList.toggle("practice-limit-banner-exhausted", remaining <= 0);

  const textSpan = document.createElement("span");
  textSpan.textContent =
    remaining > 0
      ? `🎭 Free plan: ${remaining} of ${pc.limit} practice rehearsal${pc.limit === 1 ? "" : "s"} left.`
      : `🎭 You've used your free Partner Practice rehearsal${pc.limit === 1 ? "" : "s"}. Upgrade to Pro for unlimited practice.`;
  banner.appendChild(textSpan);

  if (remaining <= 0) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-gradient btn-sm";
    btn.textContent = "Upgrade to Pro";
    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.textContent = "Redirecting…";
      startCheckout("pro").finally(() => {
        btn.disabled = false;
        btn.textContent = "Upgrade to Pro";
      });
    });
    banner.appendChild(btn);
  }

  banner.style.display = "flex";
}

// Inline error for the Practice setup screen (task #92) — same visual shape
// as showComposerError (text + an optional "Upgrade to Pro" button for a
// plan-limit rejection), but composer-error's element lives inside
// #input-area, which is hidden (showComposer(false)) while this screen is
// showing, so composer-error itself is invisible here. This targets its own
// #practice-setup-error instead, so the free-limit rejection from clicking
// a partner card actually reaches the person instead of the old bare
// alert().
function showPracticeSetupError(msg, opts) {
  const el = document.getElementById("practice-setup-error");
  if (!el) return;
  el.innerHTML = "";
  el.classList.toggle("form-error-with-action", !!(opts && opts.upgradeRequired));

  const textSpan = document.createElement("span");
  textSpan.textContent = msg;
  el.appendChild(textSpan);

  clearTimeout(practiceSetupErrorTimeout);
  el.style.display = opts && opts.upgradeRequired ? "flex" : "block";

  if (opts && opts.upgradeRequired) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-gradient btn-sm";
    btn.textContent = "Upgrade to Pro";
    btn.addEventListener("click", () => {
      btn.disabled = true;
      btn.textContent = "Redirecting…";
      startCheckout("pro").finally(() => {
        btn.disabled = false;
        btn.textContent = "Upgrade to Pro";
      });
    });
    el.appendChild(btn);
  } else {
    practiceSetupErrorTimeout = setTimeout(() => {
      el.style.display = "none";
    }, 4500);
  }
}

async function deletePartnerAction(p) {
  const ok = await showAppConfirm(
    `Delete ${p.name}'s profile? This can't be undone, and any practice conversations you had with them will lose their partner context.`,
    { confirmLabel: "Delete", danger: true }
  );
  if (!ok) return;
  try {
    const res = await authFetch(`/api/partners/${encodeURIComponent(p.id)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await safeJson(res);
      await showAppAlert(data.error || "Couldn't delete that partner profile.");
      return;
    }
    partners = partners.filter((x) => x.id !== p.id);
    renderPartnerList();
  } catch (err) {
    await showAppAlert("Couldn't connect to the server.");
  }
}

function formatShortDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch (e) {
    return "";
  }
}

// Mirrors ATTACHMENT_STYLES in server.js — kept in sync manually, no shared
// module system between server and client here.
const ATTACHMENT_STYLE_LABELS = {
  secure: "Secure",
  anxious: "Anxious",
  avoidant: "Avoidant",
  disorganized: "Disorganized",
};

function renderPartnerList() {
  const listDiv = document.getElementById("partner-list");
  if (!listDiv) return;
  listDiv.innerHTML = "";

  if (partners.length === 0) {
    listDiv.innerHTML = '<p class="text-muted" style="text-align:center;">No partner profiles yet — create one below to get started.</p>';
    return;
  }

  partners.forEach((p) => {
    const wrap = document.createElement("div");
    wrap.className = "partner-card-wrap";
    wrap.appendChild(buildPartnerCard(p));
    wrap.appendChild(buildPartnerLearnRow(p));
    listDiv.appendChild(wrap);
  });
}

function buildPartnerCard(p) {
  const styleLabel = ATTACHMENT_STYLE_LABELS[p.attachmentStyle];
  const card = document.createElement("div");
  card.className = "partner-card";
  card.innerHTML = `
    <div class="partner-card-avatar">${escapeHtml((p.name || "?").trim().charAt(0).toUpperCase())}</div>
    <div class="partner-card-info">
      <div class="partner-name">${escapeHtml(p.name)}${styleLabel ? ` <span class="partner-style-tag">${escapeHtml(styleLabel)}</span>` : ""}</div>
      <div class="partner-context">${escapeHtml(p.context || p.traits || "")}</div>
    </div>
    <div class="partner-card-actions">
      <button type="button" class="partner-card-icon-btn partner-card-edit" aria-label="Edit ${escapeHtml(p.name)}'s profile" title="Edit profile">${PENCIL_ICON_SVG}</button>
      <button type="button" class="partner-card-icon-btn partner-card-delete" aria-label="Delete ${escapeHtml(p.name)}'s profile" title="Delete profile">${TRASH_ICON_SVG}</button>
      <span class="text-faint">Practice →</span>
    </div>
  `;
  card.querySelector(".partner-card-edit").addEventListener("click", (e) => {
    e.stopPropagation();
    openPartnerForm(p);
  });
  card.querySelector(".partner-card-delete").addEventListener("click", (e) => {
    e.stopPropagation();
    deletePartnerAction(p);
  });
  // Attached to the whole card (not just .partner-card-info) so clicking
  // anywhere else — the "Practice →" label, empty space — still starts
  // practicing; the two icon buttons above stop the click from bubbling
  // here in the first place.
  card.addEventListener("click", () => selectPartnerAndStart(p.id));
  return card;
}

// Purely informational — RelateIQ learns this partner's behavioral profile
// from the user's own past Coach Chat messages fully automatically, in the
// background, right before a practice session starts (see
// learnPartnerProfileIfStale in server.js). There's nothing to click to make
// it happen; this row just shows what it has already noticed, if anything,
// with a quiet "view" toggle — never a button that triggers the learning
// itself. Renders nothing at all for a partner it hasn't learned about yet
// (e.g. brand new, or not enough Coach Chat history), so the list stays
// clean instead of nagging.
function buildPartnerLearnRow(p) {
  const row = document.createElement("div");
  row.className = "partner-learn-row";

  // Purely informational half — what RelateIQ already knows, if anything.
  // Renders nothing here for a partner it hasn't learned about yet (e.g.
  // brand new, or not enough material), so the list stays clean instead of
  // nagging. The wording distinguishes a profile built from real, pasted-in
  // messages (higher fidelity) from one inferred from Coach Chat mentions.
  if (p.learnedProfile) {
    const sourceLabel = p.learnedProfileSource === "real_messages" ? "from the real messages you added" : "from your chats";
    const info = document.createElement("span");
    info.className = "partner-learn-meta";
    info.innerHTML = `RelateIQ has picked up on a few things about ${escapeHtml(p.name)} ${escapeHtml(sourceLabel)} (updated ${escapeHtml(formatShortDate(p.learnedProfileUpdatedAt))}) — <button class="partner-learn-toggle" type="button">view</button> · <button class="partner-learn-toggle partner-learn-reset" type="button">forget this</button>`;
    const box = document.createElement("div");
    box.className = "partner-learned-box";
    box.style.display = "none";
    row.appendChild(info);
    row.appendChild(box);

    const toggleBtn = info.querySelector(".partner-learn-toggle");
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const showing = box.style.display !== "none";
      box.style.display = showing ? "none" : "block";
      if (!showing) {
        box.textContent = [p.learnedProfile, p.learnedVoice ? `Voice: ${p.learnedVoice}` : ""].filter(Boolean).join("\n\n");
      }
      toggleBtn.textContent = showing ? "view" : "hide";
    });

    // Clears what RelateIQ has learned so far (see resetLearned in PATCH
    // /api/partners/:id, server.js) — useful if it's picked up on something
    // stale or wrong. A fresh Coach Chat conversation, or pasting in real
    // messages again (see buildImportMessagesRow below), will rebuild it.
    const resetBtn = info.querySelector(".partner-learn-reset");
    resetBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const ok = await showAppConfirm(
        `Forget what RelateIQ has learned about ${p.name}? Their name, traits, and context stay — just the learned behavior/voice profile is cleared.`,
        { confirmLabel: "Forget it", danger: true }
      );
      if (!ok) return;
      try {
        const res = await authFetch(`/api/partners/${encodeURIComponent(p.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ resetLearned: true }),
        });
        const updated = await safeJson(res);
        if (!res.ok) {
          await showAppAlert(updated.error || "Couldn't reset that right now.");
          return;
        }
        const idx = partners.findIndex((x) => x.id === updated.id);
        if (idx !== -1) partners[idx] = updated;
        renderPartnerList();
      } catch (err) {
        await showAppAlert("Couldn't connect to the server.");
      }
    });
  }

  row.appendChild(buildImportMessagesRow(p));

  return row;
}

// Explicit, user-triggered counterpart to the automatic learning above: lets
// the user paste in real messages their partner actually sent (a chat
// export, transcribed screenshots, whatever they have) for a more accurate
// profile than anything inferred secondhand from Coach Chat. See POST
// /api/partners/:id/learn-from-messages in server.js.
function buildImportMessagesRow(p) {
  const wrap = document.createElement("div");
  wrap.className = "partner-import-row";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "partner-learn-toggle partner-import-toggle";
  toggleBtn.textContent = p.learnedProfileSource === "real_messages" ? "+ Update with more real messages" : "+ Add real messages for a more accurate profile";
  wrap.appendChild(toggleBtn);

  const form = document.createElement("div");
  form.className = "partner-import-form";
  form.style.display = "none";
  form.innerHTML = `
    <p class="text-muted" style="font-size:12px; margin:6px 0;">Paste in real messages ${escapeHtml(p.name)} actually sent you — a chat export, or just copy-pasted texts. RelateIQ will pick up on how they actually write, not just how you've described them.</p>
    <textarea class="partner-import-textarea" rows="5" maxlength="12000" placeholder="Paste messages here…"></textarea>
    <div class="form-error partner-import-error" style="display:none;"></div>
    <button type="button" class="btn btn-gradient btn-sm partner-import-submit">Learn from these messages</button>
  `;
  wrap.appendChild(form);

  const textarea = form.querySelector(".partner-import-textarea");
  const errorBox = form.querySelector(".partner-import-error");
  const submitBtn = form.querySelector(".partner-import-submit");
  // Generous cap — this field is explicitly for pasting in a whole chat
  // export (up to 12,000 characters), unlike the shorter free-text fields
  // elsewhere that use the 240px default.
  autoGrowTextarea(textarea, 320);

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const showing = form.style.display !== "none";
    form.style.display = showing ? "none" : "block";
  });
  textarea.addEventListener("click", (e) => e.stopPropagation());

  submitBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const messages = textarea.value.trim();
    errorBox.style.display = "none";
    if (!messages) {
      errorBox.textContent = "Paste a few messages first.";
      errorBox.style.display = "block";
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Learning…";
    try {
      const res = await authFetch(`/api/partners/${encodeURIComponent(p.id)}/learn-from-messages`, {
        method: "POST",
        body: JSON.stringify({ messages }),
      });
      const updated = await safeJson(res);
      if (!res.ok) {
        errorBox.textContent = updated.error || "Couldn't learn from those messages right now.";
        errorBox.style.display = "block";
        return;
      }
      const idx = partners.findIndex((x) => x.id === p.id);
      if (idx !== -1) partners[idx] = updated;
      renderPartnerList();
    } catch (err) {
      errorBox.textContent = "Couldn't connect to the server.";
      errorBox.style.display = "block";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Learn from these messages";
    }
  });

  return wrap;
}

// Shared by selectPartnerAndStart (the setup screen's "Start practicing")
// and retryPracticeConversation (the debrief card's "Try again" — task
// #91) — both just POST the same conversation shape and land on the result
// the same way, so the actual creation + navigation only lives once.
async function startPracticeConversation({ partnerProfileId, scenario, intensity, roleSwap }) {
  const res = await authFetch("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ mode: "practice", partnerProfileId, scenario, intensity, roleSwap }),
  });
  const conv = await safeJson(res);
  if (!res.ok) return { ok: false, error: conv.error, upgradeRequired: !!conv.upgradeRequired };
  conversations.unshift({
    id: conv.id,
    title: conv.title,
    updatedAt: conv.updatedAt,
    createdAt: conv.createdAt,
    mode: conv.mode,
    partnerName: conv.partnerName,
  });
  await openConversation(conv.id, conv);
  return { ok: true };
}

async function selectPartnerAndStart(partnerId) {
  try {
    const scenario = document.getElementById("practice-scenario")?.value.trim() || "";
    const intensity = document.getElementById("practice-intensity")?.value === "supportive" ? "supportive" : "realistic";
    const roleSwap = !!document.getElementById("practice-role-swap")?.checked;
    const result = await startPracticeConversation({ partnerProfileId: partnerId, scenario, intensity, roleSwap });
    if (!result.ok) {
      // Most commonly the free-plan lifetime-practice limit (see
      // FREE_LIFETIME_PRACTICE_CONVERSATIONS in server.js) — the banner
      // above the partner list already warns about this ahead of time (see
      // renderPracticeLimitBanner), this is the graceful catch for anyone
      // who clicks anyway (or hit the limit via a rehearsal in another tab).
      showPracticeSetupError(result.error || "Couldn't start that practice conversation.", { upgradeRequired: result.upgradeRequired });
    }
  } catch (err) {
    console.error(err);
    showPracticeSetupError("Couldn't connect to the server.");
  }
}

// ---------------------------------------------------------------------------
// starting / opening conversations
// ---------------------------------------------------------------------------

async function startNewChat(mode) {
  resetEditState();
  if (mode === "practice") {
    setActiveTab("practice");
    currentConversationId = null;
    showPartnerBanner(false);
    showComposer(false);
    renderHistory();
    await renderPracticeSetup();
    return;
  }

  try {
    const res = await authFetch("/api/conversations", { method: "POST", body: JSON.stringify({ mode: "coach" }) });
    const conv = await safeJson(res);
    conversations.unshift({
      id: conv.id,
      title: conv.title,
      updatedAt: conv.updatedAt,
      createdAt: conv.createdAt,
      mode: "coach",
      partnerName: null,
      aboutPartnerId: null,
    });
    currentConversationId = conv.id;
    currentConvCtx = { mode: "coach", partnerName: null, aboutPartnerId: null };
    currentConvHasUserMessage = false;
    updateExportButtonVisibility();
    setActiveTab("coach");
    showPartnerBanner(false);
    showComposer(true);
    renderCoachTagBar();
    renderHistory();
    renderEmptyState();
  } catch (err) {
    console.error(err);
  }
}

async function openConversation(id, preloadedConv) {
  resetEditState();
  try {
    let conv = preloadedConv;
    if (!conv) {
      const res = await authFetch("/api/conversations/" + encodeURIComponent(id));
      if (!res.ok) return;
      conv = await safeJson(res);
    }

    currentConversationId = conv.id;
    currentConvCtx = {
      mode: conv.mode || "coach",
      partnerName: conv.partnerName || null,
      // Needed to re-create the SAME rehearsal on "Try again" after a
      // debrief (see retryPracticeConversation) — aboutPartnerId below is a
      // different, Coach-Chat-only concept (which relationship a coaching
      // conversation is about) and doesn't apply here.
      partnerProfileId: conv.partnerProfileId || null,
      scenario: conv.scenario || null,
      aboutPartnerId: conv.aboutPartnerId || null,
      intensity: conv.intensity || null,
      roleSwap: !!conv.practiceRoleSwap,
    };
    currentConvHasUserMessage = (conv.messages || []).some((m) => m.role === "user");
    updateExportButtonVisibility();
    setActiveTab(currentConvCtx.mode);
    showComposer(true);
    showPartnerBanner(currentConvCtx.mode === "practice", currentConvCtx.partnerName, currentConvCtx.scenario, {
      intensity: currentConvCtx.intensity,
      roleSwap: currentConvCtx.roleSwap,
    });
    renderCoachTagBar();
    renderHistory();

    const chatDiv = document.getElementById("chat");
    chatDiv.innerHTML = "";

    if (!conv.messages || conv.messages.length === 0) {
      renderEmptyState();
      return;
    }

    conv.messages.forEach((msg) => appendMessage(msg.role, msg.content, false, currentConvCtx, msg.attachments, msg.id, msg.feedback));
    chatDiv.scrollTop = chatDiv.scrollHeight;
    refreshEditAffordance();
  } catch (err) {
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// messages
// ---------------------------------------------------------------------------

// Only one "play aloud" source plays at a time across the whole page — a
// speak-btn click stops whichever other one is currently active before
// starting its own, the same single-audio-channel guarantee the old
// window.speechSynthesis.cancel() gave for free when everything went
// through one shared browser queue. Now that playback is per-Audio-element
// instead, this module-level pointer to the active one's own stop()
// closure is what replaces that.
let activeSpeakButtonStop = null;

// Builds a small speaker toggle for a practice reply bubble: click to fetch
// a natural-sounding OpenAI TTS reading of it (see POST /api/voice/speak in
// server.js) and play it back, click again (or click another message) to
// stop. Replaces the old browser speechSynthesis version — same UI, real
// voice instead of a robotic one, at the cost of a brief fetch before
// playback starts (shown via a "loading" class on the button).
function buildSpeakButton(text) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "speak-btn";
  btn.setAttribute("aria-label", "Play this message aloud");
  btn.title = "Play aloud";
  btn.innerHTML = SPEAKER_ICON_SVG;

  let audioEl = null;
  let audioUrl = null;

  function stop() {
    if (audioEl) {
      audioEl.pause();
      audioEl = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      audioUrl = null;
    }
    btn.classList.remove("speaking", "loading");
    if (activeSpeakButtonStop === stop) activeSpeakButtonStop = null;
  }

  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const wasActive = btn.classList.contains("speaking") || btn.classList.contains("loading");
    // Only one message plays at a time — stop whatever else is going first.
    if (activeSpeakButtonStop) activeSpeakButtonStop();
    if (wasActive) return; // this click was just "stop"

    activeSpeakButtonStop = stop;
    btn.classList.add("loading");
    try {
      const res = await authFetch("/api/voice/speak", { method: "POST", body: JSON.stringify({ text }) });
      if (activeSpeakButtonStop !== stop) return; // superseded while the request was in flight
      if (!res.ok) throw new Error("speak request failed");
      const blob = await res.blob();
      if (activeSpeakButtonStop !== stop) return; // ditto, while reading the response body

      btn.classList.remove("loading");
      audioUrl = URL.createObjectURL(blob);
      audioEl = new Audio(audioUrl);
      btn.classList.add("speaking");
      audioEl.addEventListener("ended", stop);
      audioEl.addEventListener("error", stop);
      audioEl.play().catch(stop);
    } catch (err) {
      stop();
    }
  });

  return btn;
}

// Thumbs up/down on a Coach Chat reply — a real, per-message signal for
// whether the advice actually landed, visible to Jonas on the admin stats
// page (see PATCH /api/conversations/:id/messages/:messageId/feedback and
// the "feedback" block in /api/admin/stats). Practice mode deliberately has
// no feedback button — appendMessage only calls this for Coach replies — a
// roleplay line isn't "advice" to rate the same way. Clicking an already-
// active button clears the vote (feedback: null) rather than requiring a
// separate "undo" affordance.
function buildFeedbackButtons(conversationId, messageId, initialFeedback) {
  const wrap = document.createElement("div");
  wrap.className = "feedback-buttons";

  function makeBtn(kind, label, svg) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `feedback-btn feedback-btn-${kind}`;
    btn.setAttribute("aria-label", label);
    btn.title = label;
    btn.innerHTML = svg;
    if (initialFeedback === kind) btn.classList.add("active");

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const next = btn.classList.contains("active") ? null : kind;
      wrap.querySelectorAll(".feedback-btn").forEach((b) => b.classList.remove("active"));
      if (next) btn.classList.add("active");
      try {
        await authFetch(
          `/api/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/feedback`,
          { method: "PATCH", body: JSON.stringify({ feedback: next }) }
        );
      } catch (err) {
        // Non-critical — a vote that didn't save just doesn't stick; no
        // need to interrupt the conversation with an error over this.
      }
    });

    return btn;
  }

  wrap.appendChild(makeBtn("up", "This was helpful", THUMBS_UP_ICON_SVG));
  wrap.appendChild(makeBtn("down", "This wasn't helpful", THUMBS_DOWN_ICON_SVG));
  return wrap;
}

// Detects a Coach Chat reply's drafted, ready-to-send message(s) — see the
// COACH_SYSTEM_PROMPT instruction (server.js) to write the actual message
// "on its own line, in quotes" when the person asks what to say, with at
// most one clearly-labeled alternative. Matches a whole line wrapped in
// quote characters — straight or curly/language-specific, since the coach
// replies in whatever language the person writes in and the quote style
// follows along. Deliberately doesn't require the opening/closing marks to
// be a matched pair: Slovak/German typography closes a low-opening „quote
// with “ (U+201C) — the same character English uses to OPEN a curly quote
// — so a strict pairing would miss it, and getting this slightly loose
// costs nothing since it only drives an optional "Copy" button. Requires
// some length and a space so a short quoted single word used for emphasis
// elsewhere in a reply doesn't false-positive into a button of its own.
const QUOTE_LINE_RE = /^[ \t]*["“”„«»‚']([^\n]{7,}?)["“”„«»‚'][ \t]*$/gm;

function extractDraftedMessages(text) {
  const found = [];
  QUOTE_LINE_RE.lastIndex = 0;
  let m;
  while ((m = QUOTE_LINE_RE.exec(text))) {
    const content = m[1].trim();
    if (content.length >= 8 && content.includes(" ")) found.push(content);
  }
  return found;
}

function buildCopyDraftRow(drafts) {
  const row = document.createElement("div");
  row.className = "copy-draft-row";
  drafts.forEach((draft, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost btn-sm copy-draft-btn";
    const label = drafts.length > 1 ? `📋 Copy option ${i + 1}` : "📋 Copy message";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      if (!navigator.clipboard) {
        showComposerError("Couldn't copy automatically — please select the text manually.");
        return;
      }
      navigator.clipboard
        .writeText(draft)
        .then(() => {
          btn.textContent = "Copied!";
          setTimeout(() => {
            btn.textContent = label;
          }, 1800);
        })
        .catch(() => {
          showComposerError("Couldn't copy automatically — please select the text manually.");
        });
    });
    row.appendChild(btn);
  });
  return row;
}

function appendMessage(role, text, animate, ctx, attachments, messageId, feedback) {
  const chatDiv = document.getElementById("chat");
  document.getElementById("empty-state")?.remove();

  const isUser = role === "user";
  const isPractice = ctx && ctx.mode === "practice";
  const isRoleSwap = isPractice && ctx.roleSwap;

  const row = document.createElement("div");
  row.className = "message-row " + (isUser ? "user" : isPractice ? "partner" : "ai");

  const label = document.createElement("div");
  label.className = "message-role-label";
  // In role-swap practice, the user is voicing their partner and the AI is
  // voicing the user's own likely side — flip the labels to match, so it
  // doesn't look backwards on screen (see buildPartnerSystemPrompt's
  // roleSwap branch in server.js for the prompt-side half of this).
  if (isRoleSwap) {
    label.textContent = isUser ? `${ctx.partnerName || "Partner"} (you)` : "You (AI reply)";
  } else {
    label.textContent = isUser ? "You" : isPractice ? ctx.partnerName || "Partner" : "RelateIQ";
  }
  row.appendChild(label);

  const bubble = document.createElement("div");
  bubble.className = isUser ? "user-msg" : isPractice ? "partner-msg" : "ai-msg";

  const textEl = document.createElement("div");
  textEl.className = "msg-text";
  bubble.appendChild(textEl);

  // Voice playback for practice replies (the roleplay side, not the user's
  // own messages) — natural OpenAI TTS (see buildSpeakButton), not the
  // free-but-robotic browser speechSynthesis this used before. Audio
  // playback itself is essentially universal, so this is just a basic
  // sanity check rather than real feature detection.
  if (isPractice && !isUser && text && typeof Audio !== "undefined") {
    bubble.appendChild(buildSpeakButton(text));
  }

  // Coach Chat only — a drafted message to copy is specifically a Coach
  // Chat behavior (see extractDraftedMessages above), not something Partner
  // Practice's in-character roleplay replies do.
  if (!isUser && !isPractice && text) {
    const drafts = extractDraftedMessages(text);
    if (drafts.length > 0) {
      bubble.appendChild(buildCopyDraftRow(drafts));
    }
  }

  // Coach Chat only (not Practice — see buildFeedbackButtons) and only once
  // the server has actually assigned this message an id (older messages
  // saved before this feature existed, and the transient "thinking…"
  // placeholder, have none).
  if (!isUser && !isPractice && messageId) {
    bubble.appendChild(buildFeedbackButtons(currentConversationId, messageId, feedback || null));
  }

  row.appendChild(bubble);
  chatDiv.appendChild(row);

  if (text) {
    if (animate) {
      typeText(textEl, text);
    } else {
      textEl.innerText = text;
    }
  } else {
    textEl.style.display = "none";
  }

  if (attachments && attachments.length > 0) {
    renderAttachments(bubble, attachments);
  }

  // Recorded on every row (not just user ones) so a future feature has them
  // for free, but only user rows are actually read today — see
  // refreshEditAffordance/startEditLastMessage below. rawText is the plain
  // text this row was rendered from (before typeText's animation, if any),
  // so re-opening it in the composer round-trips exactly.
  row.dataset.messageId = messageId || "";
  row.dataset.rawText = text || "";
  row.dataset.hasAttachments = attachments && attachments.length > 0 ? "1" : "0";

  chatDiv.scrollTop = chatDiv.scrollHeight;
  return bubble;
}

// ---------------------------------------------------------------------------
// edit & resend the last message (Coach Chat only)
// ---------------------------------------------------------------------------
//
// Deliberately scoped to only ever the LAST exchange: the server's
// editMessageId handling (see POST /api/conversations/:id/messages in
// server.js) only truncates when the given id matches the conversation's
// actual last user message, with an assistant reply right after it. So the
// "✏️ Edit" affordance below only ever appears on the last user row, never
// on an earlier one — there's nothing to wire up for editing further back.

// Clears any in-progress edit and hides the banner — called whenever the
// person navigates away from the conversation they were editing (opening a
// different one, starting a new chat, deleting the current one), so a stale
// editingMessageId from a previous conversation can never leak into a send
// on this one. Deliberately leaves any typed composer text alone, matching
// how switching conversations already doesn't clear an unsent draft.
function resetEditState() {
  editingMessageId = null;
  const banner = document.getElementById("edit-mode-banner");
  if (banner) banner.style.display = "none";
}

// Adds the "✏️ Edit" button to the last user message in the transcript, if
// conditions allow it: Coach Chat only (Practice is a roleplay transcript,
// not something you redraft), nothing in flight, no edit already in
// progress, the row has a known message id (older messages predating this
// feature, and the transient optimistic bubble before a send resolves,
// won't), and no attachments (keeps the resend simple — re-attaching files
// on an edit isn't supported). Called after anything that can change what
// the last message is: opening a conversation, and after a send settles.
function refreshEditAffordance() {
  document.querySelectorAll(".edit-msg-row").forEach((el) => el.remove());
  if (currentConvCtx.mode !== "coach" || isSending || editingMessageId) return;

  const userRows = document.querySelectorAll("#chat .message-row.user");
  const lastRow = userRows[userRows.length - 1];
  if (!lastRow || !lastRow.dataset.messageId || lastRow.dataset.hasAttachments === "1") return;

  const actionRow = document.createElement("div");
  actionRow.className = "edit-msg-row";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "edit-msg-btn";
  btn.textContent = "✏️ Edit";
  btn.addEventListener("click", () => {
    startEditLastMessage(lastRow.dataset.messageId, lastRow.dataset.rawText, lastRow);
  });
  actionRow.appendChild(btn);
  lastRow.appendChild(actionRow);
}

function startEditLastMessage(messageId, text, row) {
  if (isSending) return;
  // Pull this row and anything rendered after it (in the ordinary case just
  // this one row, since it was confirmed to be the last message — but walk
  // forward instead of assuming, in case something else got appended in
  // between) out of the transcript; openConversation() re-renders the real
  // thing if the edit is cancelled.
  let node = row;
  while (node) {
    const next = node.nextSibling;
    node.remove();
    node = next;
  }

  editingMessageId = messageId;
  const input = document.getElementById("input");
  input.value = text || "";
  resizeComposerInput();
  input.focus();
  const banner = document.getElementById("edit-mode-banner");
  if (banner) banner.style.display = "flex";
  refreshEditAffordance();
}

function cancelEditLastMessage() {
  if (!editingMessageId) return;
  resetEditState();
  const input = document.getElementById("input");
  input.value = "";
  resizeComposerInput();
  if (currentConversationId) {
    openConversation(currentConversationId);
  } else {
    refreshEditAffordance();
  }
}

// Renders a fixed, distinct card with real crisis resources — separate from
// the normal AI reply bubble, so it's guaranteed visible regardless of how
// the coaching reply itself was phrased. See safetyBlockFor() in server.js.
function appendSafetyNotice(safety) {
  if (!safety) return;
  const chatDiv = document.getElementById("chat");
  const card = document.createElement("div");
  card.className = "safety-notice";
  const heading = document.createElement("div");
  heading.className = "safety-notice-heading";
  heading.textContent = safety.heading || "Please reach out to real support";
  const body = document.createElement("div");
  body.className = "safety-notice-body";
  body.innerText = safety.body || "";
  card.appendChild(heading);
  card.appendChild(body);
  chatDiv.appendChild(card);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

let isFetchingDebrief = false;

// Wired to the "Get feedback" button in the practice banner (see
// #debrief-btn in chat.html). Calls the new debrief endpoint and renders
// the result as a card at the end of the rehearsal — a real, specific
// readout (what went well, what to watch for, a concrete tip), not just a
// hand-off to Coach Chat. A "Talk it through with Coach" link inside the
// card still offers that hand-off for anyone who wants to go deeper.
async function requestPracticeDebrief() {
  if (isFetchingDebrief || !currentConversationId) return;
  isFetchingDebrief = true;
  const btn = document.getElementById("debrief-btn");
  const originalLabel = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Getting feedback…";
  }

  try {
    const res = await authFetch(`/api/conversations/${encodeURIComponent(currentConversationId)}/debrief`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      await showAppAlert(data.error || "Couldn't generate a debrief right now.");
      return;
    }
    // Captured now, not read live from currentConvCtx inside the card's
    // click handler — the debrief card isn't persisted (it's rebuilt fresh
    // each time "Get feedback" is clicked), so by the time someone clicks
    // "Try again" this IS still the right conversation's context, but
    // there's no reason to depend on that staying true if this card ever
    // outlives a navigation in some future change.
    appendPracticeDebrief(data, currentConvCtx);
  } catch (err) {
    console.error(err);
    await showAppAlert("Couldn't connect to the server.");
  } finally {
    isFetchingDebrief = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }
}

// ---------------------------------------------------------------------------
// Quick share — a one-click alternative to the full share.html workflow
// (create a share, open it, "choose a conversation", preview, confirm).
// Reuses exactly the same backend (POST /api/shares, then
// POST /api/shares/:id/items/from-conversation) and the same
// preview-before-sharing principle (renderTranscriptHtml, from shared.js),
// but does the whole thing inline in one small modal without ever leaving
// the chat. Always creates a fresh, single-conversation share rather than
// picking an existing one — simpler to reason about than guessing which of
// the user's other shares (if any) this conversation "belongs" in.
// ---------------------------------------------------------------------------

function closeShareModal() {
  const modal = document.getElementById("share-conversation-modal");
  if (modal) modal.style.display = "none";
}

async function openShareModal() {
  if (!currentConversationId) return;
  const modal = document.getElementById("share-conversation-modal");
  const body = document.getElementById("share-conversation-modal-body");
  if (!modal || !body) return;
  modal.style.display = "flex";
  body.innerHTML = '<p class="text-muted">Loading conversation…</p>';

  try {
    const res = await authFetch(`/api/conversations/${encodeURIComponent(currentConversationId)}`);
    const data = await safeJson(res);
    if (!res.ok) {
      body.innerHTML = `<p class="text-muted">${escapeHtml(data.error || "Couldn't load this conversation.")}</p><div class="modal-close-row"><button class="btn btn-ghost btn-sm" id="share-modal-close-btn" type="button">Close</button></div>`;
      document.getElementById("share-modal-close-btn")?.addEventListener("click", closeShareModal);
      return;
    }
    renderShareModalPreview(data);
  } catch (err) {
    body.innerHTML = '<p class="text-muted">Couldn\'t connect to the server.</p>';
  }
}

function renderShareModalPreview(conv) {
  const body = document.getElementById("share-conversation-modal-body");
  body.innerHTML = `
    <h2>Share "${escapeHtml(conv.title || "this conversation")}"</h2>
    <div class="share-conversation-warning">Everything below will be visible to anyone with the link — check it over before sharing. Nothing goes out until you confirm.</div>
    ${renderTranscriptHtml(conv.messages)}
    <div class="modal-close-row">
      <button class="btn btn-ghost btn-sm" id="share-modal-cancel-btn" type="button">Cancel</button>
      <button class="btn btn-gradient btn-sm" id="share-modal-confirm-btn" type="button">Get shareable link</button>
    </div>
  `;
  document.getElementById("share-modal-cancel-btn")?.addEventListener("click", closeShareModal);
  document.getElementById("share-modal-confirm-btn")?.addEventListener("click", () => confirmQuickShare(conv));
}

async function confirmQuickShare(conv) {
  const btn = document.getElementById("share-modal-confirm-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Sharing…";
  }
  try {
    const createRes = await authFetch("/api/shares", {
      method: "POST",
      body: JSON.stringify({ title: conv.title || "Shared conversation" }),
    });
    const share = await safeJson(createRes);
    if (!createRes.ok) throw new Error(share.error || "Couldn't create a share link.");

    const addRes = await authFetch(`/api/shares/${encodeURIComponent(share.id)}/items/from-conversation`, {
      method: "POST",
      body: JSON.stringify({ conversationId: conv.id }),
    });
    const updatedShare = await safeJson(addRes);
    if (!addRes.ok) throw new Error(updatedShare.error || "Couldn't add this conversation to the share.");

    renderShareModalLink(updatedShare);
  } catch (err) {
    await showAppAlert(err.message || "Couldn't connect to the server.");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Get shareable link";
    }
  }
}

function renderShareModalLink(share) {
  const body = document.getElementById("share-conversation-modal-body");
  if (!body) return;
  const url = `${window.location.origin}/partner-view.html?token=${share.token}`;
  body.innerHTML = `
    <h2>Link ready</h2>
    <p class="text-muted">Anyone with this link can view this conversation — no account needed. Manage or revoke it anytime from <a href="share.html">Share with partner</a>.</p>
    <div class="share-link-box">
      <span id="share-modal-link-text">${escapeHtml(url)}</span>
      <button class="btn btn-gradient btn-sm" id="share-modal-copy-btn" type="button">Copy link</button>
    </div>
    <div class="modal-close-row">
      <button class="btn btn-ghost btn-sm" id="share-modal-done-btn" type="button">Done</button>
    </div>
  `;
  document.getElementById("share-modal-done-btn")?.addEventListener("click", closeShareModal);
  document.getElementById("share-modal-copy-btn")?.addEventListener("click", () => {
    navigator.clipboard.writeText(url).then(() => {
      const copyBtn = document.getElementById("share-modal-copy-btn");
      if (copyBtn) {
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          if (copyBtn) copyBtn.textContent = "Copy link";
        }, 1500);
      }
    });
  });
}

// Thumbs up/down on the debrief itself (task #93) — same up/down/clear-on-
// reclick shape as buildFeedbackButtons (Coach Chat replies), but PATCHes
// the conversation-scoped debrief feedback route instead of a per-message
// one (see the comment on that route in server.js for why there's no
// message id to key off of here — a conversation only ever has ONE active
// debrief at a time).
function buildDebriefFeedbackButtons(conversationId, initialFeedback) {
  const wrap = document.createElement("div");
  wrap.className = "feedback-buttons practice-debrief-feedback";

  const label = document.createElement("span");
  label.className = "practice-debrief-feedback-label";
  label.textContent = "Was this useful?";
  wrap.appendChild(label);

  function makeBtn(kind, ariaLabel, svg) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `feedback-btn feedback-btn-${kind}`;
    btn.setAttribute("aria-label", ariaLabel);
    btn.title = ariaLabel;
    btn.innerHTML = svg;
    if (initialFeedback === kind) btn.classList.add("active");

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const next = btn.classList.contains("active") ? null : kind;
      wrap.querySelectorAll(".feedback-btn").forEach((b) => b.classList.remove("active"));
      if (next) btn.classList.add("active");
      try {
        await authFetch(`/api/conversations/${encodeURIComponent(conversationId)}/debrief/feedback`, {
          method: "PATCH",
          body: JSON.stringify({ feedback: next }),
        });
      } catch (err) {
        // Non-critical — same as message feedback (buildFeedbackButtons): a
        // vote that didn't save just doesn't stick, no need to interrupt.
      }
    });

    return btn;
  }

  wrap.appendChild(makeBtn("up", "This debrief was helpful", THUMBS_UP_ICON_SVG));
  wrap.appendChild(makeBtn("down", "This debrief wasn't helpful", THUMBS_DOWN_ICON_SVG));
  return wrap;
}

function appendPracticeDebrief(debrief, ctx) {
  const chatDiv = document.getElementById("chat");
  if (!chatDiv) return;

  const card = document.createElement("div");
  card.className = "practice-debrief-card";

  const heading = document.createElement("div");
  heading.className = "practice-debrief-heading";
  heading.textContent = "📋 Feedback on this rehearsal";
  card.appendChild(heading);

  const sections = [
    ["What went well", debrief.wentWell],
    ["Watch for", debrief.watchFor],
    ["Try this in the real conversation", debrief.tip],
  ];
  sections.forEach(([label, text]) => {
    if (!text) return;
    const section = document.createElement("div");
    section.className = "practice-debrief-section";
    const labelEl = document.createElement("div");
    labelEl.className = "practice-debrief-label";
    labelEl.textContent = label;
    const textEl = document.createElement("p");
    textEl.className = "practice-debrief-text";
    textEl.textContent = text;
    section.appendChild(labelEl);
    section.appendChild(textEl);
    card.appendChild(section);
  });

  if (currentConversationId) {
    card.appendChild(buildDebriefFeedbackButtons(currentConversationId, debrief.feedback || null));
  }

  const footer = document.createElement("div");
  footer.className = "practice-debrief-footer";

  // "Try again" (task #91) — re-runs the exact same rehearsal (same
  // partner, scenario, intensity, role-swap) as a fresh conversation, so
  // the feedback just given can actually be put into practice right away
  // instead of the person having to reopen the setup screen and refill it.
  // Only offered when we actually have a partner to restart with — should
  // always be true for a real practice debrief, but the debrief endpoint
  // itself is defensive elsewhere, so this is too.
  if (ctx && ctx.mode === "practice" && ctx.partnerProfileId) {
    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.className = "btn btn-gradient btn-sm";
    retryBtn.id = "practice-debrief-retry-btn";
    retryBtn.textContent = "🔄 Try again";
    retryBtn.addEventListener("click", () => retryPracticeConversation(ctx, retryBtn));
    footer.appendChild(retryBtn);
  }

  const coachLink = document.createElement("button");
  coachLink.type = "button";
  coachLink.className = "btn btn-ghost btn-sm";
  coachLink.textContent = "Talk it through with Coach →";
  coachLink.addEventListener("click", () => startNewChat("coach"));
  footer.appendChild(coachLink);
  card.appendChild(footer);

  chatDiv.appendChild(card);
  chatDiv.scrollTop = chatDiv.scrollHeight;
}

// "🔄 Try again" on the practice debrief card (task #91). Free-plan users
// only get FREE_LIFETIME_PRACTICE_CONVERSATIONS rehearsal(s) total, so this
// can legitimately fail with the same upgrade-required shape sendMessage
// already handles — reuses showComposerError (with its "Upgrade to Pro"
// button) rather than a bare alert() for that specific case, since the
// composer is always visible during Practice mode, debrief card or not.
async function retryPracticeConversation(ctx, btn) {
  const originalLabel = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Starting…";
  }
  try {
    const result = await startPracticeConversation({
      partnerProfileId: ctx.partnerProfileId,
      scenario: ctx.scenario,
      intensity: ctx.intensity,
      roleSwap: ctx.roleSwap,
    });
    if (!result.ok) {
      showComposerError(result.error || "Couldn't start a new rehearsal.", { upgradeRequired: result.upgradeRequired });
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    }
    // On success, openConversation (inside startPracticeConversation) has
    // already replaced the whole chat pane — including this very card and
    // button — so there's nothing left here to re-enable.
  } catch (err) {
    console.error(err);
    showComposerError("Couldn't connect to the server.");
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }
}

function typeText(element, text, speed = 12) {
  let i = 0;
  element.innerText = "";
  function typing() {
    if (i < text.length) {
      element.innerText += text[i] === " " ? " " : text[i];
      i++;
      setTimeout(typing, speed);
    }
  }
  typing();
}

async function sendMessage() {
  if (isSending) return;

  const input = document.getElementById("input");
  const message = input.value.trim();
  if (!message && pendingAttachments.length === 0) return;

  if (!currentConversationId) {
    // ChatGPT-style: typing a first message and hitting Enter/Send starts a
    // new conversation on its own, instead of requiring an explicit "+ New
    // chat" click first. Practice mode can't auto-start this way since it
    // needs a partner profile picked first — its composer is hidden until
    // a practice conversation already exists, so this only really applies
    // to Coach mode's empty-state landing.
    if (currentMode === "practice") return;
    isSending = true;
    await startNewChat("coach");
    isSending = false;
    if (!currentConversationId) {
      showComposerError("Couldn't start a new conversation. Please try again.");
      return;
    }
  }

  isSending = true;
  input.value = "";
  input.style.height = "auto";

  const attachmentsForDisplay = pendingAttachments.map((a) => ({
    name: a.name,
    mimeType: a.mimeType,
    kind: a.kind,
    size: a.size,
    dataUrl: a.dataUrl,
  }));
  const attachmentsForUpload = pendingAttachments.map((a) => ({ name: a.name, mimeType: a.mimeType, dataUrl: a.dataUrl }));
  clearPendingAttachments();

  const userBubble = appendMessage("user", message, false, currentConvCtx, attachmentsForDisplay);
  const thinkingText = currentConvCtx.mode === "practice" ? `${currentConvCtx.partnerName || "Your partner"} is typing…` : "RelateIQ is thinking…";
  const thinkingBubble = appendMessage("assistant", thinkingText, false, currentConvCtx);

  // If the send fails for any reason (plan limit, server error, dropped
  // connection), put the person back exactly where they started instead of
  // making them retype everything: remove the optimistic user bubble and
  // the "thinking" placeholder (neither was ever actually saved
  // server-side, so leaving them in the transcript would just look like a
  // ghost message that vanishes on the next reload), and restore the typed
  // text and any attachments to the composer.
  function rollBackFailedSend() {
    userBubble.closest(".message-row")?.remove();
    thinkingBubble.closest(".message-row")?.remove();
    input.value = message;
    resizeComposerInput();
    // Re-add localId (dropped by the attachmentsForDisplay mapping above,
    // since it's only meaningful to the composer, not the server or the
    // message log) so the restored chips' remove (✕) buttons in
    // renderAttachmentPreview can tell them apart again.
    pendingAttachments = attachmentsForDisplay.map((a) => ({ ...a, localId: "local_" + Math.random().toString(36).slice(2) }));
    renderAttachmentPreview();
  }

  // Captured up front, before the request resolves — a failed send (see
  // rollBackFailedSend) deliberately leaves editingMessageId untouched so a
  // retry still attempts the same edit, but we still need to know here
  // whether THIS attempt was an edit, since editingMessageId may already
  // have been cleared by the time the response comes back in the success path.
  const editMessageId = editingMessageId;

  try {
    const res = await authFetch(`/api/conversations/${encodeURIComponent(currentConversationId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ message, attachments: attachmentsForUpload, editMessageId }),
    });
    const data = await safeJson(res);

    if (!res.ok || !data.reply) {
      rollBackFailedSend();
      showComposerError(data.error || "Something went wrong.", { upgradeRequired: !!data.upgradeRequired });
      return;
    }

    if (editMessageId) {
      editingMessageId = null;
      const banner = document.getElementById("edit-mode-banner");
      if (banner) banner.style.display = "none";
    }
    if (data.userMessageId) {
      const userRow = userBubble.closest(".message-row");
      if (userRow) userRow.dataset.messageId = data.userMessageId;
    }

    thinkingBubble.closest(".message-row")?.remove();
    appendMessage("assistant", data.reply, true, currentConvCtx, undefined, data.messageId);
    appendSafetyNotice(data.safety);
    refreshEditAffordance();

    if (data.usage) {
      const cachedUser = getUser();
      if (cachedUser) {
        cachedUser.usage = data.usage;
        setSession(getToken(), cachedUser);
        renderUsageBadge(cachedUser);
      }
    }

    if (currentConvCtx.mode === "coach" && !currentConvHasUserMessage) {
      currentConvHasUserMessage = true;
      updateExportButtonVisibility();
    }

    const idx = conversations.findIndex((c) => c.id === currentConversationId);
    if (idx > -1 && data.title) {
      conversations[idx].title = data.title;
      conversations[idx].updatedAt = new Date().toISOString();
      const [moved] = conversations.splice(idx, 1);
      conversations.unshift(moved);
    }
    renderHistory();
  } catch (err) {
    rollBackFailedSend();
    showComposerError("Couldn't connect to the server.");
  } finally {
    isSending = false;
  }
}

// ---------------------------------------------------------------------------
// Plan badge — shows Free/Pro/Premium in the top bar, links to the account
// page. Renders immediately from the cached session so there's no flash of
// nothing, then quietly refreshes from the server in case the plan changed
// since login (e.g. just upgraded via Stripe Checkout).
// ---------------------------------------------------------------------------

function renderPlanBadge(plan) {
  const badge = document.getElementById("plan-badge");
  if (!badge || !plan) return;
  const label = { free: "Free", pro: "Pro", premium: "Premium" }[plan] || "Free";
  badge.textContent = label;
  badge.classList.toggle("plan-badge-paid", plan !== "free");
}

// Free-plan-only daily AI message counter ("5/8 today"), shown right next
// to the plan badge — see the .usage-badge comment in style.css for why:
// this used to be invisible until the person actually hit the wall (see
// isOverDailyLimit in server.js) and got a hard error with no warning.
// Pro/Premium have no daily cap, so the badge just stays hidden for them.
// Accepts the same shape /api/me and every message-send response return:
// { plan, usage: { date, count } | undefined, usageLimit }.
function renderUsageBadge(user) {
  const badge = document.getElementById("usage-badge");
  if (!badge) return;
  if (!user || user.plan !== "free") {
    badge.style.display = "none";
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const count = user.usage && user.usage.date === today ? user.usage.count : 0;
  const limit = user.usageLimit || 8;
  const remaining = Math.max(0, limit - count);
  badge.textContent = `${count}/${limit} today`;
  badge.title =
    remaining > 0
      ? `${remaining} AI message${remaining === 1 ? "" : "s"} left today (Free plan) — resets tomorrow`
      : "Today's free messages are used up — resets tomorrow, or upgrade to Pro for no daily cap";
  badge.classList.toggle("usage-badge-low", remaining <= 1);
  badge.style.display = "inline-flex";
}

async function refreshPlanBadge() {
  try {
    const res = await authFetch("/api/me");
    const data = await safeJson(res);
    if (!res.ok || !data.plan) return;
    renderPlanBadge(data.plan);
    renderUsageBadge(data);
    renderVerifyBanner(data);

    // Keep the cached session in sync so other pages (and a future reload
    // of this one) don't show a stale plan until the next login.
    const token = getToken();
    if (token) setSession(token, data);
  } catch (err) {
    // Non-critical — the badge just stays at whatever the cached plan said.
  }
}
