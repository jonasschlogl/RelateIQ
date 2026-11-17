// "In action" stage: scroll (desktop) or tabs drive which example chat plays; bubbles arrive one by one with typing dots.
(function () {
  var sec = document.getElementById("why"); if (!sec) return;
  var rm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var tabs = [].slice.call(sec.querySelectorAll(".why-tabs button")), ind = sec.querySelector(".why-ind"), chats = [].slice.call(sec.querySelectorAll(".why-chat")),
      mark = sec.querySelector(".why-mark"), clover = sec.querySelector(".why-clover"), n = chats.length, root = document.documentElement;
  var cur = -1, timers = [], started = false, pinned = false;
  function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function stopAll() { timers.forEach(clearTimeout); timers = []; }
  function pulse() { if (!mark) return; mark.classList.remove("pulse"); void mark.offsetWidth; mark.classList.add("pulse"); }
  function moveInd() { var b = tabs[Math.max(0, cur)]; if (!b || !ind) return; ind.style.width = b.offsetWidth + "px"; ind.style.transform = "translateX(" + b.offsetLeft + "px)"; var bar = b.parentNode; if (bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2, behavior: "smooth" }); }
  function play(i) {
    var c = chats[i], rows = [].slice.call(c.querySelectorAll(".wr"));
    rows.forEach(function (r) { r.querySelector(".wb").classList.remove("on"); var d = r.querySelector(".dots"); if (d) d.classList.remove("on"); });
    if (rm) { rows.forEach(function (r) { r.querySelector(".wb").classList.add("on"); }); return; }
    var t = 350;
    rows.forEach(function (r) {
      var b = r.querySelector(".wb"), d = r.querySelector(".dots"), len = b.textContent.length;
      if (d) { later(t, function () { d.classList.add("on"); pulse(); }); t += 900; later(t, function () { d.classList.remove("on"); b.classList.add("on"); pulse(); }); t += 900 + len * 16; }
      else { later(t, function () { b.classList.add("on"); }); t += 600 + len * 10; }
    });
  }
  function set(i, force) {
    if (i === cur && !force) return;
    var prev = cur; cur = i; stopAll();
    if (prev >= 0 && prev !== i) { [].slice.call(chats[prev].querySelectorAll(".wb,.dots")).forEach(function (x) { x.classList.remove("on"); }); }
    chats.forEach(function (c, k) { c.classList.toggle("is-on", k === i); });
    tabs.forEach(function (b, k) { b.setAttribute("aria-selected", k === i ? "true" : "false"); });
    if (clover) clover.style.setProperty("--r", (i * 90) + "deg");
    moveInd();
    if (started) later(prev >= 0 && prev !== i ? 280 : 0, function () { play(i); });
  }
  function on() { return !rm && innerWidth > 900; }
  function layout() {
    var yes = on(); pinned = yes; root.classList.toggle("why-pin", yes);
    sec.style.height = yes ? Math.round(innerHeight * (1 + (n - 1) * .72)) + "px" : "";
    moveInd();
  }
  function scroll() {
    if (!pinned) return;
    var r = sec.getBoundingClientRect(), span = sec.offsetHeight - innerHeight, p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    set(Math.min(n - 1, Math.floor(p * n * .9999)));
  }
  tabs.forEach(function (b, i) {
    b.addEventListener("click", function () {
      if (pinned) {
        var span = sec.offsetHeight - innerHeight, y = sec.getBoundingClientRect().top + scrollY + ((i + .5) / n) * span;
        scrollTo({ top: y, behavior: "smooth" });
      } else { started = true; set(i, true); }
    });
  });
  function start() { if (started) return; started = true; play(Math.max(0, cur)); }
  if ("IntersectionObserver" in window) new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting) { o.disconnect(); start(); } }); }, { threshold: .4 }).observe(sec.querySelector(".why-mid"));
  else start();
  addEventListener("resize", function () { layout(); scroll(); });
  addEventListener("scroll", scroll, { passive: true });
  addEventListener("load", function () { layout(); scroll(); });
  layout(); set(0, true); scroll();
})();
