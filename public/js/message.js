// Message check: paste a text before sending it, see how it may land and get
// versions to send as they are. Plan differences are enforced on the server;
// this page just shows them (and the upgrade dialogs).

let mcState = { plan: "free", usage: null, partners: [] };
let mcBusy = false;

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  requireAuth();
  load();
});

async function load() {
  const el = document.getElementById("message-state");
  try {
    const res = await authFetch("/api/message-check");
    const data = await safeJson(res);
    if (!res.ok) {
      el.innerHTML = `<p class="text-muted" style="text-align:center;">${escapeHtml(data.error || "Couldn't load this page.")}</p>`;
      return;
    }
    mcState = { plan: data.plan, usage: data.usage, partners: data.partners || [] };
    renderForm();
  } catch (e) {
    el.innerHTML = '<p class="text-muted" style="text-align:center;">Couldn\'t connect to the server.</p>';
  }
}

function usageText() {
  const u = mcState.usage;
  if (!u) return "";
  const left = Math.max(0, u.limit - u.used);
  if (mcState.plan === "free") return `${left} of ${u.limit} free checks left`;
  if (mcState.plan === "pro") return `${left} of ${u.limit} checks left today`;
  return "";
}

function renderForm() {
  const el = document.getElementById("message-state");
  const premium = mcState.plan === "premium";
  const partnerField = premium
    ? mcState.partners.length
      ? `<label class="practice-setup-field-label" for="mc-partner">Who is it for? <span class="text-muted">(tailors the replies to them)</span></label>
         <select id="mc-partner"><option value="">Not specified</option>${mcState.partners.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("")}</select>`
      : `<p class="text-muted mc-note">Add a partner profile in Practice and your replies get tailored to them.</p>`
    : `<p class="text-muted mc-note"><span class="pb-lock">Premium</span> tailors the replies to the person and to what has worked for you before. <a href="#" id="mc-see-premium">See Premium</a></p>`;

  el.innerHTML = `
    <section class="dashboard-card mc-card">
      <label class="practice-setup-field-label" for="mc-draft">The message you're thinking of sending</label>
      <textarea id="mc-draft" rows="4" maxlength="1500" placeholder="e.g. You always do this. I'm tired of having to ask for everything."></textarea>
      <details class="mc-theirs">
        <summary>What did they write? <span class="text-muted">(optional, helps a lot)</span></summary>
        <textarea id="mc-theirs" rows="3" maxlength="1500" placeholder="Paste their message here"></textarea>
      </details>
      ${partnerField}
      <div class="form-error" id="mc-error" style="display:none;"></div>
      <div class="mc-actions">
        <button type="button" class="btn btn-gradient" id="mc-go">Check my message</button>
        <span class="text-muted mc-usage" id="mc-usage">${escapeHtml(usageText())}</span>
      </div>
    </section>
    <div id="mc-result"></div>`;

  document.getElementById("mc-go").addEventListener("click", runCheck);
  document.getElementById("mc-see-premium")?.addEventListener("click", (e) => {
    e.preventDefault();
    startCheckout("premium");
  });
}

function showError(msg) {
  const e = document.getElementById("mc-error");
  if (!e) return;
  e.textContent = msg || "";
  e.style.display = msg ? "block" : "none";
}

async function limitDialog(data) {
  const toPremium = mcState.plan === "pro";
  const go = await showAppConfirm(
    mcState.plan === "free"
      ? "You've used your 3 free message checks. Pro gives you 10 a day, with two rewrites each. Premium has no limit and tailors every reply to the person."
      : "You've used today's checks. They reset tomorrow, or Premium removes the limit and tailors every reply to the person.",
    { confirmLabel: toPremium ? "See Premium" : "Upgrade to Pro", cancelLabel: "Not now" }
  );
  if (go) startCheckout(toPremium ? "premium" : "pro");
}

async function runCheck() {
  if (mcBusy) return;
  const draft = document.getElementById("mc-draft").value.trim();
  if (draft.length < 3) {
    showError("Paste the message you're thinking of sending.");
    return;
  }
  showError("");
  mcBusy = true;
  const btn = document.getElementById("mc-go");
  btn.disabled = true;
  btn.textContent = "Reading it…";
  try {
    const res = await authFetch("/api/message-check", {
      method: "POST",
      body: JSON.stringify({
        draft,
        theirMessage: document.getElementById("mc-theirs").value.trim(),
        partnerProfileId: document.getElementById("mc-partner")?.value || null,
      }),
    });
    const data = await safeJson(res);
    if (data.usage) mcState.usage = data.usage;
    document.getElementById("mc-usage").textContent = usageText();
    if (!res.ok) {
      if (data.messageCheckLimit) {
        showError(data.error);
        await limitDialog(data);
      } else {
        showError(data.error || "Couldn't check that right now.");
      }
      return;
    }
    renderResult(data);
  } catch (e) {
    showError("Couldn't connect to the server.");
  } finally {
    mcBusy = false;
    btn.disabled = false;
    btn.textContent = "Check my message";
  }
}

const RISK_LABEL = { low: "Low risk", medium: "Could go wrong", high: "High risk" };

function renderResult(d) {
  const out = document.getElementById("mc-result");
  const flags = (d.flags || []).length ? `<ul class="mc-flags">${d.flags.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>` : "";
  const lockedCard =
    mcState.plan === "premium"
      ? ""
      : `<div class="mc-version mc-version-locked"><div class="mc-version-head"><strong>Warmer</strong><span class="pb-lock">Premium</span></div>
         <p class="text-muted">A third version in a softer tone, tailored to them. <a href="#" id="mc-unlock">See Premium</a></p></div>`;
  out.innerHTML = `
    <section class="dashboard-card mc-card mc-result-card">
      <div class="mc-read"><span class="mc-risk mc-risk-${escapeHtml(d.risk)}">${escapeHtml(RISK_LABEL[d.risk] || "")}</span>
        <p>${escapeHtml(d.read)}</p>${d.tailored ? '<p class="text-muted mc-tailored">Tailored to them and to what has worked for you.</p>' : ""}</div>
      ${flags}
      <h2 class="pb-h">Versions you can send</h2>
      <div class="mc-versions">
        ${d.versions
          .map(
            (v, i) => `<div class="mc-version"><div class="mc-version-head"><strong>${escapeHtml(v.label)}</strong><button type="button" class="btn btn-ghost btn-sm" data-i="${i}">Copy</button></div>
            <p>${escapeHtml(v.text)}</p></div>`
          )
          .join("")}
        ${lockedCard}
      </div>
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
  document.getElementById("mc-unlock")?.addEventListener("click", (e) => {
    e.preventDefault();
    startCheckout("premium");
  });
  out.scrollIntoView({ behavior: "smooth", block: "start" });
}
