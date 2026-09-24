let currentConversationId = null;
let conversations = [];
let partners = [];
let currentMode = "coach"; // 'coach' | 'practice' — mirrors the mode of whatever is on screen
let currentConvCtx = { mode: "coach", partnerName: null };
let isSending = false;
let currentConvHasUserMessage = false; // drives whether the "Export for therapist" button shows

// Attachments (images, screen recordings, other files) picked but not yet sent
let pendingAttachments = [];
let composerErrorTimeout = null;
// Mirrors MAX_FILES_PER_MESSAGE_BY_PLAN in server.js — keep the two in sync.
const MAX_FILES_PER_MESSAGE_BY_PLAN = { free: 1, pro: 3, premium: 5 };
function maxFilesPerMessage() {
  const plan = getUser()?.plan;
  return MAX_FILES_PER_MESSAGE_BY_PLAN[plan] ?? MAX_FILES_PER_MESSAGE_BY_PLAN.free;
}
const MAX_TOTAL_UPLOAD_BYTES = 15 * 1024 * 1024;
const TRASH_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a2 2 0 012-2h0a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

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

  // Mobile off-canvas drawer (harmless no-op on desktop, where the sidebar
  // is always visible and .open has no matching CSS rule).
  document.getElementById("sidebar-toggle")?.addEventListener("click", openSidebarDrawer);
  document.getElementById("sidebar-close-btn")?.addEventListener("click", closeSidebarDrawer);
  document.getElementById("sidebar-backdrop")?.addEventListener("click", closeSidebarDrawer);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebarDrawer();
  });
  document.getElementById("debrief-btn")?.addEventListener("click", () => startNewChat("coach"));
  document.getElementById("export-summary-btn")?.addEventListener("click", () => {
    if (!currentConversationId) return;
    window.open("summary.html?id=" + encodeURIComponent(currentConversationId), "_blank");
  });
  document.getElementById("attach-btn")?.addEventListener("click", () => document.getElementById("file-input")?.click());
  document.getElementById("file-input")?.addEventListener("change", handleFilesSelected);
  wireVoiceInput(document.getElementById("mic-btn"), document.getElementById("input"));

  // Only the real mode tabs (Coach/Practice) switch mode in-page — the
  // Message Coach / Attachment Quiz tabs are plain links to their own pages
  // (no data-mode), so they're excluded here and just navigate normally.
  document.querySelectorAll(".mode-tab[data-mode]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.mode;
      if (mode === "practice") {
        setActiveTab("practice");
        currentConversationId = null;
        showPartnerBanner(false);
        showComposer(false);
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
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  });

  await loadConversations();

  const params = new URLSearchParams(window.location.search);
  const requested = params.get("c");
  if (params.get("mode") === "practice") {
    setActiveTab("practice");
    showPartnerBanner(false);
    showComposer(false);
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
  if (!btn) return;
  btn.style.display = currentMode === "coach" && currentConversationId && currentConvHasUserMessage ? "inline-flex" : "none";
}

function showPartnerBanner(visible, name) {
  const banner = document.getElementById("partner-banner");
  if (!banner) return;
  banner.style.display = visible ? "flex" : "none";
  if (visible) {
    const nameEl = document.getElementById("partner-banner-name");
    if (nameEl) nameEl.textContent = name || "your partner";
  }
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

function showComposerError(msg) {
  let el = document.getElementById("composer-error");
  if (!el) {
    el = document.createElement("div");
    el.id = "composer-error";
    el.className = "form-error";
    el.style.margin = "0 0 10px";
    document.getElementById("composer")?.before(el);
  }
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(composerErrorTimeout);
  composerErrorTimeout = setTimeout(() => {
    el.style.display = "none";
  }, 4500);
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

  conversations.forEach((c) => {
    const div = document.createElement("div");
    div.className = "chat-item" + (c.id === currentConversationId ? " active" : "");

    const dot = document.createElement("span");
    dot.className = "mode-dot" + (c.mode === "practice" ? " practice" : "");
    div.appendChild(dot);

    const label = document.createElement("span");
    label.className = "chat-item-label";
    label.textContent = c.title || "New conversation";
    div.appendChild(label);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "chat-item-delete";
    deleteBtn.setAttribute("aria-label", "Delete conversation");
    deleteBtn.innerHTML = TRASH_ICON_SVG;
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteConversation(c.id);
    });
    div.appendChild(deleteBtn);

    div.addEventListener("click", () => {
      openConversation(c.id);
      closeSidebarDrawer();
    });
    historyDiv.appendChild(div);
  });
}

