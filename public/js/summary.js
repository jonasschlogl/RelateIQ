// Conversation → therapist summary page. Fetches (or generates) the
// AI summary for the conversation named in ?id=, renders it, and wires up
// print/regenerate.

let summaryConvId = null;
let isGenerating = false;

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();

  const params = new URLSearchParams(window.location.search);
  summaryConvId = params.get("id");

  document.getElementById("print-btn")?.addEventListener("click", () => window.print());
  document.getElementById("regenerate-btn")?.addEventListener("click", () => loadSummary(true));

  if (!summaryConvId) {
    showError("No conversation was specified. Go back to chat and use “Export for therapist” from an open conversation.");
    return;
  }

  loadSummary(false);
});

async function loadSummary(regenerate) {
  if (isGenerating) return;
  isGenerating = true;

  const stateEl = document.getElementById("summary-state");
  const printBtn = document.getElementById("print-btn");
  const regenBtn = document.getElementById("regenerate-btn");
  if (printBtn) printBtn.style.display = "none";
  if (regenBtn) {
    regenBtn.style.display = "none";
    regenBtn.disabled = true;
  }
  stateEl.innerHTML = '<p class="summary-loading">' + (regenerate ? "Regenerating your summary…" : "Generating your summary — this can take a few seconds…") + "</p>";

  try {
    const res = await authFetch(`/api/conversations/${encodeURIComponent(summaryConvId)}/summary`, {
      method: "POST",
      body: JSON.stringify({ regenerate: !!regenerate }),
    });
    const data = await safeJson(res);

    if (!res.ok || !data.summary) {
      showError(data.error || "Couldn't generate a summary right now.");
      return;
    }

    renderSummary(data);
  } catch (err) {
    showError("Couldn't connect to the server.");
  } finally {
    isGenerating = false;
    if (regenBtn) regenBtn.disabled = false;
  }
}

function showError(message) {
  const stateEl = document.getElementById("summary-state");
  stateEl.innerHTML = `<div class="form-error">${escapeHtml(message)}</div>`;
}

function renderSummary(data) {
  const stateEl = document.getElementById("summary-state");
  const subtitle = document.getElementById("summary-subtitle");
  const printBtn = document.getElementById("print-btn");
  const regenBtn = document.getElementById("regenerate-btn");

  if (subtitle && data.conversationTitle) {
    subtitle.textContent = `"${data.conversationTitle}" — for sharing with a therapist or counselor`;
  }

  const when = data.generatedAt ? formatSummaryDate(data.generatedAt) : "";
  stateEl.innerHTML =
    `<p class="summary-generated-at">Generated ${escapeHtml(when)}</p>` + renderSummaryBody(data.summary);

  if (printBtn) printBtn.style.display = "inline-flex";
  if (regenBtn) regenBtn.style.display = "inline-flex";
}

function formatSummaryDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch (e) {
    return iso;
  }
}

// Turns the AI's plain-text summary (blank-line-separated blocks, dash
// bullets) into readable HTML without assuming fixed English section
// labels — the summary can come back in any language.
function renderSummaryBody(text) {
  const blocks = String(text || "")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const lines = block
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const bulletLines = lines.filter((l) => /^[-•]\s+/.test(l));
      const plainLines = lines.filter((l) => !/^[-•]\s+/.test(l));

      let html = "";
      if (plainLines.length) {
        const looksLikeHeading = plainLines[0].length <= 60 && (plainLines.length > 1 || bulletLines.length > 0);
        if (looksLikeHeading) {
          html += `<h3 class="summary-section">${escapeHtml(plainLines[0])}</h3>`;
          if (plainLines.length > 1) {
            html += `<p>${plainLines.slice(1).map(escapeHtml).join(" ")}</p>`;
          }
        } else {
          html += `<p>${plainLines.map(escapeHtml).join(" ")}</p>`;
        }
      }
      if (bulletLines.length) {
        html += "<ul>" + bulletLines.map((l) => `<li>${escapeHtml(l.replace(/^[-•]\s+/, ""))}</li>`).join("") + "</ul>";
      }
      return html;
    })
    .join("");
}
