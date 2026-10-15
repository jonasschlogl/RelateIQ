// Therapist pack (Premium): a one-page "story so far" built from the user's
// whole history, meant to be printed or saved as PDF and handed to a
// therapist. Numbers come from real data; the AI writes the words.

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  document.getElementById("print-btn")?.addEventListener("click", () => window.print());
  document.getElementById("regenerate-btn")?.addEventListener("click", () => build(true));
  requireAuth();
  load();
});

async function load() {
  const el = document.getElementById("pack-state");
  try {
    const res = await authFetch("/api/pack");
    const data = await safeJson(res);
    if (!res.ok) {
      el.innerHTML = `<p>${escapeHtml(data.error || "Couldn't load your pack.")}</p>`;
      return;
    }
    if (data.locked) {
      document.querySelector(".summary-paper").style.display = "none";
      const holder = document.createElement("div");
      document.querySelector(".summary-shell").appendChild(holder);
      renderPremiumLock(holder, {
        title: "Your whole story, on one page",
        text: "Premium turns everything you've shared into a briefing a therapist can read in five minutes.",
        bullets: [
          "Background, recurring patterns and what's weighing on you now",
          "What you tried that helped, and what didn't",
          "Your connection scores over time, with real numbers",
          "Questions to bring to your first session",
          "Printable, or save as PDF. Only you decide who sees it",
        ],
      });
      return;
    }
    if (data.pack) {
      renderPack(data.pack);
    } else {
      renderIntro();
    }
  } catch (e) {
    el.innerHTML = "<p>Couldn't connect to the server.</p>";
  }
}

function renderIntro(message) {
  const el = document.getElementById("pack-state");
  el.innerHTML = `
    ${message ? `<p>${escapeHtml(message)}</p>` : ""}
    <p>This pulls everything you've shared with RelationshipAI into one clear page you can give to a therapist or counselor, so you don't have to start from zero in the first session.</p>
    <p><button type="button" class="btn btn-gradient" id="pack-build">Prepare my pack</button></p>`;
  el.querySelector("#pack-build").addEventListener("click", (e) => {
    e.target.disabled = true;
    e.target.textContent = "Preparing…";
    build(false);
  });
}

async function build(regenerate) {
  const el = document.getElementById("pack-state");
  if (regenerate) el.innerHTML = '<p class="summary-loading">Updating your pack, this can take a few seconds…</p>';
  try {
    const res = await authFetch("/api/pack", { method: "POST", body: JSON.stringify({ regenerate: !!regenerate }) });
    const data = await safeJson(res);
    if (!res.ok) {
      await showAppAlert(data.error || "Couldn't prepare the pack.");
      load();
      return;
    }
    if (data.notEnoughData) {
      renderIntro("There isn't enough to work with yet. Use the Coach a few more times, answer some check-ins or try a couple of Playbook experiments, then come back.");
      return;
    }
    renderPack(data);
  } catch (e) {
    await showAppAlert("Couldn't connect to the server.");
    load();
  }
}

function listHtml(items) {
  return `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
}

function renderPack(p) {
  const el = document.getElementById("pack-state");
  const n = p.numbers || {};
  const date = new Date(p.generatedAt || Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  document.getElementById("pack-subtitle").textContent = `Prepared ${date}`;

  const facts = [];
  if (n.conversations) facts.push(`${n.conversations} Coach Chat conversation${n.conversations === 1 ? "" : "s"}${n.since ? " since " + (new Date(n.since).toString() !== "Invalid Date" ? new Date(n.since).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : n.since) : ""}`);
  if (n.checkinDays) facts.push(`${n.checkinDays} daily check-in${n.checkinDays === 1 ? "" : "s"}`);
  if (n.averageScore != null) {
    const t = n.trend === "up" ? ", rising recently" : n.trend === "down" ? ", lower recently" : n.trend === "steady" ? ", steady" : "";
    facts.push(`self-rated connection averages ${n.averageScore}/10${t}`);
  }
  if (n.experimentsTried) facts.push(`${n.experimentsWorked || 0} of ${n.experimentsTried} small experiments helped`);

  let html = "";
  if (facts.length) html += `<p class="pack-facts">${facts.map(escapeHtml).join(" · ")}</p>`;
  if (p.overview) html += `<h3 class="summary-section">Overview</h3><p>${escapeHtml(p.overview)}</p>`;
  if (p.background) html += `<h3 class="summary-section">Background</h3><p>${escapeHtml(p.background)}</p>`;
  if (p.patterns && p.patterns.length) {
    html += `<h3 class="summary-section">Patterns they describe</h3>` + p.patterns.map((x) => `<p><strong>${escapeHtml(x.title)}.</strong> ${escapeHtml(x.description)}</p>`).join("");
  }
  if (p.currentConcerns && p.currentConcerns.length) html += `<h3 class="summary-section">What's weighing on them now</h3>${listHtml(p.currentConcerns)}`;
  if (p.whatHelped && p.whatHelped.length) html += `<h3 class="summary-section">What has helped</h3>${listHtml(p.whatHelped)}`;
  if (p.whatDidntHelp && p.whatDidntHelp.length) html += `<h3 class="summary-section">What hasn't helped</h3>${listHtml(p.whatDidntHelp)}`;
  if (p.questionsForTherapist && p.questionsForTherapist.length) html += `<h3 class="summary-section">Questions to bring</h3>${listHtml(p.questionsForTherapist)}`;
  el.innerHTML = html;

  document.getElementById("print-btn").style.display = "";
  document.getElementById("regenerate-btn").style.display = "";
}
