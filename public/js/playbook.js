// Playbook page: small experiments from Coach advice. Three simple groups —
// "Trying now", "What worked", "Didn't help" — plus a Premium read-out.

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  requireAuth();
  load();
  loadFocus();
  loadIdeas();
});

// Ideas for this week (Pro: 3; Premium: 5, tailored, refreshable; Free: teaser).
async function loadIdeas(refresh) {
  const el = document.getElementById("ideas-card");
  if (!el) return;
  try {
    const res = refresh ? await authFetch("/api/ideas/refresh", { method: "POST", body: "{}" }) : await authFetch("/api/ideas");
    const d = await safeJson(res);
    if (!res.ok) {
      if (refresh) await showAppAlert(d.error || "Couldn't find new ideas right now.");
      return;
    }
    if (d.locked) {
      el.innerHTML = `<section class="dashboard-card focus-card focus-locked">
        <span class="section-tag">Ideas for this week <span class="pb-lock">Pro</span></span>
        <p class="text-muted">Small gestures and simple dates to try this week, a fresh set every Monday.</p>
        <button type="button" class="btn btn-gradient btn-sm" id="ideas-upgrade">See Pro</button></section>`;
      document.getElementById("ideas-upgrade").addEventListener("click", () => startCheckout("pro"));
      return;
    }
    el.innerHTML = `<section class="dashboard-card focus-card">
      <span class="section-tag">Ideas for this week${d.forName ? ` · for ${escapeHtml(d.forName)}` : ""}</span>
      <div class="ideas-list">${d.ideas
        .map(
          (i, n) => `<div class="mc-version"><div class="mc-version-head"><strong>${escapeHtml(i.title)}</strong><span class="text-muted ideas-effort">${escapeHtml(i.effort)}</span></div>
          <p>${escapeHtml(i.how)}</p><button type="button" class="btn btn-ghost btn-sm" data-n="${n}">Add to my Playbook</button></div>`
        )
        .join("")}</div>
      ${
        d.canRefresh
          ? '<div class="focus-actions"><button type="button" class="btn btn-ghost btn-sm" id="ideas-refresh">Show me different ideas</button></div>'
          : '<p class="text-muted focus-teaser"><span class="pb-lock">Premium</span> gives you 5 ideas tailored to them, and new ones whenever you want. <a href="#" id="ideas-see-premium">See Premium</a></p>'
      }
    </section>`;
    el.querySelectorAll("button[data-n]").forEach((b) =>
      b.addEventListener("click", async () => {
        const i = d.ideas[Number(b.dataset.n)];
        b.disabled = true;
        try {
          const r = await authFetch("/api/playbook", { method: "POST", body: JSON.stringify({ text: `${i.title}: ${i.how}` }) });
          const out = await safeJson(r);
          b.textContent = r.ok ? "Added" : out.error || "Couldn't add";
          if (r.ok) load();
          else b.disabled = false;
        } catch (e) {
          b.disabled = false;
        }
      })
    );
    document.getElementById("ideas-refresh")?.addEventListener("click", (e) => {
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = "Looking…";
      loadIdeas(true);
    });
    document.getElementById("ideas-see-premium")?.addEventListener("click", (e) => {
      e.preventDefault();
      startCheckout("premium");
    });
  } catch (e) {
    /* ignore */
  }
}

