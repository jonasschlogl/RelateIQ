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
  initMoreToggle();
  initHeroSignup();
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
    ".feature-card, .extra-card, .tool-card, .more-card, .plan-compare, .price-card, .trust-item, .step, .faq-item, .compare-table-wrap, .mission-block, .core-split"
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

// Small tools: on phones only the first three cards show until the visitor
// asks for the rest, which keeps the page from feeling endless.
function initMoreToggle() {
  const grid = document.getElementById("more-grid");
  const btn = document.getElementById("more-toggle");
  if (!grid || !btn) return;
  grid.classList.add("is-collapsed");
  btn.addEventListener("click", () => {
    const collapsed = grid.classList.toggle("is-collapsed");
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.textContent = collapsed ? "Show all 9 tools" : "Show fewer";
  });
}

// Hero: email field right in the first screen, so joining the list is one step.
function initHeroSignup() {
  const form = document.getElementById("hero-signup");
  if (!form) return;
  const emailEl = document.getElementById("hero-email");
  const btn = document.getElementById("hero-signup-btn");
  const errEl = document.getElementById("hero-error");
  const doneEl = document.getElementById("hero-done");
  const loadedAt = Date.now();
  const showDone = () => { form.hidden = true; errEl.hidden = true; doneEl.hidden = false; };
  try { if (localStorage.getItem("rai_waitlist") === "1") showDone(); } catch (_) {}

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const email = emailEl.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
      errEl.textContent = "Please enter a valid email address.";
      errEl.hidden = false;
      emailEl.focus();
      return;
    }
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "Saving...";
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email, source: "hero-inline", plan: "", billing: "",
          website: document.getElementById("hero-website").value, t: Date.now() - loadedAt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("save failed");
      try { localStorage.setItem("rai_waitlist", "1"); } catch (_) {}
      try { if (window.umami && window.umami.track) window.umami.track("waitlist-signup", { source: "hero-inline", plan: "" }); } catch (_) {}
      showDone();
    } catch (_) {
      errEl.textContent = "Sorry, that didn't go through. Please try again in a moment.";
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
}
