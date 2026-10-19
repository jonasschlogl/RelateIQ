// RelationshipAI home page behaviour (no dependencies).
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // nav: solid background after scrolling, mobile menu
  var nav = $("#nav"), burger = $("#burger"), links = $("#links");
  function onScroll() {
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 24);
    var st = $("#sticky"), hero = $(".hx-hero"), join = $("#join");
    if (st && hero && join) {
      var past = window.scrollY > hero.offsetHeight * 0.8;
      var jr = join.getBoundingClientRect();
      var inJoin = jr.top < window.innerHeight * 0.85;
      st.classList.toggle("show", past && !inJoin);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (burger && links) {
    burger.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    $$("a", links).forEach(function (a) { a.addEventListener("click", function () { links.classList.remove("open"); }); });
  }

  // language menu closes on outside click / Escape
  var menus = $$("details.lang-switch");
  document.addEventListener("click", function (e) { menus.forEach(function (m) { if (m.open && !m.contains(e.target)) m.open = false; }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") menus.forEach(function (m) { m.open = false; }); });

  // reveal on scroll
  var revealEls = $$(".hx-reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else { revealEls.forEach(function (el) { el.classList.add("in"); }); }

  // hero phone: tabs that rotate by themselves until the visitor clicks one
  var tbtns = $$(".hx-tabs button"), pans = $$(".hx-pan"), cur = 0, auto = null;
  function showPan(i) {
    cur = i;
    tbtns.forEach(function (b, k) { b.classList.toggle("on", k === i); b.setAttribute("aria-selected", k === i ? "true" : "false"); });
    pans.forEach(function (p, k) {
      var on = k === i;
      p.classList.remove("on");
      if (on) { void p.offsetWidth; p.classList.add("on"); }
    });
  }
  function startAuto() { stopAuto(); auto = setInterval(function () { showPan((cur + 1) % pans.length); }, 7500); }
  function stopAuto() { if (auto) { clearInterval(auto); auto = null; } }
  tbtns.forEach(function (b, i) { b.addEventListener("click", function () { showPan(i); stopAuto(); }); });
  if (tbtns.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) startAuto();

  // pricing: monthly / yearly
  var billing = "yearly";
  var bbtns = $$(".billing-btn");
  function applyBilling(mode) {
    billing = mode;
    bbtns.forEach(function (b) {
      var on = b.dataset.billing === mode;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    $$(".amt[data-monthly], .price-billed[data-monthly]").forEach(function (el) { el.textContent = el.dataset[mode]; });
    $$("[data-plan]").forEach(function (el) { el.setAttribute("data-umami-event-billing", mode); });
  }
  bbtns.forEach(function (b) { b.addEventListener("click", function () { applyBilling(b.dataset.billing); }); });
  if (bbtns.length) applyBilling("yearly");

  // plan buttons remember the plan, then the page scrolls to the final form
  var chosenPlan = "";
  $$("[data-plan]").forEach(function (a) {
    a.addEventListener("click", function () {
      chosenPlan = a.getAttribute("data-plan") || "";
      setTimeout(function () { var i = $("#join-email"); if (i) i.focus({ preventScroll: true }); }, 700);
    });
  });
  $$('a[href="#join"]').forEach(function (a) {
    a.addEventListener("click", function () {
      if (!a.hasAttribute("data-plan")) chosenPlan = "";
      setTimeout(function () { var i = $("#join-email"); if (i) i.focus({ preventScroll: true }); }, 700);
    });
  });

  // email forms (hero + final) -> POST /api/subscribe
  var loadedAt = Date.now();
  var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function showAllDone() {
    ["hero", "join"].forEach(function (id) {
      var f = $("#" + id + "-form"), d = $("#" + id + "-done"), e = $("#" + id + "-error");
      if (f) f.hidden = true; if (e) e.hidden = true; if (d) d.hidden = false;
      var n = f && f.parentNode.querySelector(".hx-note"); if (n && id === "hero") n.hidden = true;
    });
  }
  try { if (localStorage.getItem("rai_waitlist") === "1") showAllDone(); } catch (_) {}

  $$(".hx-form").forEach(function (form) {
    var id = form.id.replace("-form", "");
    var email = $("#" + id + "-email"), hp = $("#" + id + "-website"), err = $("#" + id + "-error"), btn = $("button", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.hidden = true;
      var v = email.value.trim();
      if (!emailRe.test(v) || v.length > 254) {
        err.textContent = "Please enter a valid email address.";
        err.hidden = false; email.focus(); return;
      }
      var label = btn.textContent;
      btn.disabled = true; btn.textContent = "Saving...";
      var plan = id === "join" ? chosenPlan : "";
      fetch("/api/subscribe", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: v, source: form.dataset.source, plan: plan, billing: plan ? billing : "", website: hp.value, t: Date.now() - loadedAt })
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || !d.ok) throw new Error("x"); }); })
        .then(function () {
          try { localStorage.setItem("rai_waitlist", "1"); } catch (_) {}
          try { if (window.umami && window.umami.track) window.umami.track("waitlist-signup", { source: form.dataset.source, plan: plan }); } catch (_) {}
          showAllDone();
        })
        .catch(function () { err.textContent = "Sorry, that didn't go through. Please try again in a moment."; err.hidden = false; })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  });
})();
