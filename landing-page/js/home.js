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


  // rotating hero headline
  var rots = $$(".hx-rot em");
  if (rots.length > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var ri = 0;
    setInterval(function () {
      rots[ri].classList.remove("on");
      ri = (ri + 1) % rots.length;
      rots[ri].classList.add("on");
    }, 2800);
  }

  // interactive example: situation x tone
  var DEMO = [
    { d: "You always forget. I guess I'm just not important to you.", r: "May land as blame",
      calm: ["I felt hurt when this slipped. Can we talk about what happened?", "Names the feeling instead of the verdict."],
      warm: ["I know life is busy, and I still want to feel like a priority to you.", "Opens with understanding, then states the need."],
      direct: ["This matters to me. What can we do so it doesn't slip again?", "Clear ask, no accusation."] },
    { d: "Fine. Don't answer then. I'm done trying.", r: "Sounds like an ultimatum",
      calm: ["I notice we've gone quiet. I'd like to understand what's going on for you.", "Invites them in instead of pushing them away."],
      warm: ["I miss you. No pressure, I'm here whenever you want to talk.", "Removes the pressure so they can come closer."],
      direct: ["Can we set a time tonight to talk? I'd rather sort it than guess.", "One concrete step instead of a threat."] },
    { d: "I do everything around here and you don't even notice.", r: "May land as blame",
      calm: ["I feel overwhelmed with the house lately. Can we split it differently?", "Starts from how you feel, then proposes a fix."],
      warm: ["I appreciate you, and I need more help to feel like a team.", "Leads with appreciation so it is easier to hear."],
      direct: ["Let's make a list and divide it this weekend.", "Turns the complaint into a plan."] },
    { d: "Who were you texting all night?", r: "Sounds like an interrogation",
      calm: ["I felt a bit insecure tonight. Can we talk about it?", "Shares the real feeling under the question."],
      warm: ["I love spending time with you, and I missed you tonight.", "Says what you want, not what you suspect."],
      direct: ["I got uneasy seeing that. Can you help me understand what happened?", "Honest and specific, without accusing."] }
  ];
  var dmBox = $("#demo-box");
  if (dmBox) {
    var dmI = 0, dmT = "calm";
    var elDraft = $("#dm-draft"), elRisk = $("#dm-risk"), elFix = $("#dm-fix"), elWhy = $("#dm-why");
    var swap = function (el, txt) {
      el.classList.add("dm-swap");
      setTimeout(function () { el.textContent = txt; el.classList.remove("dm-swap"); }, 200);
    };
    var render = function (animate) {
      var x = DEMO[dmI], f = x[dmT];
      if (animate) { swap(elDraft, x.d); swap(elFix, f[0]); } else { elDraft.textContent = x.d; elFix.textContent = f[0]; }
      elRisk.textContent = "\u25CF " + x.r; elWhy.textContent = f[1];
    };
    $$(".dm-pick button", dmBox).forEach(function (b) {
      b.addEventListener("click", function () {
        dmI = +b.dataset.i;
        $$(".dm-pick button", dmBox).forEach(function (o) { o.classList.toggle("on", o === b); });
        render(true);
      });
    });
    $$(".dm-tone button", dmBox).forEach(function (b) {
      b.addEventListener("click", function () {
        dmT = b.dataset.t;
        $$(".dm-tone button", dmBox).forEach(function (o) { o.classList.toggle("on", o === b); });
        render(true);
      });
    });
    render(false);
  }


  // quiz: how do you handle conflict
  var qzBody = $("#qz-body");
  if (qzBody) {
    var QS = [
      ["After an argument, you usually...", ["Need to talk it out right now", "Need space before I can talk", "Wait a bit, then bring it up calmly"]],
      ["Your partner replies slowly. You...", ["Start wondering what's wrong", "Barely notice, I'm busy with my own things", "Assume they're busy and carry on"]],
      ["When something bothers you, you...", ["Say it fast, sometimes too intensely", "Keep it in until it fades or explodes", "Pick a good moment and say it"]],
      ["In a hard talk, you fear most...", ["Being left or ignored", "Being controlled or overwhelmed", "Not being understood"]]
    ];
    var RES = {
      p: ["The Pursuer", "You move toward conflict to feel safe again. You care deeply and you speak up, which is a real strength.", "Urgent messages sent at 11pm can feel like pressure to the other person.", "Pause for 20 minutes, run your message through Message check, then send it."],
      w: ["The Withdrawer", "You go quiet to stay calm. You rarely escalate, and you think before you react.", "Silence can feel like distance or punishment to your partner.", "Say \"I need an hour, then let's talk\" instead of disappearing."],
      s: ["The Steady One", "You can stay calm and say what you mean. You make it feel safe to be honest.", "Don't assume the other person can do the same under stress.", "Rehearse the hard conversation first with Partner Practice, so it goes even better."]
    };
    var qi = 0, sc = { p: 0, w: 0, s: 0 }, prog = $("#qz-prog");
    var showQ = function () {
      prog.style.width = (qi / QS.length * 100) + "%";
      var q = QS[qi];
      qzBody.innerHTML = "";
      var st = document.createElement("div"); st.className = "qz-step"; st.textContent = "Question " + (qi + 1) + " of " + QS.length;
      var h = document.createElement("p"); h.className = "qz-q"; h.textContent = q[0];
      var o = document.createElement("div"); o.className = "qz-opts";
      q[1].forEach(function (t, k) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = t;
        b.addEventListener("click", function () {
          sc["pws"[k]]++; qi++;
          if (qi < QS.length) showQ(); else showR();
        });
        o.appendChild(b);
      });
      qzBody.appendChild(st); qzBody.appendChild(h); qzBody.appendChild(o);
    };
    var showR = function () {
      prog.style.width = "100%";
      var k = "s"; if (sc.p > sc.w && sc.p > sc.s) k = "p"; else if (sc.w > sc.p && sc.w > sc.s) k = "w";
      var r = RES[k];
      qzBody.innerHTML = "";
      var d = document.createElement("div"); d.className = "qz-res";
      d.innerHTML = '<div class="qz-step">Your pattern</div><h3 class="hx-grad"></h3><p class="a"></p><p class="b"><b>Watch for:</b> </p><div class="qz-try"><b>Try this:</b> </div><div class="qz-acts"><a href="#join" class="hx-btn" data-umami-event="cta-quiz">Get a coach that gets your style</a><button type="button" class="again">Retake the quiz</button></div>';
      d.querySelector("h3").textContent = r[0]; d.querySelector(".a").textContent = r[1];
      d.querySelector(".b").appendChild(document.createTextNode(r[2]));
      d.querySelector(".qz-try").appendChild(document.createTextNode(r[3]));
      d.querySelector(".again").addEventListener("click", function () { qi = 0; sc = { p: 0, w: 0, s: 0 }; showQ(); });
      qzBody.appendChild(d);
      try { if (window.umami && window.umami.track) window.umami.track("quiz-complete", { result: k }); } catch (_) {}
    };
    showQ();
  }

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

