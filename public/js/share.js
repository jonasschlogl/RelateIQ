// Share with partner — the user builds a link by hand, item by item.
// Nothing is ever pulled in automatically; every item is text the user
// explicitly wrote or pasted, added one at a time via addItem() below.

let currentShare = null;
let pendingItem = null;

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  document.getElementById("new-share-btn")?.addEventListener("click", createShare);
  document.getElementById("back-to-list-btn")?.addEventListener("click", showListView);
  document.getElementById("copy-link-btn")?.addEventListener("click", copyLink);
  document.getElementById("revoke-btn")?.addEventListener("click", toggleRevoke);
  document.getElementById("delete-share-btn")?.addEventListener("click", deleteShare);
  document.getElementById("add-item-btn")?.addEventListener("click", addItem);
  document.getElementById("share-title-input")?.addEventListener("change", saveTitle);
  document.getElementById("pick-conversation-btn")?.addEventListener("click", openConversationModal);

  try {
    const raw = sessionStorage.getItem("relateiq_pending_share_item");
    if (raw) {
      pendingItem = JSON.parse(raw);
      sessionStorage.removeItem("relateiq_pending_share_item");
    }
  } catch (e) {
    pendingItem = null;
  }

  loadShares();
});

async function loadShares() {
  const listEl = document.getElementById("share-list");
  listEl.innerHTML = '<p class="text-muted">Loading…</p>';
  try {
    const res = await authFetch("/api/shares");
    const data = await safeJson(res);
    if (!res.ok) {
      listEl.innerHTML = `<p class="text-muted">${escapeHtml(data.error || "Couldn't load your shares.")}</p>`;
      return;
    }
    renderList(data);
    if (pendingItem) showPendingBanner();
  } catch (e) {
    listEl.innerHTML = "<p class=\"text-muted\">Couldn't connect to the server.</p>";
  }
}

function renderList(shares) {
  const listEl = document.getElementById("share-list");
  document.querySelector(".share-pending-banner")?.remove();

  if (!shares.length) {
    listEl.innerHTML = "<p class=\"text-muted\">You haven't created a share yet. A share only ever contains things you add to it yourself.</p>";
    return;
  }

  listEl.innerHTML = "";
  shares.forEach((share) => {
    const card = document.createElement("div");
    card.className = "share-card";

    const main = document.createElement("div");
    main.className = "share-card-main";
    const h3 = document.createElement("h3");
    h3.textContent = share.title;
    const p = document.createElement("p");
    p.className = "text-muted";
    p.textContent = `${share.items.length} item${share.items.length === 1 ? "" : "s"}${share.revoked ? " · revoked" : ""}`;
    main.appendChild(h3);
    main.appendChild(p);

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "btn btn-ghost btn-sm";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", () => openDetail(share));

    card.appendChild(main);
    card.appendChild(openBtn);
    listEl.appendChild(card);
  });
}

function showPendingBanner() {
  const listEl = document.getElementById("share-list");
  const banner = document.createElement("div");
  banner.className = "share-pending-banner";
  banner.textContent = "You have something ready to share — open a share below (or create a new one) to add it.";
  listEl.parentElement.insertBefore(banner, listEl);
}

