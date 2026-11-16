// Handles the login, register, forgot-password, and reset-password forms
// (login.html / register.html / forgot-password.html / reset-password.html).

document.addEventListener("DOMContentLoaded", () => {
  const emailForm = document.getElementById("email-form");
  const codeForm = document.getElementById("code-form");
  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const forgotPasswordForm = document.getElementById("forgot-password-form");
  const resetPasswordForm = document.getElementById("reset-password-form");
  const errorBox = document.getElementById("form-error");
  const successBox = document.getElementById("form-success");

  // Already signed in (e.g. coming from the website's "Try it free" or "Log in"):
  // skip the form. A plan picked on the website goes straight to checkout.
  if ((registerForm || loginForm || emailForm) && typeof getToken === "function" && getToken()) {
    const plan = consumePendingPlan();
    if (plan) startCheckout(plan);
    else window.location.replace("chat.html");
    return;
  }

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


  // ---- Email + 6-digit code (log in or sign up in one flow) -----------------
  if (emailForm && codeForm) {
    const emailInput = document.getElementById("email");
    const codeInput = document.getElementById("code");
    const codeEmail = document.getElementById("code-email");
    const resendBtn = document.getElementById("code-resend");
    const changeBtn = document.getElementById("code-change");
    const codeSubmit = codeForm.querySelector("button[type=submit]");
    let challenge = null;
    let sentTo = "";
    let cooldownTimer = null;
    let verifying = false;
    const heading = document.querySelector(".auth-card h1");
    const intro = document.querySelector(".auth-card > .text-muted");
    const headingText = heading ? heading.textContent : "";
    const introText = intro ? intro.textContent : "";

    function startCooldown(secs) {
      clearInterval(cooldownTimer);
      let left = secs;
      resendBtn.disabled = true;
      const tick = () => {
        resendBtn.textContent = left > 0 ? `Send a new code (${left}s)` : "Send a new code";
        if (left <= 0) { clearInterval(cooldownTimer); resendBtn.disabled = false; }
        left -= 1;
      };
      tick();
      cooldownTimer = setInterval(tick, 1000);
    }

    async function requestCode(email) {
      const res = await fetch("/api/auth/email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.error || "Couldn't send the code. Please try again.");
      challenge = data.challenge;
      sentTo = email;
    }

    // "Continue with Google": shown only when the server has Google keys configured.
    const googleBlock = document.getElementById("google-block");
    const googleBtn = document.getElementById("google-btn");
    if (googleBlock && googleBtn) {
      fetch("/api/auth/providers").then((r) => r.json()).then((p) => {
        if (!p || !p.google) return;
        let ref = "";
        try { ref = localStorage.getItem("relateiq_referral_code") || ""; } catch (e) { /* ignore */ }
        if (ref) googleBtn.href = "/api/auth/google/start?ref=" + encodeURIComponent(ref);
        googleBlock.style.display = "";
        googleBlock.dataset.on = "1";
      }).catch(() => {});
    }
    const googleErrors = { cancelled: "Google sign-in was cancelled.", expired: "That sign-in took too long. Please try again.", unverified: "Your Google email isn't verified, so we can't use it. Try the email code instead.", failed: "Google sign-in didn't work. Please try again or use your email.", off: "Google sign-in isn't available right now." };
    const gErr = new URLSearchParams(window.location.search).get("google");
    if (gErr) showError(googleErrors[gErr] || googleErrors.failed);

    function showCodeStep() {
      emailForm.style.display = "none";
      const pw = document.getElementById("login-form");
      const alt = document.querySelector(".auth-alt");
      if (pw) pw.style.display = "none";
      if (alt) alt.style.display = "none";
      codeForm.style.display = "";
      if (googleBlock) googleBlock.style.display = "none";
      if (heading) heading.textContent = "Check your email";
      if (intro) intro.style.display = "none";
      codeEmail.textContent = sentTo;
      codeInput.value = "";
      codeInput.focus();
      startCooldown(30);
    }

    emailForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      showError("");
      const email = emailInput.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError("Enter a valid email address."); return; }
      const btn = emailForm.querySelector("button[type=submit]");
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = "Sending code…";
      try {
        await requestCode(email);
        showCodeStep();
      } catch (err) {
        showError(err.message);
      } finally {
        btn.disabled = false; btn.textContent = label;
      }
    });

    resendBtn.addEventListener("click", async () => {
      showError("");
      resendBtn.disabled = true;
      try {
        await requestCode(sentTo);
        codeInput.value = ""; codeInput.focus();
        startCooldown(30);
      } catch (err) {
        showError(err.message);
        startCooldown(30);
      }
    });

    changeBtn.addEventListener("click", () => {
      showError("");
      clearInterval(cooldownTimer);
      challenge = null;
      codeForm.style.display = "none";
      emailForm.style.display = "";
      if (googleBlock && googleBlock.dataset.on) googleBlock.style.display = "";
      if (heading) heading.textContent = headingText;
      if (intro) { intro.textContent = introText; intro.style.display = ""; }
      const alt = document.querySelector(".auth-alt");
      if (alt) alt.style.display = "";
      emailInput.focus();
    });

    async function verifyCode() {
      if (verifying) return;
      const code = codeInput.value.replace(/\D/g, "");
      if (code.length !== 6) { showError("Enter the 6-digit code from your email."); return; }
      verifying = true;
      showError("");
      const label = codeSubmit.textContent;
      codeSubmit.disabled = true; codeSubmit.textContent = "Checking…";
      try {
        const res = await fetch("/api/auth/email-code/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challenge, code, acceptedTerms: true, referralCode: consumePendingReferral() }),
        });
        const data = await safeJson(res);
        if (!res.ok) {
          const err = new Error(data.error || "That code didn't work. Please try again.");
          err.expired = !!data.expired;
          throw err;
        }
        setSession(data.token, data.user);
        const pendingPlan = consumePendingPlan();
        if (pendingPlan) {
          codeSubmit.textContent = "Redirecting to checkout…";
          startCheckout(pendingPlan);
        } else {
          window.location.href = data.isNew ? "welcome.html" : "chat.html";
        }
      } catch (err) {
        showError(err.message);
        if (err.expired) { challenge = null; }
        codeSubmit.disabled = false; codeSubmit.textContent = label;
        codeInput.select();
        verifying = false;
      }
    }

    codeForm.addEventListener("submit", (e) => { e.preventDefault(); verifyCode(); });
    // Submit by itself as soon as all 6 digits are in (also handles paste and the iOS/Android autofill from the email).
    codeInput.addEventListener("input", () => {
      codeInput.value = codeInput.value.replace(/[^\d ]/g, "");
      if (codeInput.value.replace(/\D/g, "").length === 6) verifyCode();
    });

    const toggle = document.getElementById("toggle-password");
    const pwForm = document.getElementById("login-form");
    if (toggle && pwForm) {
      toggle.addEventListener("click", () => {
        const showPw = pwForm.style.display === "none";
        pwForm.style.display = showPw ? "" : "none";
        emailForm.style.display = showPw ? "none" : "";
        toggle.textContent = showPw ? "Use an email code instead" : "Use a password instead";
        showError("");
        if (showPw) { const pe = document.getElementById("pw-email"); pe.value = emailInput.value; (pe.value ? document.getElementById("password") : pe).focus(); }
        else emailInput.focus();
      });
    }
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
        if (pendingPlan) {
          btn.textContent = "Redirecting to checkout…";
          startCheckout(pendingPlan);
        } else {
          window.location.href = "welcome.html";
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

      const email = (document.getElementById("pw-email") || document.getElementById("email")).value.trim();
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
        showSuccess(data.message || "If that email has a RelationshipAI account, we've sent a link to reset your password.");
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
        if (introText) introText.textContent = "Password updated. Taking you to your dashboard…";
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
