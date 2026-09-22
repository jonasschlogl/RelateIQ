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
