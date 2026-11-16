// Try Message check without an account. One or two free checks per day, then a
// friendly nudge to create an account. Nothing is stored on the server.

let tryRemaining = null;
let tryBusy = false;
let tryDidCheck = false;

document.addEventListener("DOMContentLoaded", async () => {
  trackEvent("try_view", "try");
  try {
    const res = await fetch("/api/public/message-check");
    const d = await res.json();
    tryRemaining = typeof d.remaining === "number" ? d.remaining : null;
  } catch (e) {
    /* show the form anyway */
  }
  renderForm();
  document.getElementById("nav-signup")?.addEventListener("click", () => trackEvent("try_cta_click", "nav"));
});

function leftText() {
  if (tryRemaining === null) return "";
  if (tryRemaining <= 0) return "No free checks left today";
  return tryRemaining === 1 ? "1 free check left today" : tryRemaining + " free checks left today";
}

function gateHtml(msg) {
  return `<section class="dashboard-card mc-card" style="text-align:center;">
      <h2 class="pb-h">${escapeHtml(msg || "That's your free checks for today")}</h2>
      <p class="text-muted">Create a free account (no card) to keep checking messages, save what you try, and get replies that fit you.</p>
      <a class="btn btn-gradient" href="register.html?src=try" id="gate-cta">Create free account</a>
    </section>`;
}

function renderForm() {
  const el = document.getElementById("try-state");
  if (tryRemaining !== null && tryRemaining <= 0) {
    el.innerHTML = gateHtml();
    document.getElementById("gate-cta")?.addEventListener("click", () => trackEvent("try_cta_click", "gate"));
    return;
  }
  el.innerHTML = `
    <section class="dashboard-card mc-card">
      <label class="practice-setup-field-label" for="mc-draft">The message you're thinking of sending</label>
      <textarea id="mc-draft" rows="4" maxlength="800" placeholder="e.g. You always do this. I'm tired of having to ask for everything."></textarea>
      <div class="form-error" id="mc-error" style="display:none;"></div>
      <div class="mc-actions">
        <button type="button" class="btn btn-gradient" id="mc-go">Check my message</button>
        <span class="text-muted mc-usage" id="mc-usage">${escapeHtml(leftText())}</span>
      </div>
    </section>
    <div id="mc-result"></div>`;
  document.getElementById("mc-go").addEventListener("click", runCheck);
}

function showError(msg) {
  const e = document.getElementById("mc-error");
  if (!e) return;
  e.textContent = msg || "";
  e.style.display = msg ? "block" : "none";
}

async function runCheck() {
  if (tryBusy) return;
  const draft = document.getElementById("mc-draft").value.trim();
  if (draft.length < 3) return showError("Paste the message you're thinking of sending.");
  showError("");
  tryBusy = true;
  const btn = document.getElementById("mc-go");
  btn.disabled = true;
  btn.textContent = "Reading it…";
  try {
    const res = await fetch("/api/public/message-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft, anonId: getAnonId() }),
    });
    const d = await res.json().catch(() => ({}));
    if (typeof d.remaining === "number") tryRemaining = d.remaining;
    if (!res.ok) {
      if (d.needAccount) {
        document.getElementById("try-state").insertAdjacentHTML("beforeend", gateHtml(d.error));
        document.getElementById("gate-cta")?.addEventListener("click", () => trackEvent("try_cta_click", "gate"));
      }
      showError(d.error || "Couldn't check that right now.");
      return;
    }
    tryDidCheck = true;
    document.getElementById("mc-usage").textContent = leftText();
    renderResult(d);
  } catch (e) {
    showError("Couldn't connect to the server.");
  } finally {
    tryBusy = false;
    btn.disabled = false;
    btn.textContent = "Check my message";
  }
}

const RISK_LABEL = { low: "Low risk", medium: "Could go wrong", high: "High risk" };

function renderResult(d) {
  const out = document.getElementById("mc-result");
  const flags = (d.flags || []).length ? `<ul class="mc-flags">${d.flags.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>` : "";
  out.innerHTML = `
    <section class="dashboard-card mc-card mc-result-card">
      <div class="mc-read"><span class="mc-risk mc-risk-${escapeHtml(d.risk)}">${escapeHtml(RISK_LABEL[d.risk] || "")}</span>
        <p>${escapeHtml(d.read)}</p></div>
      ${flags}
      <h2 class="pb-h">Versions you can send</h2>
      <div class="mc-versions">
        ${d.versions
          .map(
            (v, i) => `<div class="mc-version"><div class="mc-version-head"><strong>${escapeHtml(v.label)}</strong><button type="button" class="btn btn-ghost btn-sm" data-i="${i}">Copy</button></div>
            <p>${escapeHtml(v.text)}</p></div>`
          )
          .join("")}
        <div class="mc-version mc-version-locked"><div class="mc-version-head"><strong>Tailored to them</strong><span class="pb-lock">Free account</span></div>
          <p class="text-muted">Add who it is for and get a version in their language, that fits how they react.</p></div>
      </div>
    </section>
    <section class="dashboard-card mc-card" style="text-align:center;">
      <h2 class="pb-h">Want this every time, tailored to your partner?</h2>
      <p class="text-muted">Create a free account (no card): more checks, a coach that remembers your story, and a place to rehearse the hard talk.</p>
      <a class="btn btn-gradient" href="register.html?src=try" id="after-cta">Create free account</a>
    </section>`;
  out.querySelectorAll("button[data-i]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(d.versions[Number(b.dataset.i)].text);
        b.textContent = "Copied";
        setTimeout(() => (b.textContent = "Copy"), 1500);
      } catch (e) {
        /* ignore */
      }
    })
  );
  document.getElementById("after-cta")?.addEventListener("click", () => trackEvent("try_cta_click", "after"));
  out.scrollIntoView({ behavior: "smooth", block: "start" });
}
