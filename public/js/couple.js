// "Together" — the daily relationship question. Works two ways, decided by
// whether the user currently has an active partner link (task #98, reworked
// per Jonas: works solo from day one, and only becomes a shared couple
// stream once a partner is actually linked):
//   - Solo (no active link, whether status is "none" or "pending" — an
//     invite just sent but not yet accepted still counts as solo): the
//     user answers today's question just for themselves. No partner, no
//     reveal mechanic.
//   - Couple (active link): real account-to-account partner linking. Both
//     partners get the SAME question every day and only see each other's
//     answer after submitting their own.
// A user's solo history and a couple's shared history are never mixed —
// linking a partner starts the shared stream completely fresh; see the
// server-side comment on ensureTodaysSoloQuestion for why.
//
// Three things happen on this page, picked apart by the functions below:
//   1. No account yet / not logged in and opening an invite link → send
//      them to log in or register first, remembering the invite token so
//      auth-forms.js can bring them straight back here afterward.
//   2. Logged in and opening an invite link (?invite=TOKEN) → confirm +
//      accept it.
//   3. The normal "Together" dashboard — today's question (solo or couple),
//      history, and (if not yet linked) an invite-your-partner option.

let coupleStatus = null; // last GET /api/couple result, cached for re-renders

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const inviteToken = new URLSearchParams(window.location.search).get("invite");
  if (inviteToken) {
    loadInviteFlow(inviteToken);
  } else {
    requireAuth();
    loadDashboard();
  }
});

// ---------------------------------------------------------------------------
// Invite landing flow (?invite=TOKEN)
// ---------------------------------------------------------------------------

async function loadInviteFlow(token) {
  const stateEl = document.getElementById("couple-state");
  stateEl.innerHTML = '<p class="text-muted" style="text-align:center;">Loading…</p>';

  let preview;
  try {
    const res = await fetch(`/api/public/couple-invite/${encodeURIComponent(token)}`);
    preview = await safeJson(res);
    if (!res.ok) {
      stateEl.innerHTML = `<p class="text-muted" style="text-align:center;">${escapeHtml(preview.error || "This invite link isn't available.")}</p>`;
      return;
    }
  } catch (e) {
    stateEl.innerHTML = '<p class="text-muted" style="text-align:center;">Couldn\'t connect to the server.</p>';
    return;
  }

  if (!getToken()) {
    stateEl.innerHTML = `
      <div class="couple-invite-card">
        <p><strong>${escapeHtml(preview.inviterName)}</strong> wants to connect with you on RelateIQ so you can both answer the same daily relationship question.</p>
        <p class="text-muted">You'll need a RelateIQ account to accept — it only takes a minute.</p>
        <div class="couple-invite-actions">
          <button class="btn btn-gradient" id="invite-register-btn" type="button">Create an account</button>
          <button class="btn btn-ghost" id="invite-login-btn" type="button">I already have one — log in</button>
        </div>
      </div>
    `;
    document.getElementById("invite-register-btn").addEventListener("click", () => {
      setPendingCoupleInvite(token);
      window.location.href = "register.html";
    });
    document.getElementById("invite-login-btn").addEventListener("click", () => {
      setPendingCoupleInvite(token);
      window.location.href = "login.html";
    });
    return;
  }

  stateEl.innerHTML = `
    <div class="couple-invite-card">
      <p><strong>${escapeHtml(preview.inviterName)}</strong> wants to connect with you on RelateIQ so you can both answer the same daily relationship question — you'll only see each other's answer after you've both written your own.</p>
      <div class="couple-invite-actions">
        <button class="btn btn-gradient" id="invite-accept-btn" type="button">Accept and connect</button>
        <button class="btn btn-ghost" id="invite-decline-btn" type="button">Not now</button>
      </div>
      <div class="form-error" id="invite-error" style="display:none;"></div>
    </div>
  `;
  document.getElementById("invite-decline-btn").addEventListener("click", () => {
    window.location.href = "couple.html";
  });
  document.getElementById("invite-accept-btn").addEventListener("click", async () => {
    const btn = document.getElementById("invite-accept-btn");
    const errorEl = document.getElementById("invite-error");
    errorEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Connecting…";
    try {
      const res = await authFetch(`/api/couple/invite/${encodeURIComponent(token)}/accept`, { method: "POST" });
      const data = await safeJson(res);
      if (!res.ok) {
        errorEl.textContent = data.error || "Couldn't accept that invite.";
        errorEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Accept and connect";
        return;
      }
      window.location.href = "couple.html";
    } catch (e) {
      errorEl.textContent = "Couldn't connect to the server.";
      errorEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Accept and connect";
    }
  });
}

