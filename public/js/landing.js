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

  initScrollReveal();
  initFloatingCta();
  initHeroDemo();
});

// Fades individual cards/rows in as they scroll into view. Progressive
// enhancement only: the default (no JS, or IntersectionObserver missing)
// is everything fully visible — see the CSS, which only hides anything
// once body.js-reveal is present. That way a slow or blocked script can
// never leave the page stuck invisible.
function initScrollReveal() {
  if (!("IntersectionObserver" in window)) return;

  const targets = document.querySelectorAll(
    ".feature-card, .mode-card, .price-card, .trust-item, .step, .faq-item, .compare-table-wrap, .mission-block"
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

// Lets a visitor try Message Coach right on the landing page, no account
// needed. Talks to the public, per-IP-rate-limited demo endpoint (see
// /api/public/message-coach-demo in server.js) — deliberately plain fetch()
// rather than authFetch, since this must work identically whether or not
// the visitor is logged in, and must never trigger the logged-out redirect
// authFetch does on a 401 (this endpoint never returns one).
let heroDemoInFlight = false;

function initHeroDemo() {
  const btn = document.getElementById("hero-demo-btn");
  const input = document.getElementById("hero-demo-input");
  const resultBox = document.getElementById("hero-demo-result");
  const errorBox = document.getElementById("hero-demo-error");
  const note = document.getElementById("hero-demo-note");
  if (!btn || !input || !resultBox) return;

  btn.addEventListener("click", async () => {
    if (heroDemoInFlight) return;

    const draft = input.value.trim();
    errorBox.style.display = "none";

    if (!draft) {
      errorBox.textContent = "Paste a message first.";
      errorBox.style.display = "block";
      return;
    }

    heroDemoInFlight = true;
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Rewriting…";
    resultBox.innerHTML = '<span class="placeholder">Thinking about the best way to say this…</span>';

    try {
      const res = await fetch("/api/public/message-coach-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const data = await safeJson(res);

      if (!res.ok || !data.rewrite) {
        resultBox.innerHTML = '<span class="placeholder">Click "Rewrite it" to see the difference.</span>';
        errorBox.textContent = data.error || "Something went wrong. Please try again.";
        errorBox.style.display = "block";
        if (data.limitReached && note) {
          note.textContent = "Out of free demo rewrites for today — create a free account for 8 a day, every day.";
        }
        return;
      }

      resultBox.innerHTML = "";

      const rewriteEl = document.createElement("div");
      rewriteEl.className = "coach-rewrite";
      rewriteEl.textContent = data.rewrite;
      resultBox.appendChild(rewriteEl);

      if (data.why) {
        const whyLabel = document.createElement("div");
        whyLabel.className = "coach-why-label";
        whyLabel.textContent = "Why this works better";
        resultBox.appendChild(whyLabel);

        const whyEl = document.createElement("p");
        whyEl.className = "coach-why";
        whyEl.textContent = data.why;
        resultBox.appendChild(whyEl);
      }

      if (note && typeof data.remaining === "number") {
        note.textContent =
          data.remaining > 0
            ? `${data.remaining} free demo rewrite${data.remaining === 1 ? "" : "s"} left today. The full app gives you 8 a day, free.`
            : "That was your last free demo rewrite for today — create a free account for 8 a day, every day.";
      }
    } catch (err) {
      resultBox.innerHTML = '<span class="placeholder">Click "Rewrite it" to see the difference.</span>';
      errorBox.textContent = "Couldn't connect to the server.";
      errorBox.style.display = "block";
    } finally {
      heroDemoInFlight = false;
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });
}
