// After a fight: a calm-down guide (everyone) and a personal message to reach
// out with (Pro: 3 a month, Premium: unlimited, tailored, with a next-day
// check-in). Limits are enforced on the server.

let sosState = { plan: "free", usage: null, partners: [] };
let sosBusy = false;
let sosWant = "reconnect";
let breatheTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  requireAuth();
  document.getElementById("sos-start")?.addEventListener("click", startBreathing);
  load();
});

function startBreathing() {
  const btn = document.getElementById("sos-start");
  const circle = document.getElementById("sos-circle");
  const text = document.getElementById("sos-circle-text");
  if (breatheTimer) {
    clearTimeout(breatheTimer);
    breatheTimer = null;
    circle.classList.remove("is-in", "is-out");
    text.textContent = "Ready?";
    btn.textContent = "Start, about a minute";
    return;
  }
  btn.textContent = "Stop";
  let cycles = 0;
  const total = 5;
  const step = (inhale) => {
    if (cycles >= total) {
      circle.classList.remove("is-in", "is-out");
      text.textContent = "Well done";
      btn.textContent = "Again";
      breatheTimer = null;
      return;
    }
    circle.classList.toggle("is-in", inhale);
    circle.classList.toggle("is-out", !inhale);
    text.textContent = inhale ? "Breathe in…" : "Slowly out…";
    if (!inhale) cycles += 1;
    breatheTimer = setTimeout(() => step(!inhale), inhale ? 4000 : 6000);
  };
  step(true);
}

async function load() {
  const el = document.getElementById("sos-state");
  try {
    const res = await authFetch("/api/sos");
    const data = await safeJson(res);
    if (!res.ok) {
      el.innerHTML = `<p class="text-muted" style="text-align:center;">${escapeHtml(data.error || "Couldn't load this page.")}</p>`;
      return;
    }
    sosState = { plan: data.plan, usage: data.usage, partners: data.partners || [] };
    renderReachOut();
  } catch (e) {
    el.innerHTML = '<p class="text-muted" style="text-align:center;">Couldn\'t connect to the server.</p>';
  }
}

function usageLine() {
  const u = sosState.usage;
  if (!u || sosState.plan !== "pro") return "";
  return `${Math.max(0, u.limit - u.used)} of ${u.limit} messages left this month`;
}

function renderReachOut() {
  const el = document.getElementById("sos-state");
  if (sosState.plan === "free") {
    el.innerHTML = `
      <section class="dashboard-card sos-card sos-locked">
        <h2 class="pb-h">3. Words to reach out with <span class="pb-lock">Pro</span></h2>
        <p class="text-muted">Tell us a little about what happened and get a short message in your own voice that opens the door without re-arguing, plus what not to do right now.</p>
        <button type="button" class="btn btn-gradient" id="sos-upgrade">See Pro</button>
      </section>`;
    document.getElementById("sos-upgrade").addEventListener("click", () => startCheckout("pro"));
    return;
  }
  const premium = sosState.plan === "premium";
  const partnerField =
    premium && sosState.partners.length
      ? `<label class="practice-setup-field-label" for="sos-partner">Who was it with? <span class="text-muted">(tailors it to them)</span></label>
         <select id="sos-partner"><option value="">Not specified</option>${sosState.partners.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("")}</select>`
      : !premium
      ? `<p class="text-muted mc-note"><span class="pb-lock">Premium</span> tailors it to them and checks in with you the next day. <a href="#" id="sos-see-premium">See Premium</a></p>`
      : "";
  el.innerHTML = `
    <section class="dashboard-card sos-card">
      <h2 class="pb-h">3. Words to reach out with</h2>
      <label class="practice-setup-field-label" for="sos-what">What happened? <span class="text-muted">(optional, a sentence or two)</span></label>
      <textarea id="sos-what" rows="3" maxlength="800" placeholder="e.g. We argued about the dishes and I said something harsh"></textarea>
      <label class="practice-setup-field-label">What do you want right now?</label>
      <div class="pb-choices" id="sos-want">
        <button type="button" class="pb-choice is-picked" data-w="reconnect">Reconnect</button>
        <button type="button" class="pb-choice" data-w="apologize">Say sorry</button>
        <button type="button" class="pb-choice" data-w="space">Ask for space</button>
      </div>
      ${partnerField}
      <div class="form-error" id="sos-error" style="display:none;"></div>
      <div class="mc-actions">
        <button type="button" class="btn btn-gradient" id="sos-go">Write it with me</button>
        <span class="text-muted mc-usage" id="sos-usage">${escapeHtml(usageLine())}</span>
      </div>
    </section>
    <div id="sos-result"></div>`;
  el.querySelectorAll("#sos-want .pb-choice").forEach((b) =>
    b.addEventListener("click", () => {
      sosWant = b.dataset.w;
      el.querySelectorAll("#sos-want .pb-choice").forEach((x) => x.classList.toggle("is-picked", x === b));
    })
  );
  document.getElementById("sos-go").addEventListener("click", runSos);
  document.getElementById("sos-see-premium")?.addEventListener("click", (e) => {
    e.preventDefault();
    startCheckout("premium");
  });
}

