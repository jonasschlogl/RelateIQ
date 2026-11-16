/* Section entrance: cards rise in with a small stagger. Desktop only; pure enhancement. */
(function () {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var root = document.documentElement; root.classList.add("mo2");
  if (innerWidth < 901 || !("IntersectionObserver" in window)) return;
  var groups = [".ex-grid > li", ".ts-grid > li"];
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: .15, rootMargin: "0px 0px -6% 0px" });
  var any = false;
  groups.forEach(function (sel) {
    [].slice.call(document.querySelectorAll(sel)).forEach(function (el, i) {
      el.classList.add("sx"); el.style.setProperty("--d", Math.min(i, 6) * 0.08 + "s"); io.observe(el); any = true;
    });
  });
  if (any) root.classList.add("sx2");
})();
