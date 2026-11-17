// Experts + early testers on one sticky stage, scroll-driven (desktop only; elsewhere they stack).
// Each panel owns a slice of the scroll: items rise in one by one; the testimonials drift up in three columns.
(function () {
  var sec = document.getElementById("proof"); if (!sec) return;
  var rm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var panels = [].slice.call(sec.querySelectorAll(".px-panel")), tabs = [].slice.call(sec.querySelectorAll(".why-tabs button")), ind = sec.querySelector(".why-ind"),
      exCards = [].slice.call(sec.querySelectorAll(".ex-card")),
      tsGrid = sec.querySelector(".ts-grid"), tsCards = [].slice.call(sec.querySelectorAll(".ts-card")), tsOrder = tsCards.slice(), cols = [],
      root = document.documentElement, cur = -1, pinned = false, geo = null, TOTAL = 5.2,
      R = [[0, .22], [.22, .5], [.5, 1]], TARGET = [.2, .46, .88];
  function on() { return !rm && innerWidth > 900; }
  var sm = function (x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  function moveInd() { var b = tabs[Math.max(0, cur)]; if (!b || !ind) return; ind.style.width = b.offsetWidth + "px"; ind.style.transform = "translateX(" + b.offsetLeft + "px)"; }
  function setPanel(i) {
    if (i === cur) return; cur = i;
    panels.forEach(function (p, k) {
      p.classList.toggle("is-on", k === i); p.classList.toggle("is-past", k < i);
      if (pinned && k !== i) { p.setAttribute("inert", ""); p.setAttribute("aria-hidden", "true"); } else { p.removeAttribute("inert"); p.removeAttribute("aria-hidden"); }
    });
    tabs.forEach(function (b, k) { b.setAttribute("aria-selected", k === i ? "true" : "false"); });
    moveInd();
  }
  function mountCols() {
    if (cols.length || !tsGrid) return;
    for (var c = 0; c < 3; c++) { var d = document.createElement("div"); d.className = "px-col"; tsGrid.appendChild(d); cols.push(d); }
    tsOrder.forEach(function (li, i) { cols[i % 3].appendChild(li); });
  }
  function unmountCols() {
    if (!cols.length) return;
    tsOrder.forEach(function (li) { li.style.opacity = ""; li.style.scale = ""; tsGrid.appendChild(li); });
    cols.forEach(function (d) { d.remove(); }); cols = [];
  }
  function measure() {
    if (!tsGrid || !cols.length || !tsGrid.clientHeight) { geo = null; return; }
    cols.forEach(function (d) { d.style.translate = ""; });
    geo = { view: tsGrid.clientHeight, colH: cols.map(function (d) { return d.offsetHeight; }), tops: tsOrder.map(function (c) { return c.offsetTop; }), hs: tsOrder.map(function (c) { return c.offsetHeight; }) };
  }
  var words = null;
  function lit(q) {
    if (!words || !words.length) words = [].slice.call(sec.querySelectorAll("#manifesto .lw")); var n = words.length; if (!n) return;
    var t = Math.min(1, Math.max(0, (q - .06) / .78)), k = Math.ceil(t * n);
    words.forEach(function (w, i) { w.classList.toggle("on", i < k); });
  }
  function clearInline() { exCards.forEach(function (c) { c.style.removeProperty("--a"); }); }
  function rise(items, lp, step) { items.forEach(function (c, k) { c.style.setProperty("--a", sm((lp / .9 - (.05 + k * step)) / .22).toFixed(3)); }); }
  function lp(p, i) { return Math.min(1, Math.max(0, (p - R[i][0]) / (R[i][1] - R[i][0]))); }
  function frame(p) {
    lit(lp(p, 0));
    rise(exCards, lp(p, 1), .15);
    // testers: three columns drift up (staggered start); every column ends with its last card in view
    if (!geo) measure(); if (!geo) return;
    var q = Math.min(1, Math.max(0, (p - (R[2][0] - .04)) / (1 - (R[2][0] - .04)))), V = geo.view, dys = cols.map(function (d, c) {
      var start = V * (.62 + c * .2), end = Math.min(0, V - geo.colH[c] - 4), dy = start + (end - start) * q; d.style.translate = "0 " + dy.toFixed(1) + "px"; return dy;
    });
    tsOrder.forEach(function (c, i) {
      var top = geo.tops[i] + dys[i % 3], h = geo.hs[i], v = Math.min(sm((V - top) / (h * .7)), sm((top + h) / (h * .55)));
      c.style.opacity = v.toFixed(3); c.style.scale = (.94 + .06 * v).toFixed(3);
    });
  }
  function scroll() {
    if (!pinned) return;
    var r = sec.getBoundingClientRect(), span = sec.offsetHeight - innerHeight, p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    setPanel(p < R[0][1] + .015 ? 0 : p < R[1][1] + .015 ? 1 : 2); frame(p);
  }
  function layout() {
    var yes = on(); panels = [].slice.call(sec.querySelectorAll(".px-panel")); pinned = yes; root.classList.toggle("px-pin", yes);
    sec.style.height = yes ? Math.round(innerHeight * TOTAL) + "px" : "";
    geo = null; if (yes) mountCols(); else unmountCols();
    if (!yes) { clearInline(); cur = -1; panels.forEach(function (p) { p.removeAttribute("inert"); p.removeAttribute("aria-hidden"); p.classList.remove("is-past"); p.classList.add("is-on"); }); tabs.forEach(function (b, k) { b.setAttribute("aria-selected", k === 0 ? "true" : "false"); }); return; }
    cur = -1; setPanel(0); moveInd();
  }
  function goPanel(i, instant) {
    var span = sec.offsetHeight - innerHeight, y = sec.getBoundingClientRect().top + scrollY + TARGET[i] * span;
    scrollTo({ top: y, behavior: instant ? "instant" : "smooth" });
  }
  tabs.forEach(function (b, i) { b.addEventListener("click", function () { if (pinned) goPanel(i); }); });
  // links to the panels (nav "Our approach", etc.) should land on the right slice of the stage
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || !pinned) return;
    var a = e.target.closest && e.target.closest('a[href="#manifesto"], a[href="#experts"], a[href="#testers"]'); if (!a) return;
    var i = ["#manifesto", "#experts", "#testers"].indexOf(a.getAttribute("href")); if (i < 0) return;
    e.preventDefault(); goPanel(i);
  });
  addEventListener("resize", function () { layout(); scroll(); });
  addEventListener("scroll", scroll, { passive: true });
  addEventListener("load", function () { layout(); scroll(); });
  layout(); scroll();
})();
