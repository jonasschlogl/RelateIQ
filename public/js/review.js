// Monthly review (Premium): a calm look back at one month. The numbers come
// from the server (real check-in scores, counts); the AI writes the words.

let reviewState = { reviews: [], current: null, previous: null, selected: null };

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  requireAuth();
  load();
  loadYear();
});

// Your year so far (Premium): the monthly reviews rolled into one story.
let yearData = null;

async function loadYear() {
  const el = document.getElementById("year-state");
  if (!el) return;
  try {
    const res = await authFetch("/api/year");
    const d = await safeJson(res);
    if (!res.ok || d.locked) return; // non-Premium already sees the Premium lock above
    yearData = d;
    renderYear();
  } catch (e) {
    /* ignore */
  }
}

function renderYear() {
  const el = document.getElementById("year-state");
  const d = yearData;
  if (!d.recap) {
    el.innerHTML = `<section class="dashboard-card rv-card yr-card">
      <p class="rv-month">${d.year} so far</p>
      <h2 class="rv-headline">Your year, in one page</h2>
      <p class="text-muted">${d.ready ? "I'll bring your months together: what changed, what worked, and what to carry forward." : "Once you've had a few more weeks of chats and check-ins, I can write your year so far."}</p>
      <div class="yr-actions"><button type="button" class="btn btn-gradient" id="yr-make" ${d.ready ? "" : "disabled"}>Write my year so far</button><span class="text-muted" id="yr-msg"></span></div>
    </section>`;
    document.getElementById("yr-make").addEventListener("click", makeYear);
    return;
  }
  const r = d.recap.recap || {};
  const st = d.recap.stats || {};
  const chips = [`${st.conversations || 0} chat${st.conversations === 1 ? "" : "s"}`, `${st.checkinDays || 0} check-in days`];
  if (st.rehearsals) chips.push(`${st.rehearsals} rehearsals`);
  if (st.experimentsTried) chips.push(`${st.experimentsWorked || 0} of ${st.experimentsTried} experiments worked`);
  const months = (st.months || []).filter((m) => m.avg != null);
  const bars = months.length >= 2
    ? `<div class="yr-bars" role="img" aria-label="Average connection score by month">${months
        .map((m) => `<div class="yr-bar"><span class="yr-bar-val">${m.avg}</span><span class="yr-bar-fill" style="height:${Math.max(6, m.avg * 10)}%"></span><span class="yr-bar-label">${escapeHtml(m.label)}</span></div>`)
        .join("")}</div>`
    : "";
  const score = st.averageScore != null ? `<div class="rv-score"><span class="rv-score-num">${st.averageScore}</span><span class="rv-score-of">/10 average connection</span>${st.firstAvg != null ? `<span class="rv-score-sub">${st.firstAvg} early in the year, ${st.lastAvg} lately</span>` : ""}</div>` : "";
  let html = `<p class="rv-month">${d.year} so far</p>`;
  if (r.headline) html += `<h2 class="rv-headline">${escapeHtml(r.headline)}</h2>`;
  html += `<div class="rv-chips">${chips.map((c) => `<span class="rv-chip">${escapeHtml(c)}</span>`).join("")}</div>${score}${bars}`;
  if (r.chapters && r.chapters.length) html += `<h3 class="rv-h">The chapters</h3>` + r.chapters.map((c) => `<div class="rv-theme"><strong>${escapeHtml(c.title)}</strong><p>${escapeHtml(c.description)}</p></div>`).join("");
  if (r.biggestShift) html += `<h3 class="rv-h">What changed most</h3><p>${escapeHtml(r.biggestShift)}</p>`;
  if (r.whatWorked && r.whatWorked.length) html += `<h3 class="rv-h">What worked</h3><ul class="rv-list rv-good">${r.whatWorked.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
  if (r.lookingAhead) html += `<h3 class="rv-h">Carrying forward</h3><p>${escapeHtml(r.lookingAhead)}</p>`;
  if (r.note) html += `<p class="rv-note">${escapeHtml(r.note)}</p>`;
  html += `<div class="yr-actions no-print"><button type="button" class="btn btn-ghost btn-sm" id="yr-print">Print / Save as PDF</button><button type="button" class="btn btn-ghost btn-sm" id="yr-make">Write it again</button><span class="text-muted" id="yr-msg"></span></div>`;
  el.innerHTML = `<section class="dashboard-card rv-card yr-card">${html}</section>`;
  document.getElementById("yr-print").addEventListener("click", () => window.print());
  document.getElementById("yr-make").addEventListener("click", makeYear);
}

async function makeYear() {
  const btn = document.getElementById("yr-make");
  const msg = document.getElementById("yr-msg");
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = "Writing…";
  try {
    const res = await authFetch("/api/year", { method: "POST", body: "{}" });
    const d = await safeJson(res);
    if (!res.ok) {
      msg.textContent = d.error || "Couldn't write it right now.";
      btn.disabled = false;
      btn.textContent = label;
      return;
    }
    yearData = d;
    renderYear();
  } catch (e) {
    msg.textContent = "Couldn't connect to the server.";
    btn.disabled = false;
    btn.textContent = label;
  }
}

async function load() {
  const el = document.getElementById("review-state");
  try {
    const res = await authFetch("/api/review");
    const data = await safeJson(res);
    if (!res.ok) {
      el.innerHTML = `<p class="text-muted" style="text-align:center;">${escapeHtml(data.error || "Couldn't load your reviews.")}</p>`;
      return;
    }
    if (data.locked) {
      renderPremiumLock(el, {
        title: "A calm look back, every month",
        text: "Premium writes you a review at the start of each month, and you can ask for one any time.",
        bullets: [
          "What kept coming up in your chats and check-ins",
          "How your connection score moved, with real numbers",
          "What worked from your Playbook, and what didn't",
          "One small thing to try next month",
        ],
      });
      return;
    }
    reviewState = { reviews: data.reviews, current: data.current, previous: data.previous, selected: data.reviews[0]?.key || null };
    render();
  } catch (e) {
    el.innerHTML = '<p class="text-muted" style="text-align:center;">Couldn\'t connect to the server.</p>';
  }
}

function monthLabel(key) {
  return new Date(key + "-01T00:00:00Z").toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function render() {
  const el = document.getElementById("review-state");
  el.innerHTML = "";
  const have = new Set(reviewState.reviews.map((r) => r.key));

  const bar = document.createElement("div");
  bar.className = "rv-bar";
  reviewState.reviews.forEach((r) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rv-pill" + (r.key === reviewState.selected ? " is-active" : "");
    b.textContent = r.title;
    b.addEventListener("click", () => {
      reviewState.selected = r.key;
      render();
    });
    bar.appendChild(b);
  });
  [reviewState.current, reviewState.previous].filter((k) => k && !have.has(k)).forEach((k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "rv-pill rv-new";
    b.textContent = "+ " + monthLabel(k) + (k === reviewState.current ? " so far" : "");
    b.addEventListener("click", () => create(k, b));
    bar.appendChild(b);
  });
  el.appendChild(bar);

  const msg = document.createElement("div");
  msg.id = "rv-msg";
  el.appendChild(msg);

  const sel = reviewState.reviews.find((r) => r.key === reviewState.selected);
  if (!sel) {
    msg.innerHTML = `<section class="dashboard-card pb-empty">
      <img class="empty-mascot" src="img/wisp-candle.svg" alt="" width="72" height="96" />
      <h3>No review yet</h3>
      <p class="text-muted">Pick a month above and I'll write one. You'll also get one automatically at the start of every month.</p></section>`;
    return;
  }
  el.appendChild(renderReview(sel));
}

async function create(key, btn, regenerate) {
  const msg = document.getElementById("rv-msg");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Writing…";
  }
  try {
    const res = await authFetch("/api/review", { method: "POST", body: JSON.stringify({ month: key, regenerate: !!regenerate }) });
    const data = await safeJson(res);
    if (!res.ok) {
      await showAppAlert(data.error || "Couldn't write the review.");
      render();
      return;
    }
    if (data.notEnoughData) {
      await showAppAlert(`Not enough in ${data.title} yet. A review needs a few conversations, check-ins or experiments from that month.`);
      render();
      return;
    }
    reviewState.reviews = [data, ...reviewState.reviews.filter((r) => r.key !== key)].sort((a, b) => (a.key < b.key ? 1 : -1));
    reviewState.selected = key;
    render();
  } catch (e) {
    await showAppAlert("Couldn't connect to the server.");
    render();
  }
}

function list(items, cls) {
  if (!items || !items.length) return "";
  return `<ul class="rv-list ${cls}">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
}

