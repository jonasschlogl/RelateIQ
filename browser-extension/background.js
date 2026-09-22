// Service worker: the only place that talks to the RelateIQ API. Content
// scripts run inside WhatsApp Web / Messenger / Instagram's own page, so a
// fetch() there can get blocked by that page's Content-Security-Policy —
// routing every request through here avoids that entirely, since a service
// worker isn't subject to the host page's CSP.

// Edit this if you move off Railway or attach a custom domain later.
const API_BASE = "https://terrific-spirit-production.up.railway.app";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return false;

  if (msg.type === "relateiq:getAuthState") {
    getAuthState().then(sendResponse);
    return true; // keep the message channel open for the async response
  }

  if (msg.type === "relateiq:coachMessage") {
    coachMessage(msg.draft, msg.context, msg.messages).then(sendResponse);
    return true;
  }

  if (msg.type === "relateiq:suggestReplies") {
    suggestReplies(msg.messages).then(sendResponse);
    return true;
  }

  return false;
});

async function getAuthState() {
  const { relateiq_token, relateiq_user } = await chrome.storage.local.get(["relateiq_token", "relateiq_user"]);
  return { loggedIn: !!relateiq_token, user: relateiq_user || null };
}

// Shared by coachMessage and suggestReplies below — both hit the RelateIQ
// API the same way (bearer token, JSON body, same error shapes) and differ
// only in the path and body.
async function relateiqApiPost(path, body) {
  const { relateiq_token } = await chrome.storage.local.get("relateiq_token");
  if (!relateiq_token) {
    return { ok: false, code: "not_logged_in", error: "Log in to RelateIQ from the extension icon first." };
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${relateiq_token}` },
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      await chrome.storage.local.remove(["relateiq_token", "relateiq_user"]);
      return { ok: false, code: "not_logged_in", error: "You've been logged out — log in again from the extension icon." };
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, code: "server_error", error: data.error || "Something went wrong. Please try again." };
    }

    return { ok: true, data };
  } catch (err) {
    return { ok: false, code: "network_error", error: "Couldn't reach RelateIQ. Check your connection." };
  }
}

async function coachMessage(draft, context, messages) {
  const result = await relateiqApiPost("/api/message-coach", { draft, context: context || "", messages: messages || [] });
  if (!result.ok) return result;
  if (!result.data.rewrite) {
    return { ok: false, code: "server_error", error: "Something went wrong. Please try again." };
  }
  return { ok: true, rewrite: result.data.rewrite, why: result.data.why || "" };
}

async function suggestReplies(messages) {
  const result = await relateiqApiPost("/api/message-coach/suggestions", { messages: messages || [] });
  if (!result.ok) return result;
  if (!Array.isArray(result.data.suggestions) || !result.data.suggestions.length) {
    return { ok: false, code: "server_error", error: "Something went wrong. Please try again." };
  }
  return { ok: true, suggestions: result.data.suggestions };
}
