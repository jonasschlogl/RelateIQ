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
const PENCIL_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
const SPEAKER_ICON_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>';

// null when the partner form (see renderPracticeSetup) is creating a new
// profile, or a partner id when it's editing an existing one — swaps the
// submit handler between POST (create) and PATCH (update) and what happens
// after a successful save (start practicing vs. just return to the list).
let editingPartnerId = null;

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
  document.getElementById("debrief-btn")?.addEventListener("click", requestPracticeDebrief);
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
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  });

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
  if (!btn) return;
  btn.style.display = currentMode === "coach" && currentConversationId && currentConvHasUserMessage ? "inline-flex" : "none";
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
// about — self-reported, not guessed. Only shown when it actually matters:
// a Coach Chat conversation, with more than one partner profile to choose
// between. With 0 or 1 partner profiles there's nothing to disambiguate, so
// this stays hidden and the automatic partner-learning in server.js just
// uses all Coach Chat history for that one relationship — see
// learnPartnerProfileIfStale in server.js for why this distinction exists.
function renderCoachTagBar() {
  const bar = document.getElementById("coach-tag-bar");
  if (!bar) return;

  if (currentConvCtx.mode !== "coach" || !currentConversationId || partners.length <= 1) {
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
        <label for="partner-attachment">Their attachment style <span class="text-muted">(optional — if you know it, e.g. from the Attachment Quiz)</span></label>
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

  await loadPartners();
  renderPartnerList();
}

async function deletePartnerAction(p) {
  if (!confirm(`Delete ${p.name}'s profile? This can't be undone, and any practice conversations you had with them will lose their partner context.`)) return;
  try {
    const res = await authFetch(`/api/partners/${encodeURIComponent(p.id)}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await safeJson(res);
      alert(data.error || "Couldn't delete that partner profile.");
      return;
    }
    partners = partners.filter((x) => x.id !== p.id);
    renderPartnerList();
  } catch (err) {
    alert("Couldn't connect to the server.");
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

// Mirrors ATTACHMENT_STYLES in server.js — kept in sync manually, same
// duplication pattern as COMPARE_QUESTIONS in compare-view.js (no shared
// module system between server and client here).
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
      if (!confirm(`Forget what RelateIQ has learned about ${p.name}? Their name, traits, and context stay — just the learned behavior/voice profile is cleared.`)) return;
      try {
        const res = await authFetch(`/api/partners/${encodeURIComponent(p.id)}`, {
          method: "PATCH",
          body: JSON.stringify({ resetLearned: true }),
        });
        const updated = await safeJson(res);
        if (!res.ok) {
          alert(updated.error || "Couldn't reset that right now.");
          return;
        }
        const idx = partners.findIndex((x) => x.id === updated.id);
        if (idx !== -1) partners[idx] = updated;
        renderPartnerList();
      } catch (err) {
        alert("Couldn't connect to the server.");
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

async function selectPartnerAndStart(partnerId) {
  try {
    const scenario = document.getElementById("practice-scenario")?.value.trim() || "";
    const intensity = document.getElementById("practice-intensity")?.value === "supportive" ? "supportive" : "realistic";
    const roleSwap = !!document.getElementById("practice-role-swap")?.checked;
    const res = await authFetch("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ mode: "practice", partnerProfileId: partnerId, scenario, intensity, roleSwap }),
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
      aboutPartnerId: null,
    });
    currentConversationId = conv.id;
    currentConvCtx = { mode: "coach", partnerName: null, aboutPartnerId: null };
    currentConvHasUserMessage = false;
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
      scenario: conv.scenario || null,
      aboutPartnerId: conv.aboutPartnerId || null,
      intensity: conv.intensity || null,
      roleSwap: !!conv.practiceRoleSwap,
    };
    currentConvHasUserMessage = (conv.messages || []).some((m) => m.role === "user");
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

    conv.messages.forEach((msg) => appendMessage(msg.role, msg.content, false, currentConvCtx, msg.attachments));
    chatDiv.scrollTop = chatDiv.scrollHeight;
  } catch (err) {
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// messages
// ---------------------------------------------------------------------------

// Builds a small speaker toggle for a practice reply bubble: click to have
// the browser read it aloud via the Web Speech API's speechSynthesis
// (client-side only, no server cost), click again (or click another
// message) to stop. Progressive enhancement — appendMessage only calls this
// when "speechSynthesis" in window is true.
function buildSpeakButton(text) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "speak-btn";
  btn.setAttribute("aria-label", "Play this message aloud");
  btn.title = "Play aloud";
  btn.innerHTML = SPEAKER_ICON_SVG;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasSpeaking = btn.classList.contains("speaking");
    // Only one message plays at a time — stop whatever else is going first.
    window.speechSynthesis.cancel();
    document.querySelectorAll(".speak-btn.speaking").forEach((b) => b.classList.remove("speaking"));
    if (wasSpeaking) return; // this click was just "stop"

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = document.documentElement.lang || navigator.language || "en-US";
    utterance.rate = 1;
    utterance.addEventListener("start", () => btn.classList.add("speaking"));
    const reset = () => btn.classList.remove("speaking");
    utterance.addEventListener("end", reset);
    utterance.addEventListener("error", reset);
    window.speechSynthesis.speak(utterance);
  });

  return btn;
}

function appendMessage(role, text, animate, ctx, attachments) {
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
  // own messages) — a lightweight, free progressive enhancement built on
  // the browser's own Web Speech API, same approach as wireVoiceInput in
  // shared.js. Hidden automatically wherever speechSynthesis isn't
  // available (older Firefox, some mobile browsers).
  if (isPractice && !isUser && text && "speechSynthesis" in window) {
    bubble.appendChild(buildSpeakButton(text));
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
      alert(data.error || "Couldn't generate a debrief right now.");
      return;
    }
    appendPracticeDebrief(data);
  } catch (err) {
    console.error(err);
    alert("Couldn't connect to the server.");
  } finally {
    isFetchingDebrief = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }
}

function appendPracticeDebrief(debrief) {
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

  const footer = document.createElement("div");
  footer.className = "practice-debrief-footer";
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