async function deleteConversation(id) {
  const target = conversations.find((c) => c.id === id);
  const label = target?.title ? `"${target.title}"` : "this conversation";
  if (!confirm(`Delete ${label}? This can't be undone.`)) return;

  try {
    const res = await authFetch("/api/conversations/" + encodeURIComponent(id), { method: "DELETE" });
    if (!res.ok) {
      const data = await safeJson(res);
      alert(data.error || "Couldn't delete that conversation.");
      return;
    }

    conversations = conversations.filter((c) => c.id !== id);
    renderHistory();

    if (id === currentConversationId) {
      currentConversationId = null;
      if (conversations.length > 0) {
        await openConversation(conversations[0].id);
      } else {
        currentConvCtx = { mode: "coach", partnerName: null };
        setActiveTab("coach");
        showPartnerBanner(false);
        showComposer(true);
        renderEmptyState();
      }
    }
  } catch (err) {
    console.error(err);
    alert("Couldn't connect to the server.");
  }
}

function renderEmptyState() {
  const chatDiv = document.getElementById("chat");
  chatDiv.innerHTML =
    '<div id="empty-state" class="empty-chat"><h2>Hi there! 👋</h2><p>Tell me what\'s going on in your relationship, and let\'s work through it together.</p></div>';
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

async function renderPracticeSetup() {
  const chatDiv = document.getElementById("chat");
  chatDiv.innerHTML = `
    <div class="practice-setup" id="practice-setup">
      <h2>Practice a real conversation</h2>
      <p class="text-muted">Pick who you want to practice talking to. The AI will roleplay as them, in character, so you can rehearse before the real thing.</p>
      <div class="partner-list" id="partner-list"><p class="text-muted">Loading…</p></div>
      <button class="btn btn-ghost btn-block" id="show-partner-form-btn" type="button">+ Create a new partner profile</button>
      <form class="partner-form" id="partner-form" style="display:none;">
        <div class="form-error" id="partner-form-error" style="display:none;"></div>
        <label for="partner-name">Name</label>
        <input type="text" id="partner-name" required maxlength="60" placeholder="e.g. Alex" autocomplete="off" />
        <label for="partner-traits">Personality — how they usually are</label>
        <textarea id="partner-traits" rows="3" maxlength="500" placeholder="e.g. warm but avoids conflict, gets quiet when stressed, jokes to deflect difficult topics"></textarea>
        <label for="partner-context">Context (optional)</label>
        <input type="text" id="partner-context" maxlength="200" placeholder="e.g. together 2 years, we just moved in together" autocomplete="off" />
        <button type="submit" class="btn btn-gradient btn-block">Save &amp; start practicing</button>
      </form>
    </div>
  `;

  document.getElementById("show-partner-form-btn").addEventListener("click", () => {
    document.getElementById("partner-form").style.display = "block";
    document.getElementById("show-partner-form-btn").style.display = "none";
  });

  document.getElementById("partner-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("partner-name").value.trim();
    const traits = document.getElementById("partner-traits").value.trim();
    const context = document.getElementById("partner-context").value.trim();
    const errorBox = document.getElementById("partner-form-error");
    errorBox.style.display = "none";

    if (!name) return;

    try {
      const res = await authFetch("/api/partners", {
        method: "POST",
        body: JSON.stringify({ name, traits, context }),
      });
      const partner = await safeJson(res);
      if (!res.ok) {
        errorBox.textContent = partner.error || "Couldn't save that partner profile.";
        errorBox.style.display = "block";
        return;
      }
      partners.unshift(partner);
      await selectPartnerAndStart(partner.id);
    } catch (err) {
      errorBox.textContent = "Couldn't connect to the server.";
      errorBox.style.display = "block";
    }
  });

  await loadPartners();
  renderPartnerList();
}

function renderPartnerList() {
  const listDiv = document.getElementById("partner-list");
  if (!listDiv) return;
  listDiv.innerHTML = "";

  if (partners.length === 0) {
    listDiv.innerHTML = '<p class="text-muted" style="text-align:center;">No partner profiles yet — create one below to get started.</p>';
    return;
  }

  partners.forEach((p) => {
    const card = document.createElement("div");
    card.className = "partner-card";
    card.innerHTML = `
      <div>
        <div class="partner-name">${escapeHtml(p.name)}</div>
        <div class="partner-context">${escapeHtml(p.context || p.traits || "")}</div>
      </div>
      <span class="text-faint">Practice →</span>
    `;
    card.onclick = () => selectPartnerAndStart(p.id);
    listDiv.appendChild(card);
  });
}