function renderReview(r) {
  const rv = r.review || {};
  const st = r.stats || {};
  const wrap = document.createElement("section");
  wrap.className = "dashboard-card rv-card";

  const chips = [];
  chips.push(`${st.conversations || 0} chat${st.conversations === 1 ? "" : "s"}`);
  if (st.rehearsals) chips.push(`${st.rehearsals} rehearsal${st.rehearsals === 1 ? "" : "s"}`);
  chips.push(`${st.checkinDays || 0} check-in day${st.checkinDays === 1 ? "" : "s"}`);
  if (st.experimentsTried) chips.push(`${st.experimentsWorked || 0} of ${st.experimentsTried} experiments worked`);

  let score = "";
  if (st.averageScore !== null && st.averageScore !== undefined) {
    const arrow = st.trend === "up" ? "↑ rising" : st.trend === "down" ? "↓ lower" : st.trend === "steady" ? "→ steady" : "";
    score = `<div class="rv-score"><span class="rv-score-num">${st.averageScore}</span><span class="rv-score-of">/10 average connection</span>${arrow ? `<span class="rv-trend rv-${st.trend}">${arrow}</span>` : ""}${st.firstAvg != null ? `<span class="rv-score-sub">${st.firstAvg} early in the month, ${st.lastAvg} later</span>` : ""}</div>`;
  }

  let html = `<p class="rv-month">${escapeHtml(r.title)}</p>`;
  if (rv.headline) html += `<h2 class="rv-headline">${escapeHtml(rv.headline)}</h2>`;
  html += `<div class="rv-chips">${chips.map((c) => `<span class="rv-chip">${escapeHtml(c)}</span>`).join("")}</div>`;
  html += score;
  if (rv.themes && rv.themes.length) {
    html += `<h3 class="rv-h">What kept coming up</h3>` + rv.themes.map((t) => `<div class="rv-theme"><strong>${escapeHtml(t.title)}</strong><p>${escapeHtml(t.description)}</p></div>`).join("");
  }
  if (rv.progress) html += `<h3 class="rv-h">How things moved</h3><p>${escapeHtml(rv.progress)}</p>`;
  if ((rv.whatWorked && rv.whatWorked.length) || (rv.whatDidnt && rv.whatDidnt.length)) {
    html += `<div class="rv-cols">`;
    if (rv.whatWorked.length) html += `<div><h3 class="rv-h">What worked</h3>${list(rv.whatWorked, "rv-good")}</div>`;
    if (rv.whatDidnt.length) html += `<div><h3 class="rv-h">What didn't</h3>${list(rv.whatDidnt, "rv-bad")}</div>`;
    html += `</div>`;
  }
  if (rv.nextStep) html += `<div class="rv-next"><span>Try next month</span><p>${escapeHtml(rv.nextStep)}</p></div>`;
  if (rv.note) html += `<p class="rv-note">${escapeHtml(rv.note)}</p>`;
  html += `<div class="rv-actions"><button type="button" class="btn btn-ghost btn-sm" id="rv-regen">Write it again</button> <a class="btn btn-ghost btn-sm" href="pack.html">Therapist pack</a></div>`;
  wrap.innerHTML = html;
  wrap.querySelector("#rv-regen").addEventListener("click", (e) => create(r.key, e.target, true));
  return wrap;
}
