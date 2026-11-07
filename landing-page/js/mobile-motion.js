/* Phone-only motion: cards rise in as they enter the screen, staggered. Transform + opacity only (cheap).
   Skipped for reduced-motion. Without JS nothing is hidden. */
(function () {
  if (!window.matchMedia('(max-width: 700px)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;
  var sets = [
    ['.ex-grid', '.ex-card'], ['.ts-grid', '.ts-card'], ['#tools .deck-stage', '.page'],
    ['.f-st', '.hx-wrap'], ['.hx-final', null], ['.hx-foot .ft-grid', '.ft-col']
  ];
  var targets = [];
  sets.forEach(function (s) {
    document.querySelectorAll(s[0]).forEach(function (host) {
      var kids = s[1] ? Array.prototype.slice.call(host.querySelectorAll(':scope > ' + s[1])) : [host];
      kids.forEach(function (k, i) { k.classList.add('m-rise'); k.style.setProperty('--i', Math.min(i, 5)); });
      targets.push({ host: host, kids: kids });
    });
  });
  document.querySelectorAll('section.acc').forEach(function (sec, i) {
    var b = sec.querySelector(':scope > .acc-btn'); if (!b) return;
    b.classList.add('m-rise'); b.style.setProperty('--i', 0); targets.push({ host: sec, kids: [b] });
  });
  document.documentElement.classList.add('m-motion');
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      targets.forEach(function (t) { if (t.host === e.target) t.kids.forEach(function (k) { k.classList.add('m-in'); }); });
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  targets.forEach(function (t) { io.observe(t.host); });
})();
