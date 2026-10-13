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
  initHeroSignup();
  initMobileLayout();
  initMobileLayout2();
  initMobileTools();
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

// Phones: the three main tools become tabs (one visible at a time), and the
// pricing cards and blog posts become swipeable rows with dots.
function initMobileLayout() {
  const mq = window.matchMedia("(max-width: 700px)");
  const ids = ["coach", "message-check", "practice"];
  const names = { coach: "Coach Chat", "message-check": "Message check", practice: "Partner Practice" };
  const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
  let tabs = null;
  let dots = [];

  const showTool = (id) => {
    sections.forEach((s) => s.classList.toggle("tool-tab-hidden", s.id !== id));
    if (tabs) tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tool === id ? "true" : "false"));
  };
  const buildTabs = () => {
    if (tabs || sections.length < 3) return;
    tabs = document.createElement("div");
    tabs.className = "tool-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.innerHTML = ids.map((id) => '<button type="button" role="tab" data-tool="' + id + '" aria-selected="false">' + names[id] + "</button>").join("");
    sections[0].parentNode.insertBefore(tabs, sections[0]);
    tabs.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-tool]");
      if (!b) return;
      showTool(b.dataset.tool);
      const top = tabs.getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top, behavior: "smooth" });
    });
    showTool("coach");
  };
  const removeTabs = () => {
    if (tabs) { tabs.remove(); tabs = null; }
    sections.forEach((s) => s.classList.remove("tool-tab-hidden"));
  };

  const carousel = (el, startIndex) => {
    if (!el || el.dataset.carousel) return;
    el.dataset.carousel = "1";
    const items = Array.from(el.children);
    const bar = document.createElement("div");
    bar.className = "carousel-dots";
    items.forEach((_, i) => {
      const d = document.createElement("button");
      d.type = "button";
      d.setAttribute("aria-label", "Show card " + (i + 1));
      d.addEventListener("click", () => items[i].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" }));
      bar.appendChild(d);
    });
    el.insertAdjacentElement("afterend", bar);
    const mark = () => {
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0, bestDist = Infinity;
      items.forEach((c, i) => {
        const dist = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
        if (dist < bestDist) { bestDist = dist; best = i; }
      });
      Array.from(bar.children).forEach((d, i) => d.setAttribute("aria-current", i === best ? "true" : "false"));
    };
    el.addEventListener("scroll", () => requestAnimationFrame(mark), { passive: true });
    if (typeof startIndex === "number" && items[startIndex]) {
      const c = items[startIndex];
      el.scrollLeft = c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2;
    }
    mark();
    dots.push({ el, bar });
  };
  const removeCarousels = () => {
    dots.forEach(({ el, bar }) => { bar.remove(); delete el.dataset.carousel; });
    dots = [];
  };

  const apply = () => {
    if (mq.matches) {
      buildTabs();
      carousel(document.querySelector(".pricing-grid"), 1);
      carousel(document.querySelector(".post-grid"), 0);
    } else {
      removeTabs();
      removeCarousels();
    }
  };
  apply();
  if (mq.addEventListener) mq.addEventListener("change", apply);
}

