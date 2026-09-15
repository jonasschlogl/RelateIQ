// Login is handled here (in the popup) rather than in a content script,
// since only the popup can safely take a password field. The token it
// gets back is handed to background.js via chrome.storage, which is what
// actually calls the API on every "Coach this message" click.
const API_BASE = "https://terrific-spirit-production.up.railway.app";

document.addEventListener("DOMContentLoaded", async () => {
  await refreshView();
  document.getElementById("login-btn").addEventListener("click", login);
  document.getElementById("logout-btn").addEventListener("click", logout);
  document.getElementById("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });
});

async function refreshView() {
  const { relateiq_token, relateiq_user } = await chrome.storage.local.get(["relateiq_token", "relateiq_user"]);
  document.getElementById("logged-out").style.display = relateiq_token ? "none" : "block";
  document.getElementById("logged-in").style.display = relateiq_token ? "block" : "none";
  if (relateiq_token && relateiq_user) {
    document.getElementById("user-email").textContent = relateiq_user.email || relateiq_user.name || "your account";
  }
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.style.display = "none";

  if (!email || !password) {
    errorEl.textContent = "Enter your email and password.";
    errorEl.style.display = "block";
    return;
  }

  const btn = document.getElementById("login-btn");
  btn.disabled = true;
  btn.textContent = "Logging in…";

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.token) {
      errorEl.textContent = data.error || "Couldn't log in.";
      errorEl.style.display = "block";
      return;
    }

    await chrome.storage.local.set({ relateiq_token: data.token, relateiq_user: data.user });
    document.getElementById("password").value = "";
    await refreshView();
  } catch (err) {
    errorEl.textContent = "Couldn't reach RelateIQ. Check your connection.";
    errorEl.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.textContent = "Log in";
  }
}

async function logout() {
  await chrome.storage.local.remove(["relateiq_token", "relateiq_user"]);
  await refreshView();
}
