// Hard talk (Premium): describe a conversation you're dreading, get a calm
// plan, rehearse it in Practice, then record how the real one went.

let talkState = { talks: [], partners: [], openId: null };

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  requireAuth();
  load();
});

async function load() {
  const el = document.getElementById("talk-state");
  try {
    const res = await authFetch("/api/talks");
    const data = await safeJson(res);
    if (!res.ok) {
      el.innerHTML = `<p class="text-muted" style="text-align:center;">${escapeHtml(data.error || "Couldn't load this page.")}</p>`;
      return;
    }
    if (data.locked) {
      document.querySelector(".pb-steps")?.remove();
      renderPremiumLock(el, {
        title: "Plan it before you say it",
        text: "Premium turns a conversation you're dreading into a plan you can walk in with.",
        bullets: [
          "A ready first sentence, in your own voice, with no blame",
          "The 3 or 4 things to get across, in order",
          "What to avoid, and how they might react",
          "One tap to rehearse it in Practice, then a score for how ready you are",
        ],
      });
      return;
    }
    talkState.talks = data.talks;
    try {
      const pr = await authFetch("/api/partners");
      talkState.partners = pr.ok ? await safeJson(pr) : [];
    } catch (e) {
      talkState.partners = [];
    }
    const wanted = new URLSearchParams(location.search).get("t");
    talkState.openId = wanted && data.talks.some((t) => t.id === wanted) ? wanted : null;
    render();
  } catch (e) {
    el.innerHTML = '<p class="text-muted" style="text-align:center;">Couldn\'t connect to the server.</p>';
  }
}

function render() {
  const el = document.getElementById("talk-state");
  el.innerHTML = "";
  const open = talkState.talks.find((t) => t.id === talkState.openId);
  if (open) {
    document.querySelector(".pb-steps")?.classList.add("is-hidden");
    el.appendChild(renderPlan(open));
    return;
  }
  document.querySelector(".pb-steps")?.classList.remove("is-hidden");
  el.appendChild(renderForm());
  if (talkState.talks.length) el.appendChild(renderList());
}

