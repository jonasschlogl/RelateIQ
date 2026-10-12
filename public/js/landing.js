// Landing page behaviour for the app's own home page. Same page, same
// behaviour as the public site (demo tabs, Monthly/Yearly switch, scroll
// reveal, floating button); the only difference is that the buttons lead
// into the real app (register / chat) and the Pro/Premium buttons go to
// Stripe Checkout instead of a waitlist dialog.

let selectedBilling = "yearly";

document.addEventListener("DOMContentLoaded", () => {
  // The #nav-toggle/#nav-menu hamburger click handler lives in shared.js.

  document.querySelectorAll("[data-plan]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const plan = btn.getAttribute("data-plan");
      const loggedIn = typeof getUser === "function" ? getUser() : null;

      if (!loggedIn) {
        setPendingPlan(plan, selectedBilling);
        window.location.href = "register.html";
        return;
      }

      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Redirecting to checkout…";
      startCheckout(plan, selectedBilling).finally(() => {
        btn.disabled = false;
        btn.textContent = original;
      });
    });
  });

  const user = typeof getUser === "function" ? getUser() : null;
  if (user) {
    document.querySelectorAll("[data-cta]").forEach((el) => {
      el.textContent = "Continue to chat";
      el.setAttribute("href", "chat.html");
    });
    const loginLink = document.getElementById("nav-login");
    if (loginLink) {
      loginLink.textContent = "My account";
      loginLink.setAttribute("href", "dashboard.html");
    }
  }

  initScrollReveal();
  initFloatingCta();
  initDemoTabs();
  initBillingToggle();
});

// Hero preview: switches between the Coach Chat and Partner Practice demos.
// These are plain buttons (no data-cta), so they never open the dialog.
function initDemoTabs() {
  const tabs = Array.from(document.querySelectorAll(".demo-tab"));
  if (tabs.length === 0) return;
  const show = (name, focus) => {
    tabs.forEach((t) => {
      const on = t.dataset.demo === name;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById("panel-" + t.dataset.demo);
      if (panel) panel.hidden = !on;
      if (on && focus) t.focus();
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => show(t.dataset.demo, false));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      show(next.dataset.demo, true);
    });
  });
}

// Pricing: Monthly / Yearly switch. Also records the chosen billing period on
// the plan buttons, so Umami's click event carries it as a property.
function initBillingToggle() {
  const buttons = Array.from(document.querySelectorAll(".billing-btn"));
  if (buttons.length === 0) return;
  const apply = (mode) => {
    buttons.forEach((b) => {
      const on = b.dataset.billing === mode;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll(".amt, .price-billed[data-monthly]").forEach((el) => {
      el.textContent = el.dataset[mode];
    });
    selectedBilling = mode;
  };
  buttons.forEach((b) => b.addEventListener("click", () => apply(b.dataset.billing)));
  apply("yearly");
}

// Fades individual cards/rows in as they scroll into view. Progressive
// enhancement only: the default (no JS, or IntersectionObserver missing)
// is everything fully visible.
function initScrollReveal() {
  if (!("IntersectionObserver" in window)) return;

  const targets = document.querySelectorAll(
    ".feature-card, .extra-card, .price-card, .trust-item, .step, .faq-item, .compare-table-wrap, .mission-block, .core-split"
  );
  if (targets.length === 0) return;

  document.body.classList.add("js-reveal");
  targets.forEach((el) => el.classList.add("reveal-item"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  targets.forEach((el) => observer.observe(el));
}

// Shows the floating button once the hero is scrolled past, and hides it
// near the footer so it doesn't sit on top of the full-width CTA banner.
function initFloatingCta() {
  const btn = document.getElementById("floating-cta");
  const hero = document.querySelector(".hero");
  if (!btn) return;

  const showAfter = hero ? hero.offsetHeight * 0.6 : 500;
  const update = () => {
    const nearBottom = window.scrollY + window.innerHeight > document.body.scrollHeight - 500;
    const pastHero = window.scrollY > showAfter;
    btn.classList.toggle("visible", pastHero && !nearBottom);
  };

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}