// ---------------------------------------------------------------------------
// Normal dashboard (no invite in the URL)
// ---------------------------------------------------------------------------

async function loadDashboard() {
  const stateEl = document.getElementById("couple-state");
  stateEl.innerHTML = '<p class="text-muted" style="text-align:center;">Loading…</p>';
  try {
    const res = await authFetch("/api/couple");
    const data = await safeJson(res);
    if (!res.ok) {
      stateEl.innerHTML = `<p class="text-muted" style="text-align:center;">${escapeHtml(data.error || "Couldn't load this right now.")}</p>`;
      return;
    }
    coupleStatus = data;
    renderShell();
  } catch (e) {
    stateEl.innerHTML = '<p class="text-muted" style="text-align:center;">Couldn\'t connect to the server.</p>';
  }
}

// Renders the header (varies by link status: none / pending / active) plus
// the daily-question card and history toggle, which are always present —
// solo users (status "none" or "pending", since a pending invite hasn't
// been accepted yet) get the same today-card/history UI as linked couples,
// just without the partner/reveal layer (see renderToday/toggleHistory,
// which branch on the response's `mode` field).
function renderShell() {
  const stateEl = document.getElementById("couple-state");
  stateEl.innerHTML = `
    <div id="couple-header">${headerHtml(coupleStatus.status)}</div>
    <section class="dashboard-card checkin-card couple-question-card" id="couple-today-card">
      <p class="text-muted" style="text-align:center; margin:0;">Loading today's question…</p>
    </section>
    <div class="couple-history-toggle">
      <button class="btn btn-ghost btn-sm" id="couple-history-btn" type="button">View past answers</button>
    </div>
    <div id="couple-history" style="display:none;"></div>
  `;
  wireHeader(coupleStatus.status);
  document.getElementById("couple-history-btn").addEventListener("click", toggleHistory);
  historyLoaded = false; // status may have just changed (e.g. unlink) — re-fetch fresh on next open
  loadToday();
}

function headerHtml(status) {
  if (status === "active") {
    return `
      <div class="couple-linked-head">
        <p class="text-muted">Linked with <strong>${escapeHtml(coupleStatus.partnerName)}</strong></p>
        <button class="btn btn-ghost btn-sm couple-danger-btn" id="unlink-btn" type="button">Unlink</button>
      </div>
    `;
  }
  if (status === "pending") {
    const url = `${window.location.origin}/couple.html?invite=${coupleStatus.inviteToken}`;
    return `
      <div class="couple-intro-card">
        <p>Answer today's question below while you wait — and send this link to your partner. Once they open it and accept, you'll both start getting the same daily question together instead.</p>
        <div class="share-link-box">
          <span id="couple-link-text">${escapeHtml(url)}</span>
          <button class="btn btn-gradient btn-sm" id="couple-copy-link-btn" type="button">Copy link</button>
        </div>
        <button class="btn btn-ghost btn-sm" id="cancel-invite-btn" type="button">Cancel invite</button>
      </div>
    `;
  }
  return `
    <div class="couple-intro-card">
      <p>Answer today's question below, just for yourself — or invite your partner and you'll both start getting the same daily question together instead.</p>
      <button class="btn btn-gradient" id="create-invite-btn" type="button">Invite your partner</button>
    </div>
  `;
}

function wireHeader(status) {
  if (status === "active") {
    document.getElementById("unlink-btn").addEventListener("click", unlinkCouple);
    return;
  }
  if (status === "pending") {
    const url = `${window.location.origin}/couple.html?invite=${coupleStatus.inviteToken}`;
    document.getElementById("couple-copy-link-btn").addEventListener("click", async () => {
      const copyBtn = document.getElementById("couple-copy-link-btn");
      try {
        await navigator.clipboard.writeText(url);
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy link"), 1500);
      } catch (e) {
        await showAppAlert("Couldn't copy automatically — select the link text above and copy it manually.");
      }
    });
    document.getElementById("cancel-invite-btn").addEventListener("click", async () => {
      const ok = await showAppConfirm("Cancel this invite? The link will stop working.", { confirmLabel: "Cancel invite", danger: true });
      if (!ok) return;
      try {
        const res = await authFetch("/api/couple", { method: "DELETE" });
        if (res.ok) loadDashboard();
      } catch (e) {
        await showAppAlert("Couldn't connect to the server.");
      }
    });
    return;
  }
  document.getElementById("create-invite-btn").addEventListener("click", createInvite);
}

