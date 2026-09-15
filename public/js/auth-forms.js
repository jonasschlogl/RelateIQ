// Handles the login and register forms (login.html / register.html).

document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const errorBox = document.getElementById("form-error");

  function showError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg;
    errorBox.style.display = msg ? "block" : "none";
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");

      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const btn = registerForm.querySelector("button[type=submit]");
      const originalLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Creating account…";

      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error || "Registration failed.");

        setSession(data.token, data.user);
        const pendingPlan = consumePendingPlan();
        if (pendingPlan) {
          btn.textContent = "Redirecting to checkout…";
          startCheckout(pendingPlan);
        } else {
          window.location.href = "chat.html";
        }
      } catch (err) {
        showError(err.message);
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const btn = loginForm.querySelector("button[type=submit]");
      const originalLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Logging in…";

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error || "Login failed.");

        setSession(data.token, data.user);
        const pendingPlan = consumePendingPlan();
        if (pendingPlan) {
          btn.textContent = "Redirecting to checkout…";
          startCheckout(pendingPlan);
        } else {
          window.location.href = "chat.html";
        }
      } catch (err) {
        showError(err.message);
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });
  }
});
