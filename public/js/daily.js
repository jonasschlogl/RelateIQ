// Daily check-in page: today's rating and question (the same form as the
// dashboard card, see js/checkin.js) plus the list of past answers. Each user
// has their own stream; nothing here is shared.

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  requireAuth();
  renderShell();
});

function renderShell() {
  const stateEl = document.getElementById("daily-state");
  stateEl.innerHTML = `
    <section class="dashboard-card checkin-card couple-question-card" id="daily-today-card">
      <div class="checkin-streak-row"><span class="streak-badge" id="daily-streak" style="display:none;"></span></div>
      <div id="daily-today-body"></div>
    </section>
    <div class="couple-history-toggle">
      <button class="btn btn-ghost btn-sm" id="daily-history-btn" type="button">View past answers</button>
    </div>
    <div id="daily-history" style="display:none;"></div>
  `;
  document.getElementById("daily-history-btn").addEventListener("click", toggleHistory);
  mountCheckin({
    body: document.getElementById("daily-today-body"),
    streak: document.getElementById("daily-streak"),
    onSaved: () => {
      historyLoaded = false; // today becomes "past" tomorrow; refetch next time it's opened
    },
  });
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
      wrap.innerHTML = '<p class="text-muted">No past days yet. Check back after today\'s question.</p>';
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
    return new Date(`${dateKey}T00:00:00`).toLocaleDateString(window.appLocale, { weekday: "long", month: "short", day: "numeric" });
  } catch (e) {
    return dateKey;
  }
}