async function createShare() {
  try {
    const res = await authFetch("/api/shares", {
      method: "POST",
      body: JSON.stringify({ title: "Untitled share" }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      alert(data.error || "Couldn't create a share.");
      return;
    }
    openDetail(data);
  } catch (e) {
    alert("Couldn't connect to the server.");
  }
}

function showListView() {
  currentShare = null;
  document.getElementById("share-detail-view").style.display = "none";
  document.getElementById("share-list-view").style.display = "";
  loadShares();
}

function openDetail(share) {
  currentShare = share;
  document.getElementById("share-list-view").style.display = "none";
  document.getElementById("share-detail-view").style.display = "";
  document.getElementById("item-error").style.display = "none";
  renderDetail();

  if (pendingItem) {
    document.getElementById("item-text-input").value = pendingItem.text || "";
    document.getElementById("item-type-input").value = pendingItem.type || "note";
    pendingItem = null;
  }
}

function renderDetail() {
  const share = currentShare;
  document.getElementById("share-title-input").value = share.title;

  const url = `${window.location.origin}/partner-view.html?token=${share.token}`;
  document.getElementById("share-link-text").textContent = url;

  const revokeBtn = document.getElementById("revoke-btn");
  revokeBtn.textContent = share.revoked ? "Turn link back on" : "Revoke link";
  document.getElementById("share-revoked-note").style.display = share.revoked ? "block" : "none";

  const itemsEl = document.getElementById("share-items");
  if (!share.items.length) {
    itemsEl.innerHTML = '<p class="text-muted">Nothing added yet — use the box below.</p>';
    return;
  }

  itemsEl.innerHTML = "";
  share.items.slice().reverse().forEach((item) => {
    const row = document.createElement("div");
    row.className = "share-item-row";

    const body = document.createElement("div");
    body.className = "share-item-body";
    const type = document.createElement("span");
    type.className = "share-item-type";
    type.textContent = itemTypeLabel(item.type);
    body.appendChild(type);

    if (item.type === "conversation") {
      const count = Array.isArray(item.messages) ? item.messages.length : 0;
      const title = document.createElement("p");
      title.className = "share-item-text";
      title.textContent = `${item.text} (${count} message${count === 1 ? "" : "s"})`;
      body.appendChild(title);

      const transcriptWrap = document.createElement("div");
      transcriptWrap.style.display = "none";
      transcriptWrap.style.marginTop = "10px";
      transcriptWrap.innerHTML = renderTranscriptHtml(item.messages);

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "btn btn-ghost btn-sm";
      toggleBtn.style.marginTop = "8px";
      toggleBtn.textContent = "View transcript";
      toggleBtn.addEventListener("click", () => {
        const showing = transcriptWrap.style.display !== "none";
        transcriptWrap.style.display = showing ? "none" : "block";
        toggleBtn.textContent = showing ? "View transcript" : "Hide transcript";
      });

      body.appendChild(toggleBtn);
      body.appendChild(transcriptWrap);
    } else {
      const text = document.createElement("p");
      text.className = "share-item-text";
      text.textContent = item.text;
      body.appendChild(text);
    }

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "share-item-delete";
    delBtn.title = "Remove from share";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", () => deleteItem(item.id));

    row.appendChild(body);
    row.appendChild(delBtn);
    itemsEl.appendChild(row);
  });
}

function itemTypeLabel(type) {
  if (type === "message-rewrite") return "Message rewrite";
  if (type === "debrief") return "Practice takeaway";
  if (type === "conversation") return "Whole conversation";
  return "Note";
}

async function saveTitle() {
  if (!currentShare) return;
  const title = document.getElementById("share-title-input").value.trim();
  if (!title || title === currentShare.title) {
    document.getElementById("share-title-input").value = currentShare.title;
    return;
  }
  try {
    const res = await authFetch(`/api/shares/${currentShare.id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
    const data = await safeJson(res);
    if (res.ok) currentShare = data;
  } catch (e) {
    /* ignore — title just won't save this time */
  }
}

async function toggleRevoke() {
  if (!currentShare) return;
  try {
    const res = await authFetch(`/api/shares/${currentShare.id}`, {
      method: "PATCH",
      body: JSON.stringify({ revoked: !currentShare.revoked }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      alert(data.error || "Couldn't update that share.");
      return;
    }
    currentShare = data;
    renderDetail();
  } catch (e) {
    alert("Couldn't connect to the server.");
  }
}

async function deleteShare() {
  if (!currentShare) return;
  if (!confirm("Delete this share? The link will stop working immediately.")) return;
  try {
    const res = await authFetch(`/api/shares/${currentShare.id}`, { method: "DELETE" });
    if (res.ok) {
      showListView();
    } else {
      const data = await safeJson(res);
      alert(data.error || "Couldn't delete that share.");
    }
  } catch (e) {
    alert("Couldn't connect to the server.");
  }
}

async function copyLink() {
  if (!currentShare) return;
  const url = `${window.location.origin}/partner-view.html?token=${currentShare.token}`;
  const btn = document.getElementById("copy-link-btn");
  try {
    await navigator.clipboard.writeText(url);
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy link"), 1500);
  } catch (e) {
    alert("Couldn't copy automatically — select the link text above and copy it manually.");
  }
}

async function addItem() {
  if (!currentShare) return;
  const textEl = document.getElementById("item-text-input");
  const typeEl = document.getElementById("item-type-input");
  const errorEl = document.getElementById("item-error");
  const text = textEl.value.trim();

  errorEl.style.display = "none";
  if (!text) {
    errorEl.textContent = "Write something to add first.";
    errorEl.style.display = "block";
    return;
  }

  try {
    const res = await authFetch(`/api/shares/${currentShare.id}/items`, {
      method: "POST",
      body: JSON.stringify({ text, type: typeEl.value }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      errorEl.textContent = data.error || "Couldn't add that.";
      errorEl.style.display = "block";
      return;
    }
    currentShare = data;
    textEl.value = "";
    renderDetail();
  } catch (e) {
    errorEl.textContent = "Couldn't connect to the server.";
    errorEl.style.display = "block";
  }
}

async function deleteItem(itemId) {
  if (!currentShare) return;
  try {
    const res = await authFetch(`/api/shares/${currentShare.id}/items/${itemId}`, { method: "DELETE" });
    const data = await safeJson(res);
    if (res.ok) {
      currentShare = data;
      renderDetail();
    }
  } catch (e) {
    /* ignore */
  }
}

// --- "Share a whole conversation" modal ------------------------------------
// Three steps: pick a conversation -> preview its full transcript -> confirm.
// The confirm step only fires after the user has actually seen every
// message, since sharing a whole conversation is a much bigger disclosure
// than adding one hand-picked item.

function closeConversationModal() {
  document.getElementById("conversation-modal").style.display = "none";
}

function wireModalCancel() {
  document.getElementById("modal-cancel-btn")?.addEventListener("click", closeConversationModal);
}

async function openConversationModal() {
  const modal = document.getElementById("conversation-modal");
  const body = document.getElementById("conversation-modal-body");
  modal.style.display = "flex";
  body.innerHTML = '<p class="text-muted">Loading your conversations…</p>';

  try {
    const res = await authFetch("/api/conversations");
    const data = await safeJson(res);
    if (!res.ok) {
      body.innerHTML = `<p class="text-muted">${escapeHtml(data.error || "Couldn't load your conversations.")}</p><div class="modal-close-row"><button class="btn btn-ghost btn-sm" id="modal-cancel-btn" type="button">Close</button></div>`;
      wireModalCancel();
      return;
    }
    renderConversationList(data);
  } catch (e) {
    body.innerHTML = '<p class="text-muted">Couldn\'t connect to the server.</p>';
  }
}

function renderConversationList(conversations) {
  const body = document.getElementById("conversation-modal-body");

  if (!conversations.length) {
    body.innerHTML =
      '<h2>Choose a conversation</h2><p class="text-muted">You don\'t have any conversations yet.</p><div class="modal-close-row"><button class="btn btn-ghost btn-sm" id="modal-cancel-btn" type="button">Close</button></div>';
    wireModalCancel();
    return;
  }

  const rowsHtml = conversations
    .map(
      (c) => `
      <div class="conversation-pick-row" data-id="${escapeHtml(c.id)}">
        <div>
          <div>${escapeHtml(c.title || "Conversation")}</div>
          <div class="conversation-pick-meta">${c.mode === "practice" ? "Practice" : "Coach"} · ${formatShareDate(c.updatedAt)}</div>
        </div>
        <span class="text-muted">Preview →</span>
      </div>`
    )
    .join("");

  body.innerHTML = `
    <h2>Choose a conversation</h2>
    <p class="text-muted">Pick one to preview the whole thing before sharing it.</p>
    <div class="conversation-pick-list">${rowsHtml}</div>
    <div class="modal-close-row"><button class="btn btn-ghost btn-sm" id="modal-cancel-btn" type="button">Cancel</button></div>
  `;
  wireModalCancel();

  body.querySelectorAll(".conversation-pick-row").forEach((row) => {
    row.addEventListener("click", () => previewConversation(row.getAttribute("data-id")));
  });
}

async function previewConversation(conversationId) {
  const body = document.getElementById("conversation-modal-body");
  body.innerHTML = '<p class="text-muted">Loading conversation…</p>';
  try {
    const res = await authFetch(`/api/conversations/${conversationId}`);
    const data = await safeJson(res);
    if (!res.ok) {
      body.innerHTML = `<p class="text-muted">${escapeHtml(data.error || "Couldn't load that conversation.")}</p><div class="modal-close-row"><button class="btn btn-ghost btn-sm" id="modal-cancel-btn" type="button">Close</button></div>`;
      wireModalCancel();
      return;
    }
    renderConversationPreview(data);
  } catch (e) {
    body.innerHTML = '<p class="text-muted">Couldn\'t connect to the server.</p>';
  }
}

function renderConversationPreview(conv) {
  const body = document.getElementById("conversation-modal-body");
  body.innerHTML = `
    <h2>${escapeHtml(conv.title || "Conversation")}</h2>
    <div class="share-conversation-warning">Everything below will be visible to anyone with the share link — check it over before sharing.</div>
    ${renderTranscriptHtml(conv.messages)}
    <div class="modal-close-row">
      <button class="btn btn-ghost btn-sm" id="modal-back-btn" type="button">← Back</button>
      <button class="btn btn-gradient btn-sm" id="modal-confirm-btn" type="button">Share this conversation</button>
    </div>
  `;
  document.getElementById("modal-back-btn")?.addEventListener("click", openConversationModal);
  document.getElementById("modal-confirm-btn")?.addEventListener("click", () => confirmShareConversation(conv.id));
}

async function confirmShareConversation(conversationId) {
  if (!currentShare) return;
  const confirmBtn = document.getElementById("modal-confirm-btn");
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Sharing…";
  }
  try {
    const res = await authFetch(`/api/shares/${currentShare.id}/items/from-conversation`, {
      method: "POST",
      body: JSON.stringify({ conversationId }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      alert(data.error || "Couldn't add that conversation.");
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Share this conversation";
      }
      return;
    }
    currentShare = data;
    closeConversationModal();
    renderDetail();
  } catch (e) {
    alert("Couldn't connect to the server.");
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Share this conversation";
    }
  }
}

function formatShareDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch (e) {
    return "";
  }
}
