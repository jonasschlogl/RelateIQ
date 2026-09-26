let isRewriting = false;

document.addEventListener("DOMContentLoaded", () => {
  requireAuth();
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  document.getElementById("rewrite-btn")?.addEventListener("click", rewrite);
  wireVoiceInput(document.getElementById("draft-mic-btn"), document.getElementById("draft-input"));
  loadPartnersForPicker();
});

// Populates the "Who is this for?" picker from the user's Partner Practice
// profiles, so a message-coach request can be personalized (see
// buildPartnerContextBlock in server.js). Stays hidden entirely for a user
// with no partner profiles yet, rather than showing an empty/pointless
// dropdown.
async function loadPartnersForPicker() {
  const select = document.getElementById("partner-select");
  if (!select) return;
  try {
    const res = await authFetch("/api/partners");
    const partners = await safeJson(res);
    if (!res.ok || !Array.isArray(partners) || partners.length === 0) return;

    partners.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
    select.style.display = "block";
  } catch (err) {
    // Quietly leave the picker hidden — this is a nice-to-have, not
    // something worth surfacing an error for.
  }
}

async function rewrite() {
  if (isRewriting) return;

  const draft = document.getElementById("draft-input").value.trim();
  const context = document.getElementById("context-input").value.trim();
  const partnerProfileId = document.getElementById("partner-select")?.value || undefined;
  const errorBox = document.getElementById("form-error");
  const resultBox = document.getElementById("result");
  const btn = document.getElementById("rewrite-btn");

  errorBox.style.display = "none";

  if (!draft) {
    errorBox.textContent = "Paste a message first.";
    errorBox.style.display = "block";
    return;
  }

  isRewriting = true;
  btn.disabled = true;
  btn.textContent = "Rewriting…";
  resultBox.innerHTML = '<span class="placeholder">Thinking about the best way to say this…</span>';

  try {
    const res = await authFetch("/api/message-coach", {
      method: "POST",
      body: JSON.stringify({ draft, context, partnerProfileId }),
    });
    const data = await safeJson(res);

    if (!res.ok || !data.rewrite) {
      resultBox.innerHTML = '<span class="placeholder">Nothing here yet.</span>';
      errorBox.textContent = data.error || "Something went wrong. Please try again.";
      errorBox.style.display = "block";
      return;
    }

    resultBox.innerHTML = "";

    const rewriteEl = document.createElement("div");
    rewriteEl.className = "coach-rewrite";
    rewriteEl.textContent = data.rewrite;
    resultBox.appendChild(rewriteEl);

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn btn-ghost btn-sm coach-copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard?.writeText(data.rewrite).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
      });
    });
    resultBox.appendChild(copyBtn);

    const shareBtn = document.createElement("button");
    shareBtn.type = "button";
    shareBtn.className = "btn btn-ghost btn-sm coach-copy-btn";
    shareBtn.textContent = "Share with partner";
    shareBtn.addEventListener("click", () => {
      try {
        sessionStorage.setItem(
          "relateiq_pending_share_item",
          JSON.stringify({ type: "message-rewrite", text: data.rewrite })
        );
      } catch (e) {
        /* ignore storage errors */
      }
      window.location.href = "share.html";
    });
    resultBox.appendChild(shareBtn);

    if (data.why) {
      const whyLabel = document.createElement("div");
      whyLabel.className = "coach-why-label";
      whyLabel.textContent = "Why this works better";
      resultBox.appendChild(whyLabel);

      const whyEl = document.createElement("p");
      whyEl.className = "coach-why";
      whyEl.textContent = data.why;
      resultBox.appendChild(whyEl);
    }

    // The bigger-picture strategic note (see the "insight" field in
    // MESSAGE_COACH_SYSTEM_PROMPT, server.js) — real advice about the
    // situation, not just about the wording, shown as its own section so
    // it doesn't blur together with "why this works better" above.
    if (data.insight) {
      const insightLabel = document.createElement("div");
      insightLabel.className = "coach-why-label";
      insightLabel.textContent = "What's really going on";
      resultBox.appendChild(insightLabel);

      const insightEl = document.createElement("p");
      insightEl.className = "coach-why";
      insightEl.textContent = data.insight;
      resultBox.appendChild(insightEl);
    }

    // Fixed, hand-checked resources — see safetyBlockFor() in server.js.
    // Shown alongside the rewrite, never instead of it.
    if (data.safety) {
      const card = document.createElement("div");
      card.className = "safety-notice";
      const heading = document.createElement("div");
      heading.className = "safety-notice-heading";
      heading.textContent = data.safety.heading || "Please reach out to real support";
      const body = document.createElement("div");
      body.className = "safety-notice-body";
      body.innerText = data.safety.body || "";
      card.appendChild(heading);
      card.appendChild(body);
      resultBox.appendChild(card);
    }
  } catch (err) {
    resultBox.innerHTML = '<span class="placeholder">Nothing here yet.</span>';
    errorBox.textContent = "Couldn't connect to the server.";
    errorBox.style.display = "block";
  } finally {
    isRewriting = false;
    btn.disabled = false;
    btn.textContent = "Rewrite it";
  }
}
