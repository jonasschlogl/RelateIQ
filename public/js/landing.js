// Landing page behaviour: mobile nav toggle, swap CTAs for logged-in users,
// and wire up the Pro/Premium pricing buttons to Stripe Checkout.

document.addEventListener("DOMContentLoaded", () => {
  // The #nav-toggle/#nav-menu hamburger click handler now lives in
  // shared.js (loaded on every page, not just this one) — see there.

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

  initScrollReveal();
  initFloatingCta();
});

// Fades individual cards/rows in as they scroll into view. Progressive
// enhancement only: the default (no JS, or IntersectionObserver missing)
// is everything fully visible — see the CSS, which only hides anything
// once body.js-reveal is present. That way a slow or blocked script can
// never leave the page stuck invisible.
function initScrollReveal() {
  if (!("IntersectionObserver" in window)) return;

  const targets = document.querySelectorAll(
    ".feature-card, .mode-card, .price-card, .trust-item, .step, .faq-item, .compare-table-wrap, .mission-block, .feature-split"
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

// Shows the floating "Get started free" button once the hero is scrolled
// past, and hides it again near the footer so it doesn't sit on top of the
// full-width CTA banner down there.
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

