// Admin/growth dashboard. Server already enforces access (adminMiddleware on
// /api/admin/stats) — this file just fetches and renders. Anyone who isn't
// an admin gets a plain "Not authorized" message, never the stats.

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  loadAdminStats();
  window.addEventListener("resize", debounceResize);
});

let lastStats = null;
let resizeTimer = null;
function debounceResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (lastStats) renderAdmin(lastStats);
  }, 200);
}

async function loadAdminStats() {
  const stateEl = document.getElementById("admin-state");
  try {
    const res = await authFetch("/api/admin/stats");
    const data = await safeJson(res);
    if (!res.ok) {
      stateEl.innerHTML = `<p class="text-muted">${escapeHtml(data.error || "Not authorized.")}</p>`;
      return;
    }
    lastStats = data;
    renderAdmin(data);
  } catch (err) {
    stateEl.innerHTML = '<p class="text-muted">Couldn\'t connect to the server.</p>';
  }
}

function renderAdmin(data) {
  const stateEl = document.getElementById("admin-state");
  stateEl.innerHTML = `
    <div class="stat-grid">
      ${statTile("Total users", data.totalUsers)}
      ${statTile("New this week", data.newThisWeek, `${data.newToday} today`)}
      ${statTile("Paying", data.payingCount, `${Math.round(data.conversionRate * 1000) / 10}% conversion`)}
      ${statTile("Active this week", data.activeThisWeek)}
    </div>
    <div class="dashboard-card" style="margin-top:20px;">
      <div class="dashboard-card-header"><h2 style="font-size:16px;">Signups &middot; last 30 days</h2></div>
      <div id="signups-chart" class="admin-chart"></div>
    </div>
    <div class="dashboard-card" style="margin-top:20px;">
      <div class="dashboard-card-header"><h2 style="font-size:16px;">Plan breakdown</h2></div>
      <div id="plan-breakdown"></div>
    </div>
    <div class="stat-grid" style="margin-top:20px;">
      ${statTile("Conversations", data.conversationsTotal, `${data.coachConvos} coach &middot; ${data.practiceConvos} practice`)}
      ${statTile("Shares created", data.sharesTotal, `${data.shareItemsTotal} items total`)}
      ${statTile("Referred signups", data.referredTotal, `${data.referredRewarded} rewarded`)}
      ${statTile("Push subscribers", data.pushSubCount)}
    </div>
  `;
  renderSignupsChart(document.getElementById("signups-chart"), data.signupsByDay);
  renderPlanBreakdown(document.getElementById("plan-breakdown"), data.planCounts);
}

function statTile(label, value, sub) {
  return `<div class="stat-tile">
    <div class="stat-tile-value">${value}</div>
    <div class="stat-tile-label">${label}</div>
    ${sub ? `<div class="stat-tile-sub">${sub}</div>` : ""}
  </div>`;
}

function renderSignupsChart(container, dataIn) {
  const data = Array.isArray(dataIn) ? dataIn : [];
  if (!data.length) {
    container.innerHTML = '<p class="text-muted">No data yet.</p>';
    return;
  }
  const width = container.clientWidth || 600;
  const height = 160;
  const padding = { top: 16, right: 8, bottom: 24, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = Math.max(1, ...data.map((d) => d.count));
  const barGap = 3;
  const barWidth = Math.max(2, innerW / data.length - barGap);
  const bars = data
    .map((d, i) => {
      const x = padding.left + i * (innerW / data.length);
      const h = (d.count / max) * innerH;
      const y = padding.top + (innerH - h);
      return `<rect class="chart-bar" data-date="${escapeHtml(d.date)}" data-count="${d.count}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}" rx="2" fill="var(--accent-1)" />`;
    })
    .join("");
  const firstLabel = data[0]?.date.slice(5);
  const midLabel = data[Math.floor(data.length / 2)]?.date.slice(5);
  const lastLabel = data[data.length - 1]?.date.slice(5);
  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="admin-chart-svg" role="img" aria-label="Signups over the last 30 days">
      <line x1="${padding.left}" y1="${padding.top + innerH}" x2="${width - padding.right}" y2="${padding.top + innerH}" class="chart-baseline" />
      ${bars}
      <text x="${padding.left}" y="${height - 6}" class="chart-axis-label">${firstLabel}</text>
      <text x="${width / 2}" y="${height - 6}" text-anchor="middle" class="chart-axis-label">${midLabel}</text>
      <text x="${width - padding.right}" y="${height - 6}" text-anchor="end" class="chart-axis-label">${lastLabel}</text>
    </svg>
    <div class="chart-tooltip" id="signups-tooltip" style="display:none;"></div>
  `;
  const svg = container.querySelector("svg");
  const tooltip = container.querySelector("#signups-tooltip");
  svg.querySelectorAll(".chart-bar").forEach((rect) => {
    rect.addEventListener("mouseenter", () => {
      const date = rect.getAttribute("data-date");
      const count = rect.getAttribute("data-count");
      tooltip.textContent = `${date}: ${count} signup${count === "1" ? "" : "s"}`;
      tooltip.style.display = "block";
      positionTooltip(tooltip, rect, container);
    });
    rect.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
  });
}

function positionTooltip(tooltip, rect, container) {
  const rectBox = rect.getBoundingClientRect();
  const containerBox = container.getBoundingClientRect();
  tooltip.style.left = `${rectBox.left - containerBox.left + rectBox.width / 2}px`;
  tooltip.style.top = `${rectBox.top - containerBox.top - 8}px`;
}

function renderPlanBreakdown(container, planCountsIn) {
  const planCounts = planCountsIn || {};
  const entries = [
    { key: "free", label: "Free", color: "var(--text-faint)" },
    { key: "pro", label: "Pro", color: "var(--accent-1)" },
    { key: "premium", label: "Premium", color: "var(--accent-2)" },
  ];
  const max = Math.max(1, ...entries.map((e) => planCounts[e.key] || 0));
  container.innerHTML = entries
    .map((e) => {
      const count = planCounts[e.key] || 0;
      const pct = Math.round((count / max) * 100);
      return `<div class="plan-bar-row">
        <span class="plan-bar-label">${e.label}</span>
        <div class="plan-bar-track"><div class="plan-bar-fill" style="width:${pct}%; background:${e.color};"></div></div>
        <span class="plan-bar-count">${count}</span>
      </div>`;
    })
    .join("");
}
