// Public, read-only view of a share — what the partner sees. No auth, no
// requireAuth() call: this page must work for someone with no RelateIQ
// account at all.

document.addEventListener("DOMContentLoaded", loadSharedView);

async function loadSharedView() {
  const stateEl = document.getElementById("shared-state");
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");

  if (!token) {
    stateEl.innerHTML = '<div class="tool-header"><h1>Nothing to show</h1><p class="text-muted">This link is missing its share code.</p></div>';
    return;
  }

  try {
    const res = await fetch(`/api/public/shares/${encodeURIComponent(token)}`);
    const data = await safeJson(res);
    if (!res.ok) {
      stateEl.innerHTML = `<div class="tool-header"><h1>Link not available</h1><p class="text-muted">${escapeHtml(data.error || "This share link isn't available.")}</p></div>`;
      return;
    }
    renderShared(data);
  } catch (e) {
    stateEl.innerHTML = '<div class="tool-header"><h1>Something went wrong</h1><p class="text-muted">Couldn\'t load this right now. Please try again.</p></div>';
  }
}

function renderShared(data) {
  const stateEl = document.getElementById("shared-state");

  const itemsHtml = data.items.length
    ? data.items.map(
        (item) => `
      <div class="share-item-row share-item-row-readonly">
        <div class="share-item-body">
          <span class="share-item-type">${escapeHtml(itemTypeLabel(item.type))}</span>
          <p class="share-item-text">${escapeHtml(item.text)}</p>
        </div>
      </div>`
      ).join("")
    : '<p class="text-muted">Nothing has been added to this share yet.</p>';

  stateEl.innerHTML = `
    <div class="tool-header">
      <span class="section-tag">Shared with you</span>
      <h1>${escapeHtml(data.title)}</h1>
      <p class="text-muted">Someone using RelateIQ chose to share this with you directly — it's only what they picked, nothing pulled automatically from their conversations.</p>
    </div>
    <div class="share-items">${itemsHtml}</div>
  `;
}

function itemTypeLabel(type) {
  if (type === "message-rewrite") return "Message rewrite";
  if (type === "debrief") return "Practice takeaway";
  return "Note";
}
