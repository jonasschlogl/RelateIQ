// RelationshipAI: gentle life layer (no dependencies, never blocks content)
(function () {
  "use strict";
  var d = document, w = window, root = d.documentElement;
  var calm = w.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = w.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
  var $ = function (s, r) { return (r || d).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  function ready(f) { if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", f); else f(); }

  ready(function () {
    // 1. reading progress line
    var bar = d.createElement("div");
    bar.className = "alive-prog"; bar.setAttribute("aria-hidden", "true");
    d.body.appendChild(bar);
    var tick = false;
    function prog() {
      tick = false;
      var h = root.scrollHeight - w.innerHeight;
      bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, Math.max(0, w.scrollY / h)) : 0).toFixed(4) + ")";
    }
    w.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(prog); } }, { passive: true });
    prog();

    if (calm) return;
    root.classList.add("alive");

    // helpers
    function inView(el) { var r = el.getBoundingClientRect(); return r.top < w.innerHeight * 0.95 && r.bottom > 0; }
    var io = "IntersectionObserver" in w ? new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (!x.isIntersecting) return;
        io.unobserve(x.target);
        var t = x.target;
        t.classList.add("in");
        if (t._count) t._count();
        // hand the element back to its normal styles once the entrance is done
        var wait = 1300 + (parseFloat(t.style.getPropertyValue("--i")) || 0) * 110;
        if (t.classList.contains("av")) setTimeout(function () { t.classList.remove("av", "in"); t.style.removeProperty("--i"); }, wait);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }) : null;

    // 2. staggered entrance for groups
    var GROUPS = [
      ".apr-pts > *", ".apr-meth > *", ".compare-table tbody tr", ".trust-row > *",
      ".pricing-grid > *", ".post-grid > *", ".faq > *", ".mb-chips > *"
    ];
    GROUPS.forEach(function (sel) {
      var host = {};
      $$(sel).forEach(function (el) {
        var p = el.parentNode, k = host.p === p ? host.n + 1 : 0;
        host = { p: p, n: k };
        if (!io || (inView(el) && !d.body.classList.contains("gated"))) return;
        el.classList.add("av"); el.style.setProperty("--i", Math.min(k, 8));
        io.observe(el);
      });
    });

    // 3. headline words rise
    function split(el) {
      var n = 0;
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (c) {
          if (c.nodeType === 3) {
            var parts = c.nodeValue.split(/(\s+)/), f = d.createDocumentFragment();
            parts.forEach(function (t) {
              if (!t) return;
              if (/^\s+$/.test(t)) { f.appendChild(d.createTextNode(t)); return; }
              var s = d.createElement("span"); s.className = "aw"; s.textContent = t;
              s.style.setProperty("--w", n++); f.appendChild(s);
            });
            node.replaceChild(f, c);
          } else if (c.nodeType === 1 && c.tagName !== "BR") walk(c);
        });
      })(el);
    }
    var H = $$("#approach h2, #compare h2, #trust h2, #pricing h2, #blog h2, #faq h2, .hx-final h2, .hx-final .hx-grad");
    H.forEach(function (h) {
      if (h.querySelector(".aw")) return;
      split(h); h.classList.add("aw-h");
      if (io) io.observe(h);
      else h.classList.add("in");
    });
    // hero line one, on load
    var l1 = $(".hx-l1");
    if (l1) { split(l1); l1.classList.add("aw-h"); requestAnimationFrame(function () { l1.classList.add("in"); }); }

    // 4. prices count up
    $$(".price-value").forEach(function (pv) {
      var tn = null;
      for (var i = 0; i < pv.childNodes.length; i++) { if (pv.childNodes[i].nodeType === 3 && /\d/.test(pv.childNodes[i].nodeValue)) { tn = pv.childNodes[i]; break; } }
      if (!tn) return;
      var m = tn.nodeValue.match(/^(\D*)(\d+(?:[.,]\d+)?)(.*)$/s);
      if (!m) return;
      var dec = (m[2].split(/[.,]/)[1] || "").length, sep = m[2].indexOf(",") > -1 ? "," : ".", to = parseFloat(m[2].replace(",", "."));
      if (!to || !io) return;
      pv._count = function () {
        var t0 = null;
        (function step(n) {
          if (t0 === null) t0 = n;
          var p = Math.min(1, (n - t0) / 900), e = 1 - Math.pow(1 - p, 3);
          tn.nodeValue = m[1] + (to * e).toFixed(dec).replace(".", sep) + m[3];
          if (p < 1) requestAnimationFrame(step); else tn.nodeValue = m[1] + m[2] + m[3];
        })(performance.now());
      };
      pv.classList.add("cnt"); io.observe(pv);
    });

    // 5. nav: highlight the section you are in
    var links = $$("#links a[href^='#']").filter(function (a) { return !a.classList.contains("hx-btn"); });
    var map = links.map(function (a) { return { a: a, s: $(a.getAttribute("href")) }; }).filter(function (x) { return x.s; });
    var spy = false;
    function sp() {
      spy = false;
      var y = w.innerHeight * 0.38, cur = null;
      map.forEach(function (x) { var r = x.s.getBoundingClientRect(); if (r.height && r.top <= y && r.bottom > y) cur = x; });
      map.forEach(function (x) { x.a.classList.toggle("is-on", x === cur); });
    }
    if (map.length) { w.addEventListener("scroll", function () { if (!spy) { spy = true; requestAnimationFrame(sp); } }, { passive: true }); sp(); }

    if (!fine) return;

    // 6. hero phone leans toward the cursor
    var art = $(".hero-art .hero4"), hero = $(".hx-hero");
    if (art && hero) {
      art.style.transition = "transform .6s cubic-bezier(.2,.8,.2,1)";
      art.style.willChange = "transform";
      var raf = 0, tx = 0, ty = 0;
      hero.addEventListener("mousemove", function (e) {
        var r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5); ty = ((e.clientY - r.top) / r.height - 0.5);
        if (!raf) raf = requestAnimationFrame(function () {
          raf = 0;
          art.style.transform = "perspective(1400px) rotateY(" + (tx * 7).toFixed(2) + "deg) rotateX(" + (-ty * 5).toFixed(2) + "deg) translate3d(" + (tx * 10).toFixed(1) + "px," + (ty * 8).toFixed(1) + "px,0)";
        });
      });
      hero.addEventListener("mouseleave", function () { art.style.transform = ""; });
    }

    // 7. buttons lean toward the cursor
    $$(".hx-btn:not(.sm):not(.ghost), .xt-bub, .btn-ghost").forEach(function (b) {
      var rf = 0;
      b.addEventListener("mousemove", function (e) {
        var r = b.getBoundingClientRect(), x = (e.clientX - r.left - r.width / 2) / r.width, y = (e.clientY - r.top - r.height / 2) / r.height;
        if (!rf) rf = requestAnimationFrame(function () { rf = 0; b.style.translate = (x * 10).toFixed(1) + "px " + (y * 7).toFixed(1) + "px"; });
      });
      b.addEventListener("mouseleave", function () { var cur = b.style.translate || "0px 0px"; b.style.translate = ""; if (b.animate) b.animate([{ translate: cur }, { translate: "0px 0px" }], { duration: 300, easing: "cubic-bezier(.2,.8,.2,1)" }); });
    });

    // 8. soft light that follows the cursor on cards
    $$(".price-card, .post-card, .apr-pt, .trust-item, .faq-item").forEach(function (c) {
      c.classList.add("lit");
      c.addEventListener("mousemove", function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty("--lx", (e.clientX - r.left).toFixed(0) + "px");
        c.style.setProperty("--ly", (e.clientY - r.top).toFixed(0) + "px");
      });
    });
  });
})();
