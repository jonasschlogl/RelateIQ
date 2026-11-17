// Experts + early testers on one sticky stage. Scroll (or tabs) swaps the panels. Desktop only; elsewhere they stack.
(function () {
  var sec = document.getElementById("proof"); if (!sec) return;
  var rm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var panels = [].slice.call(sec.querySelectorAll(".px-panel")), tabs = [].slice.call(sec.querySelectorAll(".why-tabs button")), ind = sec.querySelector(".why-ind"),
      box = sec.querySelector(".px-panels"), n = panels.length, root = document.documentElement, cur = -1, pinned = false, fitted = false;
  function on() { return !rm && innerWidth > 900; }
  function moveInd() { var b = tabs[Math.max(0, cur)]; if (!b || !ind) return; ind.style.width = b.offsetWidth + "px"; ind.style.transform = "translateX(" + b.offsetLeft + "px)"; }
  function fit() {
    var a = box.clientHeight - 12; if (a < 200) return false;
    panels.forEach(function (p) { p.style.zoom = ""; var h = p.offsetHeight; if (h > a) p.style.zoom = (a / h).toFixed(3); });
    return true;
  }
  function set(i, force) {
    if (i === cur && !force) return; cur = i;
    panels.forEach(function (p, k) {
      p.classList.toggle("is-on", k === i); p.classList.toggle("is-past", k < i);
      if (pinned && k !== i) { p.setAttribute("inert", ""); p.setAttribute("aria-hidden", "true"); } else { p.removeAttribute("inert"); p.removeAttribute("aria-hidden"); }
    });
    tabs.forEach(function (b, k) { b.setAttribute("aria-selected", k === i ? "true" : "false"); });
    moveInd();
  }
  function layout() {
    var yes = on(); pinned = yes; root.classList.toggle("px-pin", yes);
    sec.style.height = yes ? Math.round(innerHeight * (1 + (n - 1) * .85)) + "px" : "";
    fitted = false;
    if (!yes) { panels.forEach(function (p) { p.style.zoom = ""; p.removeAttribute("inert"); p.removeAttribute("aria-hidden"); p.classList.remove("is-past"); p.classList.add("is-on"); }); return; }
    set(cur < 0 ? 0 : cur, true); moveInd();
  }
  function scroll() {
    if (!pinned) return;
    if (!fitted && box.clientHeight > 0) fitted = fit();
    var r = sec.getBoundingClientRect(), span = sec.offsetHeight - innerHeight, p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    set(Math.min(n - 1, Math.floor(p * n * .9999)));
  }
  tabs.forEach(function (b, i) {
    b.addEventListener("click", function () {
      if (!pinned) return;
      var span = sec.offsetHeight - innerHeight, y = sec.getBoundingClientRect().top + scrollY + ((i + .5) / n) * span;
      scrollTo({ top: y, behavior: "smooth" });
    });
  });
  addEventListener("resize", function () { layout(); scroll(); });
  addEventListener("scroll", scroll, { passive: true });
  addEventListener("load", function () { layout(); scroll(); });
  layout(); scroll();
})();
