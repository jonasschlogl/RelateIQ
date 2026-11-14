/* Home page v2: rotating headline, demo chat, reveal on scroll */
(function () {
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var rot = document.querySelectorAll(".pp-rot em"), ri = 0;
  if (rot.length > 1 && !reduce) setInterval(function () { rot[ri].classList.remove("on"); ri = (ri + 1) % rot.length; rot[ri].classList.add("on"); }, 2200);

  var demo = document.getElementById("pc-demo");
  if (demo) {
    var items = [].slice.call(demo.children);
    var delays = [300, 900, 1900, 3000, 3600, 4800, 6000];
    var play = function () {
      items.forEach(function (el) { el.classList.remove("in"); });
      items.forEach(function (el, i) { setTimeout(function () { el.classList.add("in"); }, delays[i] || i * 900); });
    };
    if (reduce) items.forEach(function (el) { el.classList.add("in"); });
    else { play(); setInterval(play, 11000); }
  }

  var rv = document.querySelectorAll(".rv");
  if (!("IntersectionObserver" in window) || reduce) { rv.forEach(function (el) { el.classList.add("in"); }); return; }
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
  rv.forEach(function (el) { io.observe(el); });
})();
