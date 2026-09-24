document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();

  document.getElementById("logout-btn")?.addEventListener("click", logout);

  if (new URLSearchParams(window.location.search).get("upgraded") === "1") {
    showUpgradeBanner();
    window.history.replaceState({}, "", "dashboard.html");
  }

  try {
    const meRes = await authFetch("/api/me");
    const me = await safeJson(meRes);

    document.getElementById("profile-name").textContent = me.name || me.email;
    document.getElementById("profile-email").textContent = me.email;
    document.getElementById("profile-plan").textContent = planLabel(me.plan);
    document.getElementById("profile-since").textContent = formatDate(me.createdAt);

    if (me.plan === "free") {
      const usageBox = document.getElementById("usage-box");
      usageBox.style.display = "flex";
      document.getElementById("usage-count").textContent = `${me.usage?.count || 0} / ${me.usageLimit}`;
    }

    if (me.attachmentStyle) {
      document.getElementById("attachment-meta").style.display = "block";
      document.getElementById("attachment-badge").textContent = attachmentLabel(me.attachmentStyle);
    }

    renderBillingActions(me);
    wireEmailPreferences(me);

    if (me.isAdmin) {
      document.getElementById("nav-admin").style.display = "inline";
    }
  } catch (err) {
    console.error(err);
  }

  loadCheckin();
  loadReferrals();
  wirePushNotifications();

  try {
    const convRes = await authFetch("/api/conversations");
    const conversations = await safeJson(convRes);
    const list = document.getElementById("conversation-list");
    list.innerHTML = "";

    if (!Array.isArray(conversations) || conversations.length === 0) {
      list.innerHTML = '<p class="text-muted">You don\'t have any conversations yet. <a href="chat.html">Start your first chat</a>.</p>';
    } else {
      conversations.forEach((c) => {
        const row = document.createElement("div");
        row.className = "conversation-row";

        const a = document.createElement("a");
        a.href = "chat.html?c=" + encodeURIComponent(c.id);
        a.className = "conversation-row-link";
        const prefix = c.mode === "practice" ? "🎭 " : "";
        a.innerHTML = `<span>${prefix}${escapeHtml(c.title || "New conversation")}</span><span class="text-muted">${formatDate(c.updatedAt)}</span>`;
        row.appendChild(a);

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "conversation-row-delete";
        delBtn.setAttribute("aria-label", "Delete conversation");
        delBtn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m5 0V4a2 2 0 012-2h0a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
        delBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!confirm(`Delete "${c.title || "this conversation"}"? This can't be undone.`)) return;

          try {
            const res = await authFetch("/api/conversations/" + encodeURIComponent(c.id), { method: "DELETE" });
            if (!res.ok) {
              const data = await safeJson(res);
              alert(data.error || "Couldn't delete that conversation.");
              return;
            }
            row.remove();
            if (!list.querySelector(".conversation-row")) {
              list.innerHTML = '<p class="text-muted">You don\'t have any conversations yet. <a href="chat.html">Start your first chat</a>.</p>';
            }
          } catch (err) {
            console.error(err);
            alert("Couldn't connect to the server.");
          }
        });
        row.appendChild(delBtn);

        list.appendChild(row);
      });
    }
  } catch (err) {
    console.error(err);
  }
});

// ---------------------------------------------------------------------------
// Daily check-in — optional, never blocks anything else on this page
// ---------------------------------------------------------------------------

async function loadCheckin() {
  const card = document.getElementById("checkin-card");
  try {
    const res = await authFetch("/api/checkin/today");
    const data = await safeJson(res);
    if (!res.ok) {
      card.style.display = "none";
      return;
    }
    card.style.display = "block";
    renderCheckin(data);
  } catch (err) {
    console.error(err);
    card.style.display = "none";
  }
}

function renderCheckin(data) {
  const body = document.getElementById("checkin-body");
  const streakBadge = document.getElementById("streak-badge");
  if (streakBadge) {
    if (data.streak > 0) {
      streakBadge.style.display = "inline-flex";
      streakBadge.textContent = `🔥 ${data.streak} day${data.streak === 1 ? "" : "s"}`;
    } else {
      streakBadge.style.display = "none";
    }
  }

  if (data.answered) {
    const scoreLine = typeof data.score === "number" ? `<p class="checkin-score-done">Connection today: ${data.score}/10</p>` : "";
    body.innerHTML = `
      <p class="checkin-question">${escapeHtml(data.question)}</p>
      ${scoreLine}
      <p class="checkin-done">✓ You checked in today: "${escapeHtml(data.answer)}"</p>
    `;
    return;
  }

  if (data.skipped) {
    body.innerHTML = `
      <p class="checkin-question">${escapeHtml(data.question)}</p>
      <p class="checkin-done">Skipped for today — no pressure. <a href="#" id="checkin-undo-skip" style="text-decoration:underline;">Answer it instead</a></p>
    `;
    document.getElementById("checkin-undo-skip")?.addEventListener("click", (e) => {
      e.preventDefault();
      renderCheckinForm(data.question);
    });
    return;
  }

  renderCheckinForm(data.question);
}