// This week's focus (Pro: the sentence; Premium: also why, when and a recap
// of last week; Free: a teaser).
async function loadFocus() {
  const el = document.getElementById("focus-card");
  if (!el) return;
  try {
    const res = await authFetch("/api/focus");
    const d = await safeJson(res);
    if (!res.ok) return; // stay quiet: the Playbook itself still works
    if (d.locked) {
      el.innerHTML = `<section class="dashboard-card focus-card focus-locked">
        <span class="section-tag">This week's focus <span class="pb-lock">Pro</span></span>
        <p class="text-muted">Every week, one small thing to focus on, picked from how your days have gone and what has worked for you.</p>
        <button type="button" class="btn btn-gradient btn-sm" id="focus-upgrade">See Pro</button></section>`;
      document.getElementById("focus-upgrade").addEventListener("click", () => startCheckout("pro"));
      return;
    }
    const recap = d.recap
      ? `<p class="text-muted focus-recap">Last week${d.recap.headline ? `: "${escapeHtml(d.recap.headline)}"` : ""}${
          d.recap.worked || d.recap.didntHelp ? ` · ${d.recap.worked} worked, ${d.recap.didntHelp} didn't help` : ""
        }</p>`
      : "";
    el.innerHTML = `<section class="dashboard-card focus-card">
      <span class="section-tag">This week's focus</span>
      <h2 class="focus-headline">${escapeHtml(d.headline)}</h2>
      ${d.why ? `<p class="text-muted">${escapeHtml(d.why)}</p>` : ""}
      ${d.when ? `<p class="focus-when"><strong>When:</strong> ${escapeHtml(d.when)}</p>` : ""}
      ${recap}
      <div class="focus-actions"><button type="button" class="btn btn-primary btn-sm" id="focus-try">Add to my Playbook</button>
        <span class="text-muted focus-msg" id="focus-msg"></span></div>
      ${d.plan === "pro" ? `<p class="text-muted focus-teaser"><span class="pb-lock">Premium</span> adds why it fits you, the best moment to try it, and a recap of last week. <a href="#" id="focus-see-premium">See Premium</a></p>` : ""}
    </section>`;
    document.getElementById("focus-see-premium")?.addEventListener("click", (e) => {
      e.preventDefault();
      startCheckout("premium");
    });
    document.getElementById("focus-try").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const msg = document.getElementById("focus-msg");
      try {
        const r = await authFetch("/api/playbook", { method: "POST", body: JSON.stringify({ text: d.headline }) });
        const out = await safeJson(r);
        if (!r.ok) {
          msg.textContent = out.error || "Couldn't add that.";
          btn.disabled = false;
          return;
        }
        msg.textContent = out.already ? "Already in your Playbook." : "Added. I'll check in with you in two days.";
        load();
      } catch (err) {
        msg.textContent = "Couldn't connect to the server.";
        btn.disabled = false;
      }
    });
  } catch (e) {
    /* ignore */
  }
}

const RESULT_LABELS = {
  worked: "It worked",
  didnt_help: "Didn't help",
  not_tried: "Didn't get to it",
};

async function load() {
  const el = document.getElementById("playbook-state");
  try {
    const res = await authFetch("/api/playbook");
    const data = await safeJson(res);
    if (!res.ok) {
      el.innerHTML = `<p class="text-muted" style="text-align:center;">${escapeHtml(data.error || "Couldn't load your playbook.")}</p>`;
      return;
    }
    render(data);
  } catch (e) {
    el.innerHTML = '<p class="text-muted" style="text-align:center;">Couldn\'t connect to the server.</p>';
  }
}

function render(d) {
  const el = document.getElementById("playbook-state");
  el.innerHTML = "";
  const total = d.active.length + d.worked.length + d.didntHelp.length + d.notTried.length + d.hiddenCount;

  if (total === 0) {
    el.innerHTML = `
      <section class="dashboard-card pb-empty">
        <img class="empty-mascot" src="img/wisp-candle.svg" alt="" width="72" height="96" />
        <h3>Nothing here yet</h3>
        <p class="text-muted">Next time the Coach gives you something small to try, tap <strong>I'll try it</strong> under its reply and it will show up here.</p>
        <a class="btn btn-primary" href="chat.html">Talk to the Coach</a>
      </section>`;
    return;
  }

  el.appendChild(sectionActive(d));
  if (d.worked.length) el.appendChild(sectionList("What worked", "worked", d.worked, "pb-good"));
  if (d.didntHelp.length) el.appendChild(sectionList("Didn't help", "didnt_help", d.didntHelp, "pb-bad"));
  if (d.notTried.length) el.appendChild(sectionList("Didn't get to", "not_tried", d.notTried, "pb-skip"));
  if (d.hiddenCount > 0) el.appendChild(hiddenNotice(d));
  el.appendChild(sectionPremium(d));
}

function sectionActive(d) {
  const sec = document.createElement("section");
  sec.className = "dashboard-card pb-section";
  sec.innerHTML = `<h2 class="pb-h">Trying now</h2>`;
  if (!d.active.length) {
    sec.insertAdjacentHTML(
      "beforeend",
      `<p class="text-muted pb-none">Nothing in progress. Ask the Coach for your next small step.</p>
       <a class="btn btn-ghost btn-sm" href="chat.html">Open Coach</a>`
    );
    return sec;
  }
  d.active.forEach((e) => sec.appendChild(activeCard(e)));
  if (d.plan === "free") {
    sec.insertAdjacentHTML(
      "beforeend",
      `<p class="pb-note">Free plan: one experiment at a time. <a href="#" id="pb-upgrade-1">Pro lets you try several at once.</a></p>`
    );
    sec.querySelector("#pb-upgrade-1").addEventListener("click", (ev) => {
      ev.preventDefault();
      startCheckout("pro");
    });
  }
  return sec;
}

function activeCard(e) {
  const card = document.createElement("div");
  card.className = "pb-card";
  const when = daysAgo(e.createdAt);
  card.innerHTML = `
    <p class="pb-text">${escapeHtml(e.text)}</p>
    <p class="pb-meta">Started ${when}</p>
    <p class="pb-ask">How did it go?</p>
    <div class="pb-choices">
      <button type="button" class="pb-choice" data-r="worked">It worked</button>
      <button type="button" class="pb-choice" data-r="didnt_help">Didn't help</button>
      <button type="button" class="pb-choice" data-r="not_tried">Didn't get to it</button>
    </div>
    <div class="pb-note-box" style="display:none;">
      <textarea maxlength="500" rows="2" placeholder="Anything to remember? (optional)"></textarea>
      <div class="pb-note-actions">
        <button type="button" class="btn btn-primary btn-sm pb-save">Save</button>
        <button type="button" class="btn btn-ghost btn-sm pb-remove">Remove this</button>
      </div>
    </div>`;
  let picked = null;
  const box = card.querySelector(".pb-note-box");
  card.querySelectorAll(".pb-choice").forEach((b) =>
    b.addEventListener("click", () => {
      picked = b.dataset.r;
      card.querySelectorAll(".pb-choice").forEach((x) => x.classList.toggle("is-picked", x === b));
      box.style.display = "block";
    })
  );
  card.querySelector(".pb-save").addEventListener("click", async (ev) => {
    ev.target.disabled = true;
    const res = await authFetch(`/api/playbook/${e.id}/result`, {
      method: "POST",
      body: JSON.stringify({ result: picked, note: card.querySelector("textarea").value }),
    });
    if (res.ok) load();
    else {
      ev.target.disabled = false;
      const data = await safeJson(res);
      showAppAlert(data.error || "Couldn't save that.");
    }
  });
  card.querySelector(".pb-remove").addEventListener("click", async () => {
    if (!(await showAppConfirm("Remove this experiment?"))) return;
    await authFetch(`/api/playbook/${e.id}`, { method: "DELETE" });
    load();
  });
  return card;
}

function sectionList(title, key, items, cls) {
  const sec = document.createElement("section");
  sec.className = "dashboard-card pb-section " + cls;
  sec.innerHTML = `<h2 class="pb-h">${escapeHtml(title)} <span class="pb-count">${items.length}</span></h2>`;
  items.forEach((e) => {
    const row = document.createElement("div");
    row.className = "pb-row";
    row.innerHTML = `
      <span class="pb-dot" aria-hidden="true"></span>
      <div class="pb-row-main">
        <p class="pb-text">${escapeHtml(e.text)}</p>
        ${e.note ? `<p class="pb-meta">${escapeHtml(e.note)}</p>` : ""}
      </div>
      <button type="button" class="pb-x" aria-label="Remove" title="Remove">×</button>`;
    row.querySelector(".pb-x").addEventListener("click", async () => {
      if (!(await showAppConfirm("Remove this from your playbook?"))) return;
      await authFetch(`/api/playbook/${e.id}`, { method: "DELETE" });
      load();
    });
    sec.appendChild(row);
  });
  return sec;
}

function hiddenNotice(d) {
  const div = document.createElement("div");
  div.className = "pb-hidden";
  div.innerHTML = `<span>${d.hiddenCount} older result${d.hiddenCount === 1 ? "" : "s"} saved. The free plan shows the last ${d.historyDays} days.</span> <a href="#">Unlock with Pro</a>`;
  div.querySelector("a").addEventListener("click", (ev) => {
    ev.preventDefault();
    startCheckout("pro");
  });
  return div;
}

function sectionPremium(d) {
  const sec = document.createElement("section");
  sec.className = "dashboard-card pb-section pb-premium";
  if (d.plan === "premium") {
    sec.innerHTML = `
      <h2 class="pb-h">What your playbook says</h2>
      <p class="text-muted pb-none">${d.totalResolved >= 3 ? "A short read of what keeps working for you and what to try next." : "Finish 3 experiments and I can read the pattern for you."}</p>
      <div id="pb-summary"></div>
      <button type="button" class="btn btn-primary btn-sm" id="pb-summary-btn" ${d.totalResolved >= 3 ? "" : "disabled"}>Read my playbook</button>`;
    sec.querySelector("#pb-summary-btn").addEventListener("click", async (ev) => {
      const btn = ev.target;
      btn.disabled = true;
      btn.textContent = "Reading…";
      const out = sec.querySelector("#pb-summary");
      try {
        const res = await authFetch("/api/playbook/summary", { method: "POST" });
        const data = await safeJson(res);
        out.innerHTML = `<p class="pb-summary-text">${escapeHtml(res.ok ? data.summary : data.error || "Couldn't read it right now.")}</p>`;
      } catch (e) {
        out.innerHTML = '<p class="pb-summary-text">Couldn\'t connect to the server.</p>';
      }
      btn.disabled = false;
      btn.textContent = "Read it again";
    });
  } else {
    sec.innerHTML = `
      <h2 class="pb-h">What your playbook says <span class="pb-lock">Premium</span></h2>
      <p class="text-muted pb-none">Premium reads your whole playbook and tells you what keeps working for you, what doesn't, and what to try next.</p>
      <button type="button" class="btn btn-ghost btn-sm" id="pb-premium-btn">See Premium</button>`;
    sec.querySelector("#pb-premium-btn").addEventListener("click", () => startCheckout("premium"));
  }
  return sec;
}

function daysAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