function sosError(msg) {
  const e = document.getElementById("sos-error");
  if (!e) return;
  e.textContent = msg || "";
  e.style.display = msg ? "block" : "none";
}

async function runSos() {
  if (sosBusy) return;
  sosError("");
  sosBusy = true;
  const btn = document.getElementById("sos-go");
  btn.disabled = true;
  btn.textContent = "Thinking…";
  try {
    const res = await authFetch("/api/sos", {
      method: "POST",
      body: JSON.stringify({
        what: document.getElementById("sos-what").value.trim(),
        want: sosWant,
        partnerProfileId: document.getElementById("sos-partner")?.value || null,
      }),
    });
    const data = await safeJson(res);
    if (data.usage) sosState.usage = data.usage;
    document.getElementById("sos-usage").textContent = usageLine();
    if (!res.ok) {
      if (data.sosLimit) {
        sosError(data.error);
        const go = await showAppConfirm(
          "You've used your 3 messages for this month. Premium has no limit, tailors each message to them and checks in with you the next day.",
          { confirmLabel: "See Premium", cancelLabel: "Not now" }
        );
        if (go) startCheckout("premium");
      } else {
        sosError(data.error || "Couldn't put that together right now.");
      }
      return;
    }
    renderResult(data);
  } catch (e) {
    sosError("Couldn't connect to the server.");
  } finally {
    sosBusy = false;
    btn.disabled = false;
    btn.textContent = "Write it with me";
  }
}

function copyBtn(text) {
  return `<button type="button" class="btn btn-ghost btn-sm" data-copy="${escapeHtml(text)}">Copy</button>`;
}

function renderResult(d) {
  const out = document.getElementById("sos-result");
  out.innerHTML = `
    <section class="dashboard-card sos-card sos-result">
      ${d.first ? `<p class="sos-first">${escapeHtml(d.first)}</p>` : ""}
      ${d.say ? `<div class="mc-version"><div class="mc-version-head"><strong>You could say</strong>${copyBtn(d.say)}</div><p>${escapeHtml(d.say)}</p></div>` : ""}
      ${d.alsoOk ? `<div class="mc-version"><div class="mc-version-head"><strong>Or, shorter</strong>${copyBtn(d.alsoOk)}</div><p>${escapeHtml(d.alsoOk)}</p></div>` : ""}
      ${d.dontDo && d.dontDo.length ? `<p class="practice-plan-label">Not right now</p><ul class="sos-list">${d.dontDo.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}
      ${d.later ? `<p class="text-muted">${escapeHtml(d.later)}</p>` : ""}
      ${d.followUp ? '<p class="text-muted sos-followup">Tomorrow I\'ll check in to see how things are.</p>' : ""}
    </section>`;
  out.querySelectorAll("button[data-copy]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
        b.textContent = "Copied";
        setTimeout(() => (b.textContent = "Copy"), 1500);
      } catch (e) {
        /* ignore */
      }
    })
  );
  out.scrollIntoView({ behavior: "smooth", block: "start" });
}
