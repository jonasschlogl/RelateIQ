/* Phone-only behaviour for the sub pages: nav hides while scrolling down, animations pause when their section is off screen. */
(function () {
  if (!window.matchMedia('(max-width: 700px)').matches) return;
  var nav = document.getElementById('nav'), lastY = window.pageYOffset, tick = false;
  if (nav) {
    window.addEventListener('scroll', function () {
      if (tick) return; tick = true;
      window.requestAnimationFrame(function () {
        var y = window.pageYOffset, d = y - lastY;
        if (Math.abs(d) > 6) {
          var l = document.getElementById('links'), open = l && l.classList.contains('open');
          nav.classList.toggle('m-nav-hide', d > 0 && y > 140 && !open);
          lastY = y;
        }
        tick = false;
      });
    }, { passive: true });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('m-live', e.isIntersecting); });
    }, { rootMargin: '80px 0px' });
    document.querySelectorAll('.pg-hero, .mt-hero, .pg-stage, .tb-stage, .pg-end, .sp-end, .pg-fa, .mb-art').forEach(function (n) { io.observe(n); });
    document.documentElement.classList.add('m-io');
  }
})();
