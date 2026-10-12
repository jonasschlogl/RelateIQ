// "Daily question": one open-ended relationship question per day, answered
// privately. Each user has their own stream; nothing here is shared.

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  requireAuth();
  renderShell();
});

function renderShell() {
  const stateEl = document.getElementById("daily-state");
  stateEl.innerHTML = `
    <section class="dashboard-card checkin-card couple-question-card" id="daily-today-card">
      <p class="text-muted" style="text-align:center; margin:0;">Loading today's question…</p>
    </section>
    <div class="couple-history-toggle">
      <button class="btn btn-ghost btn-sm" id="daily-history-btn" type="button">View past answers</button>
    </div>
    <div id="daily-history" style="display:none;"></div>
  `;
  document.getElementById("daily-history-btn").addEventListener("click", toggleHistory);
  loadToday();
}

async function loadToday() {
  const card = document.getElementById("daily-today-card");
  try {
    const res = await authFetch("/api/daily-question/today");
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
  const card = document.getElementById("daily-today-card");
  if (!data.myAnswer) {
    card.innerHTML = `
      <p class="checkin-question">${escapeHtml(data.question)}</p>
      <div class="checkin-answer">
        <textarea id="daily-answer-input" maxlength="2000" placeholder="Take your time — this is just for you."></textarea>
      </div>
      <div class="checkin-actions">
        <button class="btn btn-primary btn-sm" id="daily-answer-btn" type="button">Submit answer</button>
      </div>
      <div class="form-error" id="daily-answer-error" style="display:none;"></div>
    `;
    autoGrowTextarea(document.getElementById("daily-answer-input"), 220);
    document.getElementById("daily-answer-btn").addEventListener("click", submitTodayAnswer);
    return;
  }
  card.innerHTML = `
    <p class="checkin-question">${escapeHtml(data.question)}</p>
    <div class="couple-answer-block">
      <span class="couple-answer-label">Your answer</span>
      <p class="couple-answer-text">${escapeHtml(data.myAnswer)}</p>
    </div>
  `;
}

async function submitTodayAnswer() {
  const textEl = document.getElementById("daily-answer-input");
  const errorEl = document.getElementById("daily-answer-error");
  const btn = document.getElementById("daily-answer-btn");
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
    const res = await authFetch("/api/daily-question/today/answer", {
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
    historyLoaded = false; // today becomes "past" tomorrow; refetch next time it's opened
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
  const wrap = document.getElementById("daily-history");
  const btn = document.getElementById("daily-history-btn");
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
    const res = await authFetch("/api/daily-question/history");
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
  return `
    <div class="couple-history-entry">
      <div class="couple-history-date">${formatDailyDate(entry.date)}</div>
      <p class="checkin-question" style="font-size:15px;">${escapeHtml(entry.question)}</p>
      <div class="couple-answer-block">
        <span class="couple-answer-label">Your answer</span>
        <p class="couple-answer-text">${escapeHtml(entry.myAnswer)}</p>
      </div>
    </div>`;
}

function formatDailyDate(dateKey) {
  try {
    return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  } catch (e) {
    return dateKey;
  }
}