function renderForm() {
  const sec = document.createElement("section");
  sec.className = "dashboard-card pb-section";
  const partnerOptions = talkState.partners.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("");
  sec.innerHTML = `
    <h2 class="pb-h">Plan a new talk</h2>
    <div class="talk-field">
      <label for="talk-who">Who is it with?</label>
      <select id="talk-who">${partnerOptions}<option value="">Someone else</option></select>
      <input type="text" id="talk-name" maxlength="60" placeholder="Their name or role (e.g. Sam, my mother)" style="display:none;" />
    </div>
    <div class="talk-field">
      <label for="talk-topic">What do you need to talk about?</label>
      <textarea id="talk-topic" rows="3" maxlength="600" placeholder="e.g. I feel like I'm always the one planning things and I'm starting to resent it."></textarea>
    </div>
    <div class="talk-field">
      <label for="talk-hope">What do you hope happens? <span class="talk-opt">optional</span></label>
      <textarea id="talk-hope" rows="2" maxlength="400" placeholder="e.g. We split things more evenly, without a fight."></textarea>
    </div>
    <div class="talk-field">
      <label for="talk-fear">What are you afraid will happen? <span class="talk-opt">optional</span></label>
      <textarea id="talk-fear" rows="2" maxlength="400" placeholder="e.g. They'll get defensive and shut down."></textarea>
    </div>
    <div class="form-error" id="talk-error" style="display:none;"></div>
    <button type="button" class="btn btn-primary" id="talk-build">Build my plan</button>`;
  const who = sec.querySelector("#talk-who");
  const name = sec.querySelector("#talk-name");
  const sync = () => {
    name.style.display = who.value === "" ? "block" : "none";
  };
  who.addEventListener("change", sync);
  sync();
  sec.querySelector("#talk-build").addEventListener("click", async (ev) => {
    const btn = ev.target;
    const err = sec.querySelector("#talk-error");
    err.style.display = "none";
    const topic = sec.querySelector("#talk-topic").value.trim();
    if (topic.length < 8) {
      err.textContent = "Tell me a bit more about what you need to talk about.";
      err.style.display = "block";
      return;
    }
    btn.disabled = true;
    btn.textContent = "Building your plan…";
    try {
      const res = await authFetch("/api/talks", {
        method: "POST",
        body: JSON.stringify({
          partnerProfileId: who.value || null,
          withName: name.value.trim(),
          topic,
          hope: sec.querySelector("#talk-hope").value.trim(),
          fear: sec.querySelector("#talk-fear").value.trim(),
        }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        err.textContent = data.error || "Couldn't build a plan.";
        err.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Build my plan";
        return;
      }
      talkState.talks.unshift(data);
      talkState.openId = data.id;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      err.textContent = "Couldn't connect to the server.";
      err.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Build my plan";
    }
  });
  return sec;
}

const OUTCOME_LABEL = { went_well: "Went well", mixed: "Mixed", didnt_go_well: "Didn't go well", not_yet: "Not yet" };

function renderList() {
  const sec = document.createElement("section");
  sec.className = "dashboard-card pb-section";
  sec.innerHTML = `<h2 class="pb-h">Your plans <span class="pb-count">${talkState.talks.length}</span></h2>`;
  talkState.talks.forEach((t) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "talk-row";
    const status = t.status === "done" ? OUTCOME_LABEL[t.outcome] || "Done" : "Planned";
    row.innerHTML = `<span class="talk-row-main"><strong>${escapeHtml(t.title)}</strong><span class="pb-meta">With ${escapeHtml(t.inputs?.withName || "them")}</span></span><span class="talk-status talk-${t.status === "done" ? t.outcome : "planned"}">${escapeHtml(status)}</span>`;
    row.addEventListener("click", () => {
      talkState.openId = t.id;
      render();
      window.scrollTo({ top: 0 });
    });
    sec.appendChild(row);
  });
  return sec;
}

function pbList(items, cls) {
  if (!items || !items.length) return "";
  return `<ul class="rv-list ${cls || ""}">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
}

function renderPlan(t) {
  const p = t.plan || {};
  const wrap = document.createElement("div");

  const head = document.createElement("section");
  head.className = "dashboard-card pb-section";
  head.innerHTML = `
    <button type="button" class="talk-back" id="talk-back">← All plans</button>
    <p class="rv-month">Talk with ${escapeHtml(t.inputs?.withName || "them")}</p>
    <h2 class="rv-headline">${escapeHtml(t.title)}</h2>
    ${p.summary ? `<p class="text-muted">${escapeHtml(p.summary)}</p>` : ""}
    ${p.goal ? `<div class="rv-next"><span>Your goal</span><p>${escapeHtml(p.goal)}</p></div>` : ""}`;
  wrap.appendChild(head);
  head.querySelector("#talk-back").addEventListener("click", () => {
    talkState.openId = null;
    render();
  });

  const plan = document.createElement("section");
  plan.className = "dashboard-card pb-section";
  let html = "";
  if (p.bestTime) html += `<h3 class="rv-h">When to bring it up</h3><p>${escapeHtml(p.bestTime)}</p>`;
  if (p.opening) html += `<h3 class="rv-h">Start with this</h3><blockquote class="talk-quote" id="talk-opening">${escapeHtml(p.opening)}</blockquote><button type="button" class="btn btn-ghost btn-sm" id="talk-copy">Copy</button>`;
  if (p.keyPoints && p.keyPoints.length) html += `<h3 class="rv-h">Get these across</h3><ol class="talk-points">${p.keyPoints.map((k) => `<li>${escapeHtml(k)}</li>`).join("")}</ol>`;
  if (p.avoid && p.avoid.length) html += `<h3 class="rv-h">Steer clear of</h3>${pbList(p.avoid, "rv-bad")}`;
  if (p.reactions && p.reactions.length) {
    html += `<h3 class="rv-h">How they might react</h3>` + p.reactions.map((r) => `<div class="talk-reaction"><strong>${escapeHtml(r.reaction)}</strong><p>${escapeHtml(r.respond)}</p></div>`).join("");
  }
  if (p.ifHeated) html += `<h3 class="rv-h">If it gets heated</h3><p>${escapeHtml(p.ifHeated)}</p>`;
  if (p.afterwards) html += `<h3 class="rv-h">Afterwards</h3><p>${escapeHtml(p.afterwards)}</p>`;
  plan.innerHTML = html;
  plan.querySelector("#talk-copy")?.addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText(p.opening);
      e.target.textContent = "Copied";
      setTimeout(() => (e.target.textContent = "Copy"), 1500);
    } catch (err) {
      /* ignore */
    }
  });
  wrap.appendChild(plan);

  wrap.appendChild(renderRehearse(t));
  wrap.appendChild(renderOutcome(t));
  return wrap;
}

function renderRehearse(t) {
  const sec = document.createElement("section");
  sec.className = "dashboard-card pb-section";
  sec.innerHTML = `<h2 class="pb-h">Rehearse it</h2>`;
  const partnerId = t.inputs?.partnerProfileId;
  if (t.conversationId) {
    sec.insertAdjacentHTML("beforeend", `<p class="text-muted pb-none">You've started a rehearsal for this one.</p><a class="btn btn-ghost btn-sm" href="chat.html?c=${encodeURIComponent(t.conversationId)}">Open your rehearsal</a> `);
  }
  if (!partnerId) {
    sec.insertAdjacentHTML("beforeend", `<p class="text-muted pb-none">${t.conversationId ? "Want another go? " : ""}To rehearse, Practice needs a profile for this person. It takes a minute to set up.</p><a class="btn btn-primary btn-sm" href="chat.html?mode=practice">Set up Practice</a>`);
    return sec;
  }
  sec.insertAdjacentHTML(
    "beforeend",
    `<p class="text-muted pb-none">${t.conversationId ? "Another round: " : ""}Practice it with ${escapeHtml(t.inputs.withName)}'s AI stand-in, get feedback and a readiness score.</p>
     <div class="talk-modes" role="group" aria-label="Difficulty">
       <button type="button" class="pb-choice is-picked" data-i="realistic">Realistic</button>
       <button type="button" class="pb-choice" data-i="tough">Hard</button>
     </div>
     <button type="button" class="btn btn-primary btn-sm" id="talk-rehearse">Start rehearsal</button>`
  );
  let intensity = "realistic";
  sec.querySelectorAll(".talk-modes .pb-choice").forEach((b) =>
    b.addEventListener("click", () => {
      intensity = b.dataset.i;
      sec.querySelectorAll(".talk-modes .pb-choice").forEach((x) => x.classList.toggle("is-picked", x === b));
    })
  );
  sec.querySelector("#talk-rehearse").addEventListener("click", async (ev) => {
    const btn = ev.target;
    btn.disabled = true;
    btn.textContent = "Starting…";
    try {
      const res = await authFetch("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ mode: "practice", partnerProfileId: partnerId, scenario: t.title.slice(0, 300), intensity, roleSwap: false }),
      });
      const conv = await safeJson(res);
      if (!res.ok) {
        await showAppAlert(conv.error || "Couldn't start the rehearsal.");
        btn.disabled = false;
        btn.textContent = "Start rehearsal";
        return;
      }
      await authFetch(`/api/talks/${t.id}/link`, { method: "POST", body: JSON.stringify({ conversationId: conv.id }) });
      window.location.href = "chat.html?c=" + encodeURIComponent(conv.id);
    } catch (e) {
      await showAppAlert("Couldn't connect to the server.");
      btn.disabled = false;
      btn.textContent = "Start rehearsal";
    }
  });
  return sec;
}

