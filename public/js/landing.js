// Landing page behaviour: mobile nav toggle, swap CTAs for logged-in users,
// and wire up the Pro/Premium pricing buttons to Stripe Checkout.

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("nav-toggle");
  const menu = document.getElementById("nav-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", () => menu.classList.toggle("open"));
  }

  document.querySelectorAll("[data-plan]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const plan = btn.getAttribute("data-plan");
      const loggedIn = typeof getUser === "function" ? getUser() : null;

      if (!loggedIn) {
        setPendingPlan(plan);
        window.location.href = "register.html";
        return;
      }

      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Redirecting to checkout…";
      startCheckout(plan).finally(() => {
        btn.disabled = false;
        btn.textContent = original;
      });
    });
  });

  const user = typeof getUser === "function" ? getUser() : null;
  if (user) {
    document.querySelectorAll("[data-cta]").forEach((el) => {
      if (el.classList.contains("mode-card")) {
        // Rich preview cards (the "Modes" section): keep their content,
        // just point them straight at the real, logged-in destination.
        el.setAttribute("href", el.getAttribute("data-cta-href") || "chat.html");
        return;
      }
      el.textContent = "Continue to chat";
      el.setAttribute("href", "chat.html");
    });
    const loginLink = document.getElementById("nav-login");
    if (loginLink) {
      loginLink.textContent = "My account";
      loginLink.setAttribute("href", "dashboard.html");
    }
  }
});
