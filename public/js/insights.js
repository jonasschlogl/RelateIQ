// Insights page — fetches (or generates) recurring-pattern insights across
// the user's Coach Chat conversations and renders them. Mirrors summary.js's
// structure, but the API already returns structured patterns rather than a
// block of text to parse.

let isGeneratingInsights = false;

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  document.getElementById("regenerate-btn")?.addEventListener("click", () => loadInsights(true));
  loadInsights(false);
});

async function loadInsights(regenerate) {
  if (isGeneratingInsights) return;
  isGeneratingInsights = true;

  const stateEl = document.getElementById("insights-state");
  const regenBtn = document.getElementById("regenerate-btn");
  if (regenBtn) {
    regenBtn.style.display = "none";
    regenBtn.disabled = true;
  }
  stateEl.innerHTML =
    '<p class="summary-loading">' +
    (regenerate ? "Looking again across your conversations…" : "Looking for patterns across your conversations…") +
    "</p>";

  try {
    const res = await authFetch("/api/insights", {
      method: "POST",
      body: JSON.stringify({ regenerate: !!regenerate }),
    });
    const data = await safeJson(res);

    if (!res.ok) {
      showInsightsError(data.error || "Couldn't generate insights right now.");
      return;
    }

    if (data.notEnoughData) {
      renderNotEnoughData(data);
      return;
    }

    renderInsights(data);
  } catch (err) {
    showInsightsError("Couldn't connect to the server.");
  } finally {
    isGeneratingInsights = false;
    if (regenBtn) regenBtn.disabled = false;
  }
}

function showInsightsError(message) {
  const stateEl = document.getElementById("insights-state");
  stateEl.innerHTML = `<div class="form-error">${escapeHtml(message)}</div>`;
}

function renderNotEnoughData(data) {
  const stateEl = document.getElementById("insights-state");
  const have = data.conversationCount || 0;
  const need = data.needed || 3;
  stateEl.innerHTML =
    `<p>You've had ${have} Coach Chat conversation${have === 1 ? "" : "s"} so far. Once you've had at least ${need}, ` +
    `RelateIQ can start noticing patterns across them — recurring topics, things that keep coming back — instead of ` +
    `just responding to each one on its own.</p>` +
    `<p><a href="chat.html" class="btn btn-gradient">Start a Coach Chat conversation</a></p>`;
}

function renderInsights(data) {
  const stateEl = document.getElementById("insights-state");
  const subtitle = document.getElementById("insights-subtitle");
  const regenBtn = document.getElementById("regenerate-btn");

  if (subtitle && typeof data.conversationCount === "number") {
    subtitle.textContent = `Looking across your last ${data.conversationCount} Coach Chat conversation${data.conversationCount === 1 ? "" : "s"}`;
  }

  const when = data.generatedAt ? formatInsightsDate(data.generatedAt) : "";
  let html = when ? `<p class="summary-generated-at">Generated ${escapeHtml(when)}</p>` : "";

  const patterns = Array.isArray(data.patterns) ? data.patterns : [];
  if (patterns.length === 0) {
    html += "<p>Nothing stood out as a repeating pattern yet — that's a good sign, or it just means there isn't enough overlap between conversations yet. Check back after a few more.</p>";
  } else {
    patterns.forEach((p) => {
      html += `<h3 class="summary-section">${escapeHtml(p.title || "Pattern")}</h3>`;
      html += `<p>${escapeHtml(p.description || "")}</p>`;
    });
  }

  if (data.note) {
    html += `<p style="margin-top:20px; color: var(--text-muted);">${escapeHtml(data.note)}</p>`;
  }

  stateEl.innerHTML = html;

  if (regenBtn) regenBtn.style.display = "inline-flex";
}

function formatInsightsDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch (e) {
    return iso;
  }
}
