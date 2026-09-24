// Insights page — fetches (or generates) recurring-pattern insights across
// the user's Coach Chat conversations and renders them. Mirrors summary.js's
// structure, but the API already returns structured patterns rather than a
// block of text to parse.

let isGeneratingInsights = false;

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  document.getElementById("regenerate-btn")?.addEventListener("click", () => loadInsights(true));
  loadInsights(false);
  loadTrend();
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

// ---------------------------------------------------------------------------
// Connection-score trend chart — a self-reported 1-10 number from the daily
// check-in, plotted over time. Not AI-generated: a single sequential metric,
// so a plain 2px line in the app's own accent color, with a hover
// crosshair/tooltip and a "View as list" fallback so every value is reachable
// without hovering (screen readers, keyboard-only, touch).
// ---------------------------------------------------------------------------

async function loadTrend() {
  try {
    const res = await authFetch("/api/checkin/history");
    const data = await safeJson(res);
    if (!res.ok) return;

    const entries = Array.isArray(data.entries) ? data.entries : [];
    if (entries.length < 2) return; // not enough points for a trend to mean anything

    document.getElementById("trend-section").style.display = "block";
    renderTrendChart(entries);
  } catch (err) {
    // Silent failure — the trend chart is a bonus on top of the AI patterns
    // below, not something worth showing an error state for on its own.
    console.error(err);
  }
}

function renderTrendChart(entries) {
  const area = document.getElementById("trend-chart-area");
  const width = 640;
  const height = 200;
  const padLeft = 34;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 28;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const times = entries.map((e) => new Date(e.date + "T00:00:00").getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const spanT = Math.max(1, maxT - minT);

  const xFor = (t) => padLeft + ((t - minT) / spanT) * plotW;
  const yFor = (score) => padTop + (1 - (score - 1) / 9) * plotH; // score range 1-10

  const points = entries.map((e, i) => ({ x: xFor(times[i]), y: yFor(e.score), date: e.date, score: e.score }));

  // Recessive horizontal gridlines at 2/4/6/8/10, with muted axis labels.
  const gridScores = [2, 4, 6, 8, 10];
  const gridLines = gridScores
    .map((s) => {
      const y = yFor(s);
      return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="var(--border)" stroke-width="1" />
              <text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--text-faint)">${s}</text>`;
    })
    .join("");

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${padTop + plotH} L${points[0].x.toFixed(1)},${padTop + plotH} Z`;

  const markers = points
    .map(
      (p, i) =>
        `<circle class="trend-point" data-i="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="var(--accent-1)" stroke="var(--surface)" stroke-width="2" />`
    )
    .join("");

  const last = points[points.length - 1];
  const lastLabel = `<text x="${last.x.toFixed(1)}" y="${(last.y - 12).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--text)">${last.score}</text>`;

  area.innerHTML = `
    <div class="trend-chart-wrap" style="position:relative;">
      <svg viewBox="0 0 ${width} ${height}" style="width:100%; height:auto; display:block;" id="trend-svg" aria-hidden="true">
        ${gridLines}
        <path d="${areaPath}" fill="var(--accent-1)" opacity="0.10" stroke="none" />
        <path d="${linePath}" fill="none" stroke="var(--accent-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        <line id="trend-crosshair" x1="0" y1="${padTop}" x2="0" y2="${padTop + plotH}" stroke="var(--text-faint)" stroke-width="1" opacity="0" />
        ${markers}
        ${lastLabel}
      </svg>
      <div id="trend-tooltip" class="trend-tooltip" style="display:none;"></div>
    </div>
    <button class="btn btn-ghost btn-sm" id="trend-list-toggle" type="button" style="margin-top:10px;">View as list</button>
    <div id="trend-list" class="trend-list" style="display:none;"></div>
  `;

  wireTrendHover(points);

  document.getElementById("trend-list-toggle").addEventListener("click", () => {
    const listEl = document.getElementById("trend-list");
    const svgWrap = area.querySelector(".trend-chart-wrap");
    const showingList = listEl.style.display !== "none";
    listEl.style.display = showingList ? "none" : "block";
    svgWrap.style.display = showingList ? "block" : "none";
    document.getElementById("trend-list-toggle").textContent = showingList ? "View as list" : "View as chart";
    if (!showingList && !listEl.dataset.filled) {
      listEl.innerHTML = entries
        .slice()
        .reverse()
        .map((e) => `<div class="trend-list-row"><span>${escapeHtml(formatShortDate(e.date))}</span><span>${e.score}/10</span></div>`)
        .join("");
      listEl.dataset.filled = "1";
    }
  });
}

function wireTrendHover(points) {
  const svg = document.getElementById("trend-svg");
  const tooltip = document.getElementById("trend-tooltip");
  const crosshair = document.getElementById("trend-crosshair");
  if (!svg || !tooltip || !crosshair) return;

  svg.addEventListener("mousemove", (e) => {
    const rect = svg.getBoundingClientRect();
    const scaleX = 640 / rect.width;
    const localX = (e.clientX - rect.left) * scaleX;

    let nearest = points[0];
    let bestDist = Infinity;
    points.forEach((p) => {
      const d = Math.abs(p.x - localX);
      if (d < bestDist) {
        bestDist = d;
        nearest = p;
      }
    });

    crosshair.setAttribute("x1", nearest.x);
    crosshair.setAttribute("x2", nearest.x);
    crosshair.setAttribute("opacity", "1");

    tooltip.style.display = "block";
    tooltip.style.left = `${(nearest.x / 640) * 100}%`;
    tooltip.innerHTML = `<strong>${nearest.score}/10</strong><span>${escapeHtml(formatShortDate(nearest.date))}</span>`;
  });

  svg.addEventListener("mouseleave", () => {
    crosshair.setAttribute("opacity", "0");
    tooltip.style.display = "none";
  });
}

function formatShortDate(dateKey) {
  try {
    const d = new Date(dateKey + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch (e) {
    return dateKey;
  }
}
