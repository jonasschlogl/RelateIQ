// Handles the login, register, forgot-password, and reset-password forms
// (login.html / register.html / forgot-password.html / reset-password.html).

document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const forgotPasswordForm = document.getElementById("forgot-password-form");
  const resetPasswordForm = document.getElementById("reset-password-form");
  const errorBox = document.getElementById("form-error");
  const successBox = document.getElementById("form-success");

  function showError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg;
    errorBox.style.display = msg ? "block" : "none";
  }

  function showSuccess(msg) {
    if (!successBox) return;
    successBox.textContent = msg;
    successBox.style.display = msg ? "block" : "none";
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");

      const name = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const acceptedTerms = !!(document.getElementById("accept-terms") || {}).checked;
      if (!acceptedTerms) {
        showError("Please accept the Terms of Service and Privacy Policy to create an account.");
        return;
      }
      const btn = registerForm.querySelector("button[type=submit]");
      const originalLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Creating account…";

      try {
        const referralCode = consumePendingReferral();
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, referralCode, acceptedTerms }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error || "Registration failed.");

        setSession(data.token, data.user);
        const pendingPlan = consumePendingPlan();
        const pendingCoupleInvite = consumePendingCoupleInvite();
        if (pendingPlan) {
          btn.textContent = "Redirecting to checkout…";
          startCheckout(pendingPlan);
        } else if (pendingCoupleInvite) {
          window.location.href = `couple.html?invite=${encodeURIComponent(pendingCoupleInvite)}`;
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
        const pendingCoupleInvite = consumePendingCoupleInvite();
        if (pendingPlan) {
          btn.textContent = "Redirecting to checkout…";
          startCheckout(pendingPlan);
        } else if (pendingCoupleInvite) {
          window.location.href = `couple.html?invite=${encodeURIComponent(pendingCoupleInvite)}`;
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

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");
      showSuccess("");

      const email = document.getElementById("email").value.trim();
      const btn = forgotPasswordForm.querySelector("button[type=submit]");
      const originalLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Sending…";

      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");

        // Same success message whether or not the email actually has an
        // account — the server deliberately doesn't reveal that either, so
        // this can't be used to check which emails are registered.
        showSuccess(data.message || "If that email has a RelateIQ account, we've sent a link to reset your password.");
        forgotPasswordForm.reset();
        btn.textContent = "Sent!";
      } catch (err) {
        showError(err.message);
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });
  }

  if (resetPasswordForm) {
    const introText = document.getElementById("reset-intro");
    const resetToken = new URLSearchParams(window.location.search).get("token");

    if (!resetToken) {
      showError("This reset link is missing its token. Request a new one from the forgot-password page.");
      resetPasswordForm.querySelectorAll("input, button").forEach((el) => (el.disabled = true));
    }

    resetPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");

      const password = document.getElementById("password").value;
      const passwordConfirm = document.getElementById("password-confirm").value;
      if (password !== passwordConfirm) {
        showError("Those passwords don't match.");
        return;
      }

      const btn = resetPasswordForm.querySelector("button[type=submit]");
      const originalLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Saving…";

      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, password }),
        });
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data.error || "Couldn't reset your password. Please try again.");

        setSession(data.token, data.user);
        if (introText) introText.textContent = "Password updated — taking you to your dashboard…";
        resetPasswordForm.style.display = "none";
        window.location.href = "dashboard.html";
      } catch (err) {
        showError(err.message);
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });
  }
});
