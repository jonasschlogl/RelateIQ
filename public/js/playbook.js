// Playbook page: small experiments from Coach advice. Three simple groups —
// "Trying now", "What worked", "Didn't help" — plus a Premium read-out.

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  requireAuth();
  load();
});

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