function renderCheckinForm(question) {
  const body = document.getElementById("checkin-body");
  body.innerHTML = `
    <p class="checkin-question">${escapeHtml(question)}</p>
    <div class="checkin-score-row">
      <label for="checkin-score-input">How connected do you feel today?</label>
      <div class="checkin-score-slider-row">
        <input type="range" id="checkin-score-input" min="1" max="10" step="1" value="5" />
        <span class="checkin-score-value" id="checkin-score-value">5</span>
        <span class="text-muted" style="font-size:11.5px;">/10</span>
      </div>
    </div>
    <div class="checkin-answer">
      <textarea id="checkin-input" maxlength="2000" placeholder="Totally optional — write a sentence or two, or just skip."></textarea>
    </div>
    <div class="checkin-actions">
      <button class="btn btn-primary btn-sm" id="checkin-save-btn" type="button">Save</button>
      <button class="btn btn-ghost btn-sm" id="checkin-skip-btn" type="button">Skip today</button>
    </div>
  `;
  const scoreInput = document.getElementById("checkin-score-input");
  const scoreValue = document.getElementById("checkin-score-value");
  scoreInput.addEventListener("input", () => {
    scoreValue.textContent = scoreInput.value;
  });
  document.getElementById("checkin-save-btn").addEventListener("click", () => submitCheckin(false));
  document.getElementById("checkin-skip-btn").addEventListener("click", () => submitCheckin(true));
}

async function submitCheckin(skip) {
  const payload = {};
  if (skip) {
    payload.skip = true;
  } else {
    const val = document.getElementById("checkin-input").value.trim();
    if (!val) return;
    payload.answer = val;
    const scoreInput = document.getElementById("checkin-score-input");
    if (scoreInput) payload.score = Number(scoreInput.value);
  }

  try {
    const res = await authFetch("/api/checkin", { method: "POST", body: JSON.stringify(payload) });
    const data = await safeJson(res);
    if (!res.ok) return;
    renderCheckin(data);
  } catch (err) {
    console.error(err);
  }
}

// ---------------------------------------------------------------------------
// Billing — upgrade CTA for Free users, self-serve "Manage subscription"
// (Stripe's hosted portal) for paying ones.
// ---------------------------------------------------------------------------

function showUpgradeBanner() {
  const card = document.querySelector(".profile-card");
  if (!card) return;
  const banner = document.createElement("p");
  banner.className = "success-banner";
  banner.textContent = "🎉 You're upgraded! It may take a few seconds to show up below.";
  card.prepend(banner);
}

function renderBillingActions(me) {
  const box = document.getElementById("billing-actions");
  if (!box) return;

  if (me.plan === "free") {
    box.innerHTML = `
      <button class="btn btn-gradient" id="upgrade-btn" type="button">Upgrade to Pro</button>
      <a href="index.html#pricing" class="btn btn-ghost btn-sm" style="margin-left:8px;">See all plans</a>
    `;
    document.getElementById("upgrade-btn").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Redirecting to checkout…";
      startCheckout("pro").finally(() => {
        btn.disabled = false;
        btn.textContent = original;
      });
    });
  } else if (me.hasBilling) {
    box.innerHTML = `<button class="btn btn-ghost" id="manage-billing-btn" type="button">Manage subscription</button>`;
    document.getElementById("manage-billing-btn").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Opening billing…";
      openBillingPortal().finally(() => {
        btn.disabled = false;
        btn.textContent = original;
      });
    });
  }
}

// ---------------------------------------------------------------------------
// Email preferences
// ---------------------------------------------------------------------------