// Status "none" → "pending" doesn't change solo-vs-couple mode (still solo
// either way until a partner actually accepts), so this only swaps the
// header — no need to re-fetch/re-render today's question or history.
async function createInvite() {
  const btn = document.getElementById("create-invite-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Creating link…";
  }
  try {
    const res = await authFetch("/api/couple/invite", { method: "POST" });
    const data = await safeJson(res);
    if (!res.ok) {
      await showAppAlert(data.error || "Couldn't create an invite link.");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Invite your partner";
      }
      return;
    }
    coupleStatus = data;
    document.getElementById("couple-header").innerHTML = headerHtml("pending");
    wireHeader("pending");
  } catch (e) {
    await showAppAlert("Couldn't connect to the server.");
  }
}

async function unlinkCouple() {
  const ok = await showAppConfirm(
    "Unlink from your partner? This permanently deletes every daily question you've answered together — it can't be undone. (Your own answers from before you linked, if any, are kept separately and untouched.)",
    { confirmLabel: "Unlink", danger: true }
  );
  if (!ok) return;
  try {
    const res = await authFetch("/api/couple", { method: "DELETE" });
    if (res.ok) {
      loadDashboard();
    } else {
      const data = await safeJson(res);
      await showAppAlert(data.error || "Couldn't unlink right now.");
    }
  } catch (e) {
    await showAppAlert("Couldn't connect to the server.");
  }
}

async function loadToday() {
  const card = document.getElementById("couple-today-card");
  try {
    const res = await authFetch("/api/couple/question/today");
    const data = await safeJson(res);
    if (!res.ok) {
      card.innerHTML = `<p class="text-muted" style="text-align:center; margin:0;">${escapeHtml(data.error || "Couldn't load today's question.")}</p>`;
      return;
    }
    renderToday(data);
  } catch (e) {
    card.innerHTML = '<p class="text-muted" style="text-align:center; margin:0;">Couldn\'t connect to the server.</p>';
  }
}

function renderToday(data) {
  const card = document.getElementById("couple-today-card");

  if (data.mode === "solo") {
    if (!data.myAnswer) {
      card.innerHTML = `
        <p class="checkin-question">${escapeHtml(data.question)}</p>
        <div class="checkin-answer">
          <textarea id="couple-answer-input" maxlength="2000" placeholder="Take your time — this is just for you."></textarea>
        </div>
        <div class="checkin-actions">
          <button class="btn btn-primary btn-sm" id="couple-answer-btn" type="button">Submit answer</button>
        </div>
        <div class="form-error" id="couple-answer-error" style="display:none;"></div>
      `;
      autoGrowTextarea(document.getElementById("couple-answer-input"), 220);
      document.getElementById("couple-answer-btn").addEventListener("click", submitTodayAnswer);
      return;
    }
    card.innerHTML = `
      <p class="checkin-question">${escapeHtml(data.question)}</p>
      <div class="couple-answer-block">
        <span class="couple-answer-label">Your answer</span>
        <p class="couple-answer-text">${escapeHtml(data.myAnswer)}</p>
      </div>
    `;
    return;
  }

  // Couple mode — blind until you've answered your own.
  if (!data.revealed) {
    card.innerHTML = `
      <p class="checkin-question">${escapeHtml(data.question)}</p>
      ${data.partnerHasAnswered ? '<p class="couple-partner-note">Your partner has already answered — write yours to see it.</p>' : ""}
      <div class="checkin-answer">
        <textarea id="couple-answer-input" maxlength="2000" placeholder="Take your time — this is just for the two of you."></textarea>
      </div>
      <div class="checkin-actions">
        <button class="btn btn-primary btn-sm" id="couple-answer-btn" type="button">Submit answer</button>
      </div>
      <div class="form-error" id="couple-answer-error" style="display:none;"></div>
    `;
    autoGrowTextarea(document.getElementById("couple-answer-input"), 220);
    document.getElementById("couple-answer-btn").addEventListener("click", submitTodayAnswer);
    return;
  }

  card.innerHTML = `
    <p class="checkin-question">${escapeHtml(data.question)}</p>
    <div class="couple-answer-pair">
      <div class="couple-answer-block">
        <span class="couple-answer-label">You</span>
        <p class="couple-answer-text">${escapeHtml(data.myAnswer)}</p>
      </div>
      <div class="couple-answer-block">
        <span class="couple-answer-label">Them</span>
        ${
          data.partnerAnswer
            ? `<p class="couple-answer-text">${escapeHtml(data.partnerAnswer)}</p>`
            : '<p class="couple-answer-text couple-answer-waiting">Waiting for them to answer…</p>'
        }
      </div>
    </div>
  `;
}

