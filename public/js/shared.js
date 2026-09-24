// Shared helpers used across every page: session storage, auth-aware fetch.

function getToken() {
  try {
    return localStorage.getItem("relateiq_token");
  } catch (e) {
    return null;
  }
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("relateiq_user"));
  } catch (e) {
    return null;
  }
}

function setSession(token, user) {
  try {
    localStorage.setItem("relateiq_token", token);
    localStorage.setItem("relateiq_user", JSON.stringify(user));
  } catch (e) {
    /* ignore storage errors */
  }
}

function clearSession() {
  try {
    localStorage.removeItem("relateiq_token");
    localStorage.removeItem("relateiq_user");
  } catch (e) {
    /* ignore storage errors */
  }
}

function logout() {
  clearSession();
  window.location.href = "login.html";
}

// Remembers which paid plan someone clicked before they were signed in, so
// that after they register/log in we can send them straight into checkout
// instead of dropping them on the dashboard with no idea what they wanted.
function setPendingPlan(plan) {
  try {
    localStorage.setItem("relateiq_pending_plan", plan);
  } catch (e) {
    /* ignore storage errors */
  }
}

function consumePendingPlan() {
  try {
    const plan = localStorage.getItem("relateiq_pending_plan");
    if (plan) localStorage.removeItem("relateiq_pending_plan");
    return plan;
  } catch (e) {
    return null;
  }
}

// Referral links point at register.html?ref=CODE, but someone might land on
// the homepage first and click through to register.html without the query
// string — so every page captures ?ref= into storage on load, and register
// picks it up from there regardless of which page it came in on.
(function captureReferralFromUrl() {
  try {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (code) localStorage.setItem("relateiq_referral_code", code.trim());
  } catch (e) {
    /* ignore storage errors */
  }
})();

function consumePendingReferral() {
  try {
    const code = localStorage.getItem("relateiq_referral_code");
    if (code) localStorage.removeItem("relateiq_referral_code");
    return code;
  } catch (e) {
    return null;
  }
}

// Starts a Stripe Checkout flow for the given plan ("pro" | "premium") and
// redirects the browser to it. Returns once the redirect has been kicked
// off (or the request has failed and an alert shown) so callers can restore
// a button's label in a .finally().
async function startCheckout(plan) {
  try {
    const res = await authFetch("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    });
    const data = await safeJson(res);
    if (!res.ok || !data.url) {
      alert(data.error || "Couldn't start checkout. Please try again.");
      return;
    }
    window.location.href = data.url;
  } catch (err) {
    console.error(err);
  }
}

// Opens Stripe's hosted billing portal so a subscriber can update payment
// details, switch plans, or cancel.
async function openBillingPortal() {
  try {
    const res = await authFetch("/api/billing/portal", { method: "POST" });
    const data = await safeJson(res);
    if (!res.ok || !data.url) {
      alert(data.error || "Couldn't open billing. Please try again.");
      return;
    }
    window.location.href = data.url;
  } catch (err) {
    console.error(err);
  }
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = "login.html";
  }
}

// Wires up the mobile hamburger menu (a #nav-toggle button that shows/hides
// a #nav-menu of nav links) on any page that has one. Lives here — rather
// than in a page-specific script — since the .site-nav header, and the CSS
// that hides .nav-links and shows .nav-toggle under 900px, is shared by
// nearly every page: the toggle needs to work everywhere that header
// appears, not just on the landing page.
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("nav-toggle");
  const menu = document.getElementById("nav-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", () => menu.classList.toggle("open"));
  }
});

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(url, Object.assign({}, options, { headers }));

  if (res.status === 401) {
    clearSession();
    window.location.href = "login.html";
    throw new Error("unauthorized");
  }
  return res;
}

// Reads a fetch Response body as JSON without throwing when the body is
// empty, not valid JSON, or the server returned an HTML/plain-text error
// page (e.g. from a proxy, or a crash before the app's own error handling
// could run). Always resolves to a plain object with at least an "error"
// key when something went wrong, so callers can safely do `data.error`.
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// Renders a read-only transcript of conversation messages. Used by the
// "share a whole conversation" feature: the owner's preview-before-sharing
// modal, the collapsed item in their share editor, and the partner's
// read-only view all render a conversation the same way from this one
// function, so what the owner previews is exactly what the partner sees.
function renderTranscriptHtml(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const visible = list.filter((m) => m && m.content && String(m.content).trim());
  if (!visible.length) {
    return '<p class="transcript-empty">No messages in this conversation.</p>';
  }
  return (
    '<div class="transcript">' +
    visible
      .map((m) => {
        const role = m.role === "user" ? "role-user" : "role-assistant";
        return `<div class="transcript-msg ${role}">${escapeHtml(m.content)}</div>`;
      })
      .join("") +
    "</div>"
  );
}

// Wires a mic button to dictate into a text input/textarea using the Web
// Speech API. This is a progressive enhancement only — Firefox and some
// browsers don't support it at all, so the button hides itself rather than
// sitting there broken. Dictated text is appended after whatever's already
// in the field (so it plays nicely with someone who typed part of a message
// and wants to finish it by voice), and interim (not-yet-final) results are
// shown live so it doesn't feel like it's stalled.
function wireVoiceInput(buttonEl, fieldEl) {
  if (!buttonEl || !fieldEl) return;
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) {
    buttonEl.style.display = "none";
    return;
  }

  let recognition = null;
  let listening = false;
  let baseText = "";

  function stop() {
    try {
      recognition?.stop();
    } catch (e) {
      /* ignore */
    }
  }

  buttonEl.addEventListener("click", () => {
    if (listening) {
      stop();
      return;
    }

    recognition = new SpeechRecognitionCtor();
    recognition.lang = document.documentElement.lang || navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    baseText = fieldEl.value;
    if (baseText && !/\s$/.test(baseText)) baseText += " ";

    recognition.addEventListener("start", () => {
      listening = true;
      buttonEl.classList.add("listening");
      buttonEl.setAttribute("title", "Stop dictating");
    });

    recognition.addEventListener("result", (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        baseText += final;
        if (!/\s$/.test(baseText)) baseText += " ";
      }
      fieldEl.value = baseText + interim;
      fieldEl.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const reset = () => {
      listening = false;
      buttonEl.classList.remove("listening");
      buttonEl.setAttribute("title", "Dictate a message");
    };
    recognition.addEventListener("end", reset);
    recognition.addEventListener("error", reset);

    try {
      recognition.start();
    } catch (e) {
      reset();
    }
  });
}

// Registers the service worker on every page (needed before any push
// subscription can happen) — this alone never prompts for permission or
// subscribes to anything, so it's safe to run unconditionally on load.
// Browsers without support (or this running over plain HTTP in local dev)
// just silently skip it.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {
    /* not fatal — push notifications just won't be available */
  });
}

// Converts a VAPID public key (base64url, as the server hands it out) into
// the Uint8Array the PushManager.subscribe() applicationServerKey expects.
// Standard Web Push boilerplate.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function safeJson(res) {
  let text = "";
  try {
    text = await res.text();
  } catch (e) {
    return { error: `Could not read the server's response (status ${res.status}).` };
  }

  if (!text) {
    return { error: `The server sent an empty response (status ${res.status}). Please try again.` };
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Non-JSON response from server:", text);
    return { error: `Unexpected response from the server (status ${res.status}). Check the server terminal for errors.` };
  }
}