function renderOutcome(t) {
  const sec = document.createElement("section");
  sec.className = "dashboard-card pb-section";
  const done = t.status === "done";
  sec.innerHTML = `<h2 class="pb-h">${done ? "How it went" : "After the real talk"}</h2>
    ${done ? `<p><span class="talk-status talk-${t.outcome}">${escapeHtml(OUTCOME_LABEL[t.outcome])}</span></p>${t.outcomeNote ? `<p class="text-muted">${escapeHtml(t.outcomeNote)}</p>` : ""}` : `<p class="text-muted pb-none">Come back and tell us how it went. It helps the Coach learn what works for you.</p>`}
    <div class="pb-choices">
      ${["went_well", "mixed", "didnt_go_well", "not_yet"].map((o) => `<button type="button" class="pb-choice${t.outcome === o ? " is-picked" : ""}" data-o="${o}">${OUTCOME_LABEL[o]}</button>`).join("")}
    </div>
    <div class="pb-note-box" style="display:none;">
      <textarea maxlength="500" rows="2" placeholder="Anything to remember? (optional)"></textarea>
      <div class="pb-note-actions"><button type="button" class="btn btn-primary btn-sm pb-save">Save</button></div>
    </div>
    <p style="margin-top:18px;"><button type="button" class="btn btn-ghost btn-sm" id="talk-delete">Delete this plan</button></p>`;
  let picked = null;
  const box = sec.querySelector(".pb-note-box");
  sec.querySelectorAll(".pb-choice").forEach((b) =>
    b.addEventListener("click", () => {
      picked = b.dataset.o;
      sec.querySelectorAll(".pb-choice").forEach((x) => x.classList.toggle("is-picked", x === b));
      box.style.display = "block";
    })
  );
  sec.querySelector(".pb-save").addEventListener("click", async (ev) => {
    ev.target.disabled = true;
    const res = await authFetch(`/api/talks/${t.id}/outcome`, {
      method: "POST",
      body: JSON.stringify({ outcome: picked, note: sec.querySelector("textarea").value }),
    });
    const data = await safeJson(res);
    if (res.ok) {
      talkState.talks = talkState.talks.map((x) => (x.id === t.id ? data : x));
      render();
    } else {
      ev.target.disabled = false;
      showAppAlert(data.error || "Couldn't save that.");
    }
  });
  sec.querySelector("#talk-delete").addEventListener("click", async () => {
    if (!(await showAppConfirm("Delete this plan?", { danger: true, confirmLabel: "Delete" }))) return;
    await authFetch(`/api/talks/${t.id}`, { method: "DELETE" });
    talkState.talks = talkState.talks.filter((x) => x.id !== t.id);
    talkState.openId = null;
    render();
  });
  return sec;
}
