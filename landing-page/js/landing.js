// Landing-page-only build: the app behind this page is NOT open yet, so every
// button that would normally lead into it ([data-cta] / [data-plan]) opens a
// friendly "not open yet" dialog instead. Each of those buttons carries a
// data-umami-event="…" attribute, which the Umami analytics script counts as
// a click — that count is the whole point of this page.

document.addEventListener("DOMContentLoaded", () => {
  initNavToggle();
  initSoonModal();
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
    document.querySelectorAll("[data-plan]").forEach((el) => {
      el.setAttribute("data-umami-event-billing", mode);
    });
  };
  buttons.forEach((b) => b.addEventListener("click", () => apply(b.dataset.billing)));
  apply("yearly");
}

function initNavToggle() {
  const toggle = document.getElementById("nav-toggle");
  const menu = document.getElementById("nav-menu");
  if (toggle && menu) toggle.addEventListener("click", () => menu.classList.toggle("open"));
}

function initSoonModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "soon-modal";
  overlay.style.display = "none";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "soon-title");
  overlay.innerHTML =
    '<div class="modal-card dialog-card">' +
    '<h2 id="soon-title">We open soon. Want a heads-up?</h2>' +
    '<div id="soon-ask">' +
    '<p class="dialog-message" style="margin-top:10px;">RelationshipAI isn\'t open just yet. Leave your email and we\'ll write to you once, the day it opens. Your click already helps us decide how fast to open.</p>' +
    '<form id="soon-form" class="soon-form" novalidate>' +
    '<label class="soon-sr" for="soon-email">Email address</label>' +
    '<input type="email" id="soon-email" name="email" class="soon-input" placeholder="you@example.com" autocomplete="email" inputmode="email" maxlength="254" required />' +
    '<input type="text" id="soon-website" name="website" class="soon-hp" tabindex="-1" autocomplete="off" aria-hidden="true" />' +
    '<button type="submit" class="btn btn-gradient" id="soon-submit">Notify me</button>' +
    '<p class="soon-error" id="soon-error" role="alert" hidden></p>' +
    '<p class="soon-fine">One email when we open. No spam. See our <a href="privacy.html">privacy notice</a>.</p>' +
    "</form></div>" +
    '<div id="soon-done" hidden><p class="dialog-message" style="margin-top:10px;"><strong>You\'re on the list.</strong> We\'ll email you once, when RelationshipAI opens. Thank you for being early.</p></div>' +
    '<div class="modal-close-row"><button type="button" class="btn btn-ghost" id="soon-close">Not now</button></div>' +
    "</div>";
  document.body.appendChild(overlay);

  const $ = (id) => document.getElementById(id);
  const form = $("soon-form"), emailEl = $("soon-email"), errEl = $("soon-error"), submitEl = $("soon-submit");
  let lastFocus = null, openedAt = 0, ctx = { source: "unknown", plan: "", billing: "" };

  const store = {
    get() { try { return localStorage.getItem("rai_waitlist") === "1"; } catch (_) { return false; } },
    set() { try { localStorage.setItem("rai_waitlist", "1"); } catch (_) {} },
  };
  const showDone = () => {
    $("soon-ask").hidden = true;
    $("soon-done").hidden = false;
    $("soon-title").textContent = "Thank you";
    $("soon-close").textContent = "Close";
  };
  const showAsk = () => {
    $("soon-ask").hidden = false;
    $("soon-done").hidden = true;
    $("soon-title").textContent = "We open soon. Want a heads-up?";
    $("soon-close").textContent = "Not now";
  };
  const showError = (msg) => { errEl.textContent = msg; errEl.hidden = false; };

  const open = (target) => {
    lastFocus = document.activeElement;
    openedAt = Date.now();
    if (target) {
      ctx = {
        source: target.getAttribute("data-umami-event") || "unknown",
        plan: target.getAttribute("data-plan") || "",
        billing: target.getAttribute("data-umami-event-billing") || "",
      };
    }
    errEl.hidden = true;
    overlay.style.display = "flex";
    if (store.get()) { showDone(); $("soon-close").focus(); } else { showAsk(); emailEl.focus(); }
  };
  const close = () => {
    overlay.style.display = "none";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const email = emailEl.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
      showError("Please enter a valid email address.");
      emailEl.focus();
      return;
    }
    submitEl.disabled = true;
    submitEl.textContent = "Saving...";
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email, source: ctx.source, plan: ctx.plan, billing: ctx.billing,
          website: $("soon-website").value, t: Date.now() - openedAt,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error("save failed");
      store.set();
      try { if (window.umami && window.umami.track) window.umami.track("waitlist-signup", { source: ctx.source, plan: ctx.plan }); } catch (_) {}
      showDone();
      $("soon-close").focus();
    } catch (_) {
      showError("Sorry, that didn't go through. Please try again in a moment.");
    } finally {
      submitEl.disabled = false;
      submitEl.textContent = "Notify me";
    }
  });

  $("soon-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.style.display !== "none") close();
  });

  // Delegated so it also covers the floating button and cards. Runs in the
  // normal bubbling phase, after Umami's own document-level click listener
  // has seen the same event, so the click is counted either way.
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-cta], [data-plan]");
    if (!target) return;
    e.preventDefault();
    open(target);
  });
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
