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
  initHeroSignup();
  initMobileLayout();
  initMobileLayout2();
  initMobileTools();
  initMobilePricing();
  initLangSwitch();
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

// Translations: localized pages define window.RAI_T = { "English text": "Translated text" }.
// Any text that has no translation simply stays English.
const T = (k) => (window.RAI_T && window.RAI_T[k]) || k;

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
    '<h2 id="soon-title">' + T("We open soon. Want a heads-up?") + '</h2>' +
    '<div id="soon-ask">' +
    '<p class="dialog-message" style="margin-top:10px;">' + T("RelationshipAI isn't open just yet. Leave your email and we'll write to you once, the day it opens. Your click already helps us decide how fast to open.") + '</p>' +
    '<form id="soon-form" class="soon-form" novalidate>' +
    '<label class="soon-sr" for="soon-email">' + T("Email address") + '</label>' +
    '<input type="email" id="soon-email" name="email" class="soon-input" placeholder="you@example.com" autocomplete="email" inputmode="email" maxlength="254" required />' +
    '<input type="text" id="soon-website" name="website" class="soon-hp" tabindex="-1" autocomplete="off" aria-hidden="true" />' +
    '<button type="submit" class="btn btn-gradient" id="soon-submit">' + T("Notify me") + '</button>' +
    '<p class="soon-error" id="soon-error" role="alert" hidden></p>' +
    '<p class="soon-fine">' + T('One email when we open. No spam. See our <a href="/privacy.html">privacy notice</a>.') + '</p>' +
    "</form></div>" +
    '<div id="soon-done" hidden><p class="dialog-message" style="margin-top:10px;">' + T("<strong>You're on the list.</strong> We'll email you once, when RelationshipAI opens. Thank you for being early.") + '</p></div>' +
    '<div class="modal-close-row"><button type="button" class="btn btn-ghost" id="soon-close">' + T("Not now") + '</button></div>' +
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
    $("soon-title").textContent = T("Thank you");
    $("soon-close").textContent = T("Close");
  };
  const showAsk = () => {
    $("soon-ask").hidden = false;
    $("soon-done").hidden = true;
    $("soon-title").textContent = T("We open soon. Want a heads-up?");
    $("soon-close").textContent = T("Not now");
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
      showError(T("Please enter a valid email address."));
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
      showError(T("Sorry, that didn't go through. Please try again in a moment."));
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
      errEl.textContent = T("Please enter a valid email address.");
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
      errEl.textContent = T("Sorry, that didn't go through. Please try again in a moment.");
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
      compareTabs.innerHTML = '<button type="button" role="tab" data-vs="bot">' + T("vs. AI chatbot") + '</button><button type="button" role="tab" data-vs="therapy">' + T("vs. couples therapy") + '</button>';
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
        counter.textContent = (best + 1) + " / " + items.length + "  ·  " + T("swipe");
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
        faqBtn.textContent = T("Show all {n} questions").replace("{n}", items.length);
        faq.insertAdjacentElement("afterend", faqBtn);
        faqBtn.addEventListener("click", () => {
          const open = faq.classList.toggle("faq-open");
          faqBtn.textContent = open ? T("Show fewer questions") : T("Show all {n} questions").replace("{n}", items.length);
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

// Language menu (a plain <details>): close it when the visitor clicks elsewhere or presses Escape.
function initLangSwitch() {
  const menus = Array.from(document.querySelectorAll("details.lang-switch"));
  if (!menus.length) return;
  document.addEventListener("click", (e) => {
    menus.forEach((m) => { if (m.open && !m.contains(e.target)) m.open = false; });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") menus.forEach((m) => { if (m.open) { m.open = false; const s = m.querySelector("summary"); if (s) s.focus(); } });
  });
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

// Mobile pricing: plans are stacked and compact, so all three are visible at once.
// The long feature list of each plan is folded away behind a "What's included" button.
function initMobilePricing() {
  const mq = window.matchMedia("(max-width: 700px)");
  const grid = document.querySelector(".pricing-grid");
  if (!grid) return;
  const tr = (k) => (typeof T === "function" ? T(k) : k);
  const cards = Array.from(grid.querySelectorAll(".price-card"));
  let built = false;

  const label = (btn, open) => {
    btn.querySelector("span").textContent = open ? tr("Hide details") : tr("What's included");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  };
  const on = () => {
    if (built) return;
    built = true;
    cards.forEach((card, i) => {
      const list = card.querySelector(".price-features");
      if (!list) return;
      list.id = list.id || "plan-features-" + i;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "price-toggle";
      btn.setAttribute("aria-controls", list.id);
      btn.innerHTML = '<span></span><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
      label(btn, false);
      btn.addEventListener("click", () => {
        const open = card.classList.toggle("is-open");
        label(btn, open);
      });
      list.insertAdjacentElement("beforebegin", btn);
    });
  };
  const off = () => {
    if (!built) return;
    built = false;
    cards.forEach((card) => {
      card.classList.remove("is-open");
      const b = card.querySelector(".price-toggle");
      if (b) b.remove();
    });
  };
  const apply = () => (mq.matches ? on() : off());
  apply();
  if (mq.addEventListener) mq.addEventListener("change", apply);
}

// Blog articles: highlight the current section in the table of contents, and copy-link button.
(function () {
  const toc = document.querySelector(".toc");
  const heads = Array.from(document.querySelectorAll(".article-body h2[id]"));
  if (toc && heads.length && "IntersectionObserver" in window) {
    const links = new Map(Array.from(toc.querySelectorAll("a")).map((a) => [a.getAttribute("href").slice(1), a]));
    let current = null;
    const set = (id) => {
      if (id === current || !links.has(id)) return;
      current = id;
      links.forEach((a, k) => a.classList.toggle("active", k === id));
      const a = links.get(id), list = a.closest("ol");
      if (list && a.offsetTop < list.scrollTop || a.offsetTop + a.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = a.offsetTop - 40;
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) set(e.target.id); });
    }, { rootMargin: "-90px 0px -65% 0px", threshold: 0 });
    heads.forEach((h) => io.observe(h));
    set(heads[0].id);
  }
  document.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const url = btn.getAttribute("data-copy");
      try { await navigator.clipboard.writeText(url); }
      catch (e) { const t = document.createElement("textarea"); t.value = url; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); } catch (_) {} t.remove(); }
      btn.classList.add("copied");
      setTimeout(() => btn.classList.remove("copied"), 1800);
    });
  });
})();