function wireEmailPreferences(me) {
  const checkinBox = document.getElementById("pref-checkin");
  const digestBox = document.getElementById("pref-digest");
  if (!checkinBox || !digestBox) return;

  checkinBox.checked = me.emailCheckinReminders !== false;

  // The automated weekly digest is a Pro+ perk (see server.js's
  // runWeeklyInsightsDigest) — a Free account never gets one sent
  // regardless of this checkbox, so show it locked with an upgrade hint
  // rather than letting someone opt into something that silently never
  // arrives.
  const isFree = me.plan === "free";
  digestBox.checked = !isFree && me.emailWeeklyDigest !== false;
  digestBox.disabled = isFree;

  if (isFree) {
    const digestLabel = digestBox.closest(".email-pref-toggle");
    if (digestLabel && !digestLabel.querySelector(".pref-upgrade-hint")) {
      const hint = document.createElement("a");
      hint.href = "index.html#pricing";
      hint.className = "pref-upgrade-hint";
      hint.textContent = "Pro feature — upgrade";
      digestLabel.appendChild(hint);
    }
  }

  async function save() {
    try {
      await authFetch("/api/me/email-preferences", {
        method: "POST",
        body: JSON.stringify({
          checkinReminders: checkinBox.checked,
          weeklyDigest: digestBox.checked,
        }),
      });
    } catch (err) {
      console.error(err);
    }
  }

  checkinBox.addEventListener("change", save);
  digestBox.addEventListener("change", save);
}

// ---------------------------------------------------------------------------
// Browser push notifications — progressive enhancement, same spirit as the
// mic buttons elsewhere: the button hides itself if the browser can't do
// push at all, and every failure path just leaves the toggle in its
// current state rather than breaking the rest of the page.
// ---------------------------------------------------------------------------

async function wirePushNotifications() {
  const btn = document.getElementById("push-toggle-btn");
  const status = document.getElementById("push-status");
  if (!btn) return;

  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    btn.style.display = "none";
    if (status) status.textContent = "Not supported in this browser.";
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    renderPushState(!!existing);

    btn.addEventListener("click", async () => {
      const reg2 = await navigator.serviceWorker.ready;
      const current = await reg2.pushManager.getSubscription();
      if (current) {
        await disablePush(current);
      } else {
        await enablePush(reg2);
      }
    });
  } catch (err) {
    console.error(err);
    if (status) status.textContent = "Couldn't check notification status.";
  }
}

function renderPushState(enabled) {
  const btn = document.getElementById("push-toggle-btn");
  const status = document.getElementById("push-status");
  if (!btn) return;
  if (enabled) {
    btn.textContent = "Disable notifications";
    if (status) status.textContent = "✓ Enabled on this browser";
  } else {
    btn.textContent = "Enable notifications";
    if (status) status.textContent = "";
  }
}

async function enablePush(reg) {
  const btn = document.getElementById("push-toggle-btn");
  const status = document.getElementById("push-status");
  btn.disabled = true;

  try {
    const keyRes = await fetch("/api/push/vapid-public-key");
    const keyData = await safeJson(keyRes);
    if (!keyData.publicKey) {
      status.textContent = "Notifications aren't set up on this server yet.";
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      status.textContent = "Notifications were blocked — allow them from your browser's site settings to enable.";
      return;
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
    });

    await authFetch("/api/push/subscribe", { method: "POST", body: JSON.stringify(subscription) });
    renderPushState(true);
  } catch (err) {
    console.error(err);
    status.textContent = "Couldn't enable notifications.";
  } finally {
    btn.disabled = false;
  }
}

async function disablePush(subscription) {
  const btn = document.getElementById("push-toggle-btn");
  btn.disabled = true;
  try {
    await authFetch("/api/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
    renderPushState(false);
  } catch (err) {
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Referrals — invite a friend, both get a free month when they subscribe
// ---------------------------------------------------------------------------

async function loadReferrals() {
  const linkText = document.getElementById("referral-link-text");
  const statsText = document.getElementById("referral-stats");
  const copyBtn = document.getElementById("copy-referral-btn");
  if (!linkText) return;

  try {
    const res = await authFetch("/api/referrals");
    const data = await safeJson(res);
    if (!res.ok) {
      linkText.textContent = data.error || "Couldn't load your invite link.";
      return;
    }

    linkText.textContent = data.link;

    if (data.referredCount > 0) {
      statsText.style.display = "block";
      statsText.textContent = `${data.referredCount} friend${data.referredCount === 1 ? "" : "s"} joined through your link · ${data.rewardedCount} free month${data.rewardedCount === 1 ? "" : "s"} earned`;
    }

    copyBtn?.addEventListener("click", () => {
      navigator.clipboard?.writeText(data.link).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy link"), 1500);
      });
    });
  } catch (err) {
    linkText.textContent = "Couldn't connect to the server.";
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function planLabel(plan) {
  return { free: "Free", pro: "Pro", premium: "Premium" }[plan] || "Free";
}

function attachmentLabel(style) {
  return { secure: "Secure", anxious: "Anxious", avoidant: "Avoidant", disorganized: "Disorganized" }[style] || style;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch (e) {
    return iso;
  }
}