async function submitTodayAnswer() {
  const textEl = document.getElementById("couple-answer-input");
  const errorEl = document.getElementById("couple-answer-error");
  const btn = document.getElementById("couple-answer-btn");
  const answer = textEl.value.trim();
  errorEl.style.display = "none";
  if (!answer) {
    errorEl.textContent = "Write an answer first.";
    errorEl.style.display = "block";
    return;
  }
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    const res = await authFetch("/api/couple/question/today/answer", {
      method: "POST",
      body: JSON.stringify({ answer }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      errorEl.textContent = data.error || "Couldn't save your answer.";
      errorEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Submit answer";
      return;
    }
    renderToday(data);
  } catch (e) {
    errorEl.textContent = "Couldn't connect to the server.";
    errorEl.style.display = "block";
    btn.disabled = false;
    btn.textContent = "Submit answer";
  }
}

let historyLoaded = false;

async function toggleHistory() {
  const wrap = document.getElementById("couple-history");
  const btn = document.getElementById("couple-history-btn");
  const showing = wrap.style.display !== "none";
  if (showing) {
    wrap.style.display = "none";
    btn.textContent = "View past answers";
    return;
  }
  wrap.style.display = "block";
  btn.textContent = "Hide past answers";
  if (historyLoaded) return;

  wrap.innerHTML = '<p class="text-muted">Loading…</p>';
  try {
    const res = await authFetch("/api/couple/question/history");
    const data = await safeJson(res);
    if (!res.ok) {
      wrap.innerHTML = `<p class="text-muted">${escapeHtml(data.error || "Couldn't load past answers.")}</p>`;
      return;
    }
    historyLoaded = true;
    if (!data.length) {
      wrap.innerHTML = '<p class="text-muted">No past days yet — check back after today\'s question.</p>';
      return;
    }
    wrap.innerHTML = data.map(renderHistoryEntry).join("");
  } catch (e) {
    wrap.innerHTML = '<p class="text-muted">Couldn\'t connect to the server.</p>';
  }
}

function renderHistoryEntry(entry) {
  if (entry.mode === "solo") {
    return `
      <div class="couple-history-entry">
        <div class="couple-history-date">${formatCoupleDate(entry.date)}</div>
        <p class="checkin-question" style="font-size:15px;">${escapeHtml(entry.question)}</p>
        <div class="couple-answer-block">
          <span class="couple-answer-label">Your answer</span>
          <p class="couple-answer-text">${escapeHtml(entry.myAnswer)}</p>
        </div>
      </div>`;
  }
  return `
      <div class="couple-history-entry">
        <div class="couple-history-date">${formatCoupleDate(entry.date)}</div>
        <p class="checkin-question" style="font-size:15px;">${escapeHtml(entry.question)}</p>
        <div class="couple-answer-pair">
          <div class="couple-answer-block">
            <span class="couple-answer-label">You</span>
            <p class="couple-answer-text">${escapeHtml(entry.myAnswer)}</p>
          </div>
          <div class="couple-answer-block">
            <span class="couple-answer-label">Them</span>
            ${
              entry.partnerAnswer
                ? `<p class="couple-answer-text">${escapeHtml(entry.partnerAnswer)}</p>`
                : '<p class="couple-answer-text couple-answer-waiting">They never answered that day.</p>'
            }
          </div>
        </div>
      </div>`;
}

function formatCoupleDate(dateKey) {
  try {
    return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  } catch (e) {
    return dateKey;
  }
}