// Phones, second pass: the comparison shows one rival at a time, the small
// tools become a swipe row with a counter, and the FAQ starts short.
function initMobileLayout2() {
  const mq = window.matchMedia("(max-width: 700px)");
  const wrap = document.querySelector(".compare-table-wrap");
  const moreGrid = document.getElementById("more-grid");
  const faq = document.querySelector("#faq .faq");
  let compareTabs = null, counter = null, faqBtn = null, onScroll = null;

  const setVs = (vs) => {
    if (!wrap) return;
    wrap.classList.remove("compare-wrap-bot", "compare-wrap-therapy");
    wrap.classList.add("compare-wrap-" + vs);
    if (compareTabs) compareTabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", b.dataset.vs === vs ? "true" : "false"));
  };

  const on = () => {
    if (wrap && !compareTabs) {
      compareTabs = document.createElement("div");
      compareTabs.className = "compare-tabs";
      compareTabs.setAttribute("role", "tablist");
      compareTabs.innerHTML = '<button type="button" role="tab" data-vs="bot">vs. AI chatbot</button><button type="button" role="tab" data-vs="therapy">vs. couples therapy</button>';
      wrap.parentNode.insertBefore(compareTabs, wrap);
      compareTabs.addEventListener("click", (e) => { const b = e.target.closest("button[data-vs]"); if (b) setVs(b.dataset.vs); });
      setVs("bot");
    }
    if (moreGrid && !counter) {
      const items = Array.from(moreGrid.children);
      counter = document.createElement("div");
      counter.className = "carousel-count";
      moreGrid.insertAdjacentElement("afterend", counter);
      const mark = () => {
        const mid = moreGrid.scrollLeft + moreGrid.clientWidth / 2;
        let best = 0, bestDist = Infinity;
        items.forEach((c, i) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (d < bestDist) { bestDist = d; best = i; } });
        counter.textContent = (best + 1) + " / " + items.length + "  ·  swipe";
      };
      onScroll = () => requestAnimationFrame(mark);
      moreGrid.addEventListener("scroll", onScroll, { passive: true });
      mark();
    }
    if (faq && !faqBtn) {
      const items = Array.from(faq.querySelectorAll(".faq-item"));
      if (items.length > 6) {
        items.slice(6).forEach((i) => i.classList.add("faq-extra"));
        faqBtn = document.createElement("button");
        faqBtn.type = "button";
        faqBtn.className = "faq-more";
        faqBtn.textContent = "Show all " + items.length + " questions";
        faq.insertAdjacentElement("afterend", faqBtn);
        faqBtn.addEventListener("click", () => {
          const open = faq.classList.toggle("faq-open");
          faqBtn.textContent = open ? "Show fewer questions" : "Show all " + items.length + " questions";
        });
      }
    }
  };
  const off = () => {
    if (compareTabs) { compareTabs.remove(); compareTabs = null; }
    if (wrap) wrap.classList.remove("compare-wrap-bot", "compare-wrap-therapy");
    if (counter) { counter.remove(); counter = null; if (onScroll) moreGrid.removeEventListener("scroll", onScroll); }
    if (faqBtn) { faqBtn.remove(); faqBtn = null; faq.classList.remove("faq-open"); faq.querySelectorAll(".faq-extra").forEach((i) => i.classList.remove("faq-extra")); }
  };
  const apply = () => (mq.matches ? on() : off());
  apply();
  if (mq.addEventListener) mq.addEventListener("change", apply);
}

// Mobile: each of the three main tools shows its description AND its example in one place.
// The text of the three tool cards moves into the matching tab of the hero demo, and the
// separate tools section is hidden. On wider screens everything goes back where it was.
function initMobileTools() {
  const mq = window.matchMedia("(max-width: 700px)");
  const panels = ["coach", "message", "practice"].map((n) => document.getElementById("panel-" + n));
  const cards = Array.from(document.querySelectorAll("#features .tool-card-full"));
  const section = document.getElementById("features");
  const wrap = document.querySelector(".demo-wrap");
  if (!section || !wrap || panels.some((p) => !p) || cards.length < 3) return;
  let moved = null;

  const on = () => {
    if (moved) return;
    moved = [];
    panels.forEach((panel, i) => {
      const card = cards[i];
      const parts = {
        tag: card.querySelector(".tool-card-tag"),
        h3: card.querySelector("h3"),
        p: card.querySelector(":scope > p"),
        list: card.querySelector(".core-list"),
        cta: card.querySelector(":scope > .btn"),
      };
      const head = document.createElement("div");
      head.className = "demo-detail-head";
      const foot = document.createElement("div");
      foot.className = "demo-detail-foot";
      [parts.tag, parts.h3, parts.p].forEach((el) => el && head.appendChild(el));
      [parts.list, parts.cta].forEach((el) => el && foot.appendChild(el));
      panel.insertBefore(head, panel.firstChild);
      panel.appendChild(foot);
      moved.push({ card, head, foot, parts });
    });
    section.removeAttribute("id");
    wrap.id = "features";
    document.body.classList.add("tools-merged");
  };
  const off = () => {
    if (!moved) return;
    moved.forEach(({ card, head, foot, parts }) => {
      [parts.tag, parts.h3, parts.p, parts.list, parts.cta].forEach((el) => el && card.appendChild(el));
      head.remove();
      foot.remove();
    });
    moved = null;
    wrap.removeAttribute("id");
    section.id = "features";
    document.body.classList.remove("tools-merged");
  };
  const apply = () => (mq.matches ? on() : off());
  apply();
  if (mq.addEventListener) mq.addEventListener("change", apply);
}
