// "Together" — real account-to-account partner linking + the daily shared
// relationship question (task #98). Three things happen on this page,
// picked apart by the state* functions below:
//   1. No account yet / not logged in and opening an invite link → send
//      them to log in or register first, remembering the invite token so
//      auth-forms.js can bring them straight back here afterward.
//   2. Logged in and opening an invite link (?invite=TOKEN) → confirm +
//      accept it.
//   3. The normal "Together" dashboard — invite a partner, or (once
//      linked) answer today's question and look back at past ones.

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
    if (data.status === "active") {
      renderActive();
    } else if (data.status === "pending") {
      renderPending();
    } else {
      renderNone();
    }
  } catch (e) {
    stateEl.innerHTML = '<p class="text-muted" style="text-align:center;">Couldn\'t connect to the server.</p>';
  }
}

function renderNone() {
  const stateEl = document.getElementById("couple-state");
  stateEl.innerHTML = `
    <div class="couple-intro-card">
      <p>You're not linked with a partner yet. Send them an invite link — once they accept, you'll both get the same relationship question every day.</p>
      <button class="btn btn-gradient" id="create-invite-btn" type="button">Invite your partner</button>
    </div>
  `;
  document.getElementById("create-invite-btn").addEventListener("click", createInvite);
}

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
    renderPending();
  } catch (e) {
    await showAppAlert("Couldn't connect to the server.");
  }
}

function renderPending() {
  const stateEl = document.getElementById("couple-state");
  const url = `${window.location.origin}/couple.html?invite=${coupleStatus.inviteToken}`;
  stateEl.innerHTML = `
    <div class="couple-intro-card">
      <p>Send this link to your partner. Once they open it and accept, you'll both start getting the same daily question.</p>
      <div class="share-link-box">
        <span id="couple-link-text"></span>
        <button class="btn btn-gradient btn-sm" id="couple-copy-link-btn" type="button">Copy link</button>
      </div>
      <button class="btn btn-ghost btn-sm" id="cancel-invite-btn" type="button">Cancel invite</button>
    </div>
  `;
  document.getElementById("couple-link-text").textContent = url;
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
}

function renderActive() {
  const stateEl = document.getElementById("couple-state");
  stateEl.innerHTML = `
    <div class="couple-linked-head">
      <p class="text-muted">Linked with <strong>${escapeHtml(coupleStatus.partnerName)}</strong></p>
      <button class="btn btn-ghost btn-sm couple-danger-btn" id="unlink-btn" type="button">Unlink</button>
    </div>
    <section class="dashboard-card checkin-card couple-question-card" id="couple-today-card">
      <p class="text-muted" style="text-align:center; margin:0;">Loading today's question…</p>
    </section>
    <div class="couple-history-toggle">
      <button class="btn btn-ghost btn-sm" id="couple-history-btn" type="button">View past answers</button>
    </div>
    <div id="couple-history" style="display:none;"></div>
  `;
  document.getElementById("unlink-btn").addEventListener("click", unlinkCouple);
  document.getElementById("couple-history-btn").addEventListener("click", toggleHistory);
  loadToday();
}

async function unlinkCouple() {
  const ok = await showAppConfirm(
    "Unlink from your partner? This permanently deletes every daily question you've answered together — it can't be undone.",
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
    wrap.innerHTML = data
      .map(
        (entry) => `
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
      </div>`
      )
      .join("");
  } catch (e) {
    wrap.innerHTML = '<p class="text-muted">Couldn\'t connect to the server.</p>';
  }
}

function formatCoupleDate(dateKey) {
  try {
    return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  } catch (e) {
    return dateKey;
  }
}