// page motion: staggered groups, parallax, scroll progress (decorative only)
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  var root = document.documentElement;
  // scroll progress bar
  var bar = document.createElement("div"); bar.className = "sp"; bar.setAttribute("aria-hidden", "true"); document.body.appendChild(bar);
  var tick = false;
  function frame() {
    tick = false;
    var y = window.scrollY || 0, h = Math.max(1, root.scrollHeight - window.innerHeight);
    root.style.setProperty("--sy", y.toFixed(0));
    bar.style.transform = "scaleX(" + Math.min(1, y / h).toFixed(4) + ")";
  }
  window.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(frame); } }, { passive: true });
  frame();
  // staggered children when a group scrolls into view
  var groups = [".more-grid", ".trust-row", ".pricing-grid", ".post-grid", ".faq", ".tool-cards", ".pricing-assurances", ".more-also"];
  var els = [];
  groups.forEach(function (g) {
    [].forEach.call(document.querySelectorAll(g), function (c) {
      [].forEach.call(c.children, function (k, i) { k.classList.add("stg"); k.style.setProperty("--i", i); });
      els.push(c);
    });
  });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("stg-in"); io.unobserve(x.target); } });
    }, { threshold: 0.1, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (e) { io.observe(e); });
  } else { els.forEach(function (e) { e.classList.add("stg-in"); }); }
})();
