// The daily check-in, used both on the dashboard card and on the Daily page so
// the two always look and behave the same: an optional 1-10 "how connected do
// you feel" rating, today's question with an optional written answer, Save or
// Skip. Needs shared.js (authFetch, safeJson, escapeHtml, autoGrowTextarea).

async function mountCheckin(opts) {
  const body = opts.body;
  const streakEl = opts.streak || null;
  const onSaved = typeof opts.onSaved === "function" ? opts.onSaved : null;

  function showStreak(n) {
    if (!streakEl) return;
    if (n > 0) {
      streakEl.style.display = "inline-flex";
      streakEl.textContent = `${n}-day streak`;
    } else {
      streakEl.style.display = "none";
    }
  }

  function render(data) {
    showStreak(data.streak || 0);
    if (data.answered) return renderDone(data);
    if (data.skipped) return renderSkipped(data);
    renderForm(data.question);
  }

  function questionHtml(question) {
    return `<p class="checkin-question-label">Today's question</p><p class="checkin-question">${escapeHtml(question)}</p>`;
  }

  function renderDone(data) {
    const scoreLine = typeof data.score === "number" ? `<p class="checkin-score-done">Connection today: ${data.score}/10</p>` : "";
    const answerBlock = data.answer
      ? `<div class="couple-answer-block">
           <span class="couple-answer-label">Your answer</span>
           <p class="couple-answer-text" data-no-i18n>${escapeHtml(data.answer)}</p>
         </div>`
      : "";
    body.innerHTML = `
      ${scoreLine}
      ${questionHtml(data.question)}
      ${answerBlock}
      <p class="checkin-done">✓ You checked in today.</p>
    `;
  }

  function renderSkipped(data) {
    body.innerHTML = `
      ${questionHtml(data.question)}
      <p class="checkin-done">Skipped for today. No pressure. <a href="#" id="checkin-undo-skip" style="text-decoration:underline;">Answer it instead</a></p>
    `;
    document.getElementById("checkin-undo-skip")?.addEventListener("click", (e) => {
      e.preventDefault();
      renderForm(data.question);
    });
  }

  function renderForm(question) {
    body.innerHTML = `
      <div class="checkin-score-row">
        <label for="checkin-score-input">How connected do you feel today?</label>
        <div class="checkin-score-slider-row">
          <input type="range" id="checkin-score-input" class="is-unset" min="1" max="10" step="1" value="5" />
          <span class="checkin-score-value is-unset" id="checkin-score-value">–</span>
          <span class="text-muted" style="font-size:11.5px;">/10</span>
        </div>
      </div>
      ${questionHtml(question)}
      <div class="checkin-answer">
        <textarea id="checkin-input" maxlength="2000" placeholder="Optional: take your time. This is just for you."></textarea>
      </div>
      <div class="checkin-actions">
        <button class="btn btn-primary btn-sm" id="checkin-save-btn" type="button">Save</button>
        <button class="btn btn-ghost btn-sm" id="checkin-skip-btn" type="button">Skip today</button>
      </div>
      <div class="form-error" id="checkin-error" style="display:none;"></div>
    `;
    const scoreInput = document.getElementById("checkin-score-input");
    const scoreValue = document.getElementById("checkin-score-value");
    // The slider starts unset (shows a dash), so a score is only saved when the
    // person actually chose one.
    const touch = () => {
      scoreInput.dataset.touched = "1";
      scoreInput.classList.remove("is-unset");
      scoreValue.classList.remove("is-unset");
      scoreValue.textContent = scoreInput.value;
    };
    scoreInput.addEventListener("input", touch);
    scoreInput.addEventListener("click", touch);
    document.getElementById("checkin-save-btn").addEventListener("click", () => submit(false));
    document.getElementById("checkin-skip-btn").addEventListener("click", () => submit(true));
    autoGrowTextarea(document.getElementById("checkin-input"), 220);
  }

  async function submit(skip) {
    const errorEl = document.getElementById("checkin-error");
    const saveBtn = document.getElementById("checkin-save-btn");
    const skipBtn = document.getElementById("checkin-skip-btn");
    const showError = (msg) => {
      if (!errorEl) return;
      errorEl.textContent = msg;
      errorEl.style.display = "block";
    };
    if (errorEl) errorEl.style.display = "none";

    const payload = {};
    if (skip) {
      payload.skip = true;
    } else {
      const val = (document.getElementById("checkin-input")?.value || "").trim();
      const scoreInput = document.getElementById("checkin-score-input");
      const touched = !!(scoreInput && scoreInput.dataset.touched);
      if (!val && !touched) {
        showError("Move the slider or write a few words to save today, or press Skip today.");
        return;
      }
      if (val) payload.answer = val;
      if (touched) payload.score = Number(scoreInput.value);
    }

    if (saveBtn) saveBtn.disabled = true;
    if (skipBtn) skipBtn.disabled = true;
    try {
      const res = await authFetch("/api/checkin", { method: "POST", body: JSON.stringify(payload) });
      const data = await safeJson(res);
      if (!res.ok) {
        showError(data.error || "Couldn't save your answer.");
        if (saveBtn) saveBtn.disabled = false;
        if (skipBtn) skipBtn.disabled = false;
        return;
      }
      render(data);
      if (onSaved) onSaved(data);
    } catch (err) {
      console.error(err);
      showError("Couldn't connect to the server.");
      if (saveBtn) saveBtn.disabled = false;
      if (skipBtn) skipBtn.disabled = false;
    }
  }

  body.innerHTML = '<p class="text-muted" style="margin:0;">Loading today\'s question…</p>';
  try {
    const res = await authFetch("/api/checkin/today");
    const data = await safeJson(res);
    if (!res.ok) {
      body.innerHTML = `<p class="text-muted" style="margin:0;">${escapeHtml(data.error || "Couldn't load today's question.")}</p>`;
      return false;
    }
    render(data);
    return true;
  } catch (err) {
    console.error(err);
    body.innerHTML = '<p class="text-muted" style="margin:0;">Couldn\'t connect to the server.</p>';
    return false;
  }
}
