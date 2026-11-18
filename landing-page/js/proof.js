// Our promise + experts + privacy on one sticky stage, scroll-driven (desktop only; elsewhere they stack and Privacy returns to its accordion).
// Each panel owns a slice of the scroll: the statement lights up word by word, the expert and privacy cards rise in one by one.
(function () {
  var sec = document.getElementById("proof"); if (!sec) return;
  var rm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var pnl = sec.querySelector(".px-panels"), trust = document.getElementById("trust"), cmp = document.getElementById("compare"),
      tabs = [].slice.call(sec.querySelectorAll(".why-tabs button")), ind = sec.querySelector(".why-ind"),
      exCards = [].slice.call(sec.querySelectorAll(".ex-card")), trItems = trust ? [].slice.call(trust.querySelectorAll(".trust-item")) : [], words = null,
      root = document.documentElement, cur = -1, pinned = false, TOTAL = 4.4,
      R = [[0, .26], [.26, .62], [.62, 1]], TARGET = [.22, .56, .94];
  function on() { return !rm && innerWidth > 900; }
  var sm = function (x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  function panels() { return [].slice.call(sec.querySelectorAll(".px-panel")); }
  function moveInd() { var b = tabs[Math.max(0, cur)]; if (!b || !ind) return; ind.style.width = b.offsetWidth + "px"; ind.style.transform = "translateX(" + b.offsetLeft + "px)"; }
  function setPanel(i) {
    if (i === cur) return; cur = i;
    panels().forEach(function (p, k) {
      p.classList.toggle("is-on", k === i); p.classList.toggle("is-past", k < i);
      if (pinned && k !== i) { p.setAttribute("inert", ""); p.setAttribute("aria-hidden", "true"); } else { p.removeAttribute("inert"); p.removeAttribute("aria-hidden"); }
    });
    tabs.forEach(function (b, k) { b.setAttribute("aria-selected", k === i ? "true" : "false"); });
    moveInd();
  }
  /* desktop: Privacy is the third panel of the stage. Below 900px / reduced motion it returns to its own place (accordion) after "How it compares". */
  function place(yes) {
    if (!trust || !pnl) return;
    if (yes) { if (trust.parentNode !== pnl) pnl.appendChild(trust); trust.classList.add("px-panel"); }
    else { if (trust.parentNode === pnl && cmp) cmp.parentNode.insertBefore(trust, cmp.nextSibling); trust.classList.remove("px-panel", "is-on", "is-past"); trust.removeAttribute("inert"); trust.removeAttribute("aria-hidden"); }
  }
  function lit(q) {
    if (!words || !words.length) words = [].slice.call(sec.querySelectorAll("#manifesto .lw")); var n = words.length; if (!n) return;
    var t = Math.min(1, Math.max(0, (q - .06) / .78)), k = Math.ceil(t * n);
    words.forEach(function (w, i) { w.classList.toggle("on", i < k); });
  }
  function clearInline() { exCards.concat(trItems).forEach(function (c) { c.style.removeProperty("--a"); }); }
  function rise(items, lp, step) { items.forEach(function (c, k) { c.style.setProperty("--a", sm((lp / .9 - (.05 + k * step)) / .22).toFixed(3)); }); }
  function lp(p, i) { return Math.min(1, Math.max(0, (p - R[i][0]) / (R[i][1] - R[i][0]))); }
  function frame(p) { lit(lp(p, 0)); rise(exCards, lp(p, 1), .15); rise(trItems, lp(p, 2), .2); }
  function scroll() {
    if (!pinned) return;
    var r = sec.getBoundingClientRect(), span = sec.offsetHeight - innerHeight, p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    setPanel(p < R[0][1] + .015 ? 0 : p < R[1][1] + .015 ? 1 : 2); frame(p);
  }
  function layout() {
    var yes = on(); place(yes); pinned = yes; root.classList.toggle("px-pin", yes);
    sec.style.height = yes ? Math.round(innerHeight * TOTAL) + "px" : "";
    if (!yes) { clearInline(); cur = -1; panels().forEach(function (p) { p.removeAttribute("inert"); p.removeAttribute("aria-hidden"); p.classList.remove("is-past"); p.classList.add("is-on"); }); tabs.forEach(function (b, k) { b.setAttribute("aria-selected", k === 0 ? "true" : "false"); }); return; }
    cur = -1; setPanel(0); moveInd();
  }
  function goPanel(i, instant) {
    var span = sec.offsetHeight - innerHeight, y = sec.getBoundingClientRect().top + scrollY + TARGET[i] * span;
    scrollTo({ top: y, behavior: instant ? "instant" : "smooth" });
  }
  tabs.forEach(function (b, i) { b.addEventListener("click", function () { if (pinned) goPanel(i); }); });
  // links to the panels should land on the right slice of the stage
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || !pinned) return;
    var a = e.target.closest && e.target.closest('a[href="#manifesto"], a[href="#experts"], a[href="#trust"]'); if (!a) return;
    var i = ["#manifesto", "#experts", "#trust"].indexOf(a.getAttribute("href")); if (i < 0) return;
    e.preventDefault(); goPanel(i);
  });
  addEventListener("resize", function () { layout(); scroll(); });
  addEventListener("scroll", scroll, { passive: true });
  addEventListener("load", function () { layout(); scroll(); });
  layout(); scroll();
})();
