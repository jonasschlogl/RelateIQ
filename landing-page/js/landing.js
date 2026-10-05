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
});

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
    '<h2 id="soon-title">RelationshipAI isn\'t open just yet</h2>' +
    '<p class="dialog-message" style="margin-top:10px;">Thanks for clicking! We\'re putting the finishing touches on RelationshipAI and aren\'t letting people in yet. ' +
    'We\'re checking how many people are interested before we launch — your click was counted, anonymously, and it genuinely helps.</p>' +
    '<p class="dialog-message" style="margin-top:10px;">Please check back soon.</p>' +
    '<div class="modal-close-row"><button type="button" class="btn btn-gradient" id="soon-close">Got it</button></div>' +
    "</div>";
  document.body.appendChild(overlay);

  let lastFocus = null;
  const open = () => {
    lastFocus = document.activeElement;
    overlay.style.display = "flex";
    document.getElementById("soon-close").focus();
  };
  const close = () => {
    overlay.style.display = "none";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  document.getElementById("soon-close").addEventListener("click", close);
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
    open();
  });
}

// Fades individual cards/rows in as they scroll into view. Progressive
// enhancement only: the default (no JS, or IntersectionObserver missing)
// is everything fully visible.
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