async function selectPartnerAndStart(partnerId) {
  try {
    const res = await authFetch("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ mode: "practice", partnerProfileId: partnerId }),
    });
    const conv = await safeJson(res);
    if (!res.ok) {
      alert(conv.error || "Couldn't start that practice conversation.");
      return;
    }
    conversations.unshift({
      id: conv.id,
      title: conv.title,
      updatedAt: conv.updatedAt,
      createdAt: conv.createdAt,
      mode: conv.mode,
      partnerName: conv.partnerName,
    });
    await openConversation(conv.id, conv);
  } catch (err) {
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// starting / opening conversations
// ---------------------------------------------------------------------------

async function startNewChat(mode) {
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
    });
    currentConversationId = conv.id;
    currentConvCtx = { mode: "coach", partnerName: null };
    currentConvHasUserMessage = false;
    setActiveTab("coach");
    showPartnerBanner(false);
    showComposer(true);
    renderHistory();
    renderEmptyState();
  } catch (err) {
    console.error(err);
  }
}

async function openConversation(id, preloadedConv) {
  try {
    let conv = preloadedConv;
    if (!conv) {
      const res = await authFetch("/api/conversations/" + encodeURIComponent(id));
      if (!res.ok) return;
      conv = await safeJson(res);
    }

    currentConversationId = conv.id;
    currentConvCtx = { mode: conv.mode || "coach", partnerName: conv.partnerName || null };
    currentConvHasUserMessage = (conv.messages || []).some((m) => m.role === "user");
    setActiveTab(currentConvCtx.mode);
    showComposer(true);
    showPartnerBanner(currentConvCtx.mode === "practice", currentConvCtx.partnerName);
    renderHistory();

    const chatDiv = document.getElementById("chat");
    chatDiv.innerHTML = "";

    if (!conv.messages || conv.messages.length === 0) {
      renderEmptyState();
      return;
    }

    conv.messages.forEach((msg) => appendMessage(msg.role, msg.content, false, currentConvCtx, msg.attachments));
    chatDiv.scrollTop = chatDiv.scrollHeight;
  } catch (err) {
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// messages
// ---------------------------------------------------------------------------

function appendMessage(role, text, animate, ctx, attachments) {
  const chatDiv = document.getElementById("chat");
  document.getElementById("empty-state")?.remove();

  const isUser = role === "user";
  const isPractice = ctx && ctx.mode === "practice";

  const row = document.createElement("div");
  row.className = "message-row " + (isUser ? "user" : isPractice ? "partner" : "ai");

  const label = document.createElement("div");
  label.className = "message-role-label";
  label.textContent = isUser ? "You" : isPractice ? ctx.partnerName || "Partner" : "RelateIQ";
  row.appendChild(label);

  const bubble = document.createElement("div");
  bubble.className = isUser ? "user-msg" : isPractice ? "partner-msg" : "ai-msg";

  const textEl = document.createElement("div");
  textEl.className = "msg-text";
  bubble.appendChild(textEl);

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

  chatDiv.scrollTop = chatDiv.scrollHeight;
  return bubble;
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

  appendMessage("user", message, false, currentConvCtx, attachmentsForDisplay);
  const thinkingText = currentConvCtx.mode === "practice" ? `${currentConvCtx.partnerName || "Your partner"} is typing…` : "RelateIQ is thinking…";
  const thinkingBubble = appendMessage("assistant", thinkingText, false, currentConvCtx);

  try {
    const res = await authFetch(`/api/conversations/${encodeURIComponent(currentConversationId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ message, attachments: attachmentsForUpload }),
    });
    const data = await safeJson(res);

    if (!res.ok || !data.reply) {
      thinkingBubble.innerText = data.error || "Something went wrong.";
      return;
    }

    thinkingBubble.closest(".message-row")?.remove();
    appendMessage("assistant", data.reply, true, currentConvCtx);
    appendSafetyNotice(data.safety);

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
    thinkingBubble.innerText = "Couldn't connect to the server.";
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

async function refreshPlanBadge() {
  try {
    const res = await authFetch("/api/me");
    const data = await safeJson(res);
    if (!res.ok || !data.plan) return;
    renderPlanBadge(data.plan);

    // Keep the cached session in sync so other pages (and a future reload
    // of this one) don't show a stale plan until the next login.
    const token = getToken();
    if (token) setSession(token, data);
  } catch (err) {
    // Non-critical — the badge just stays at whatever the cached plan said.
  }
}
