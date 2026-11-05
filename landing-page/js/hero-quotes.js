/* Rotating quote card in the hero. Auto-advances; pauses on hover/focus; dots to jump. */
(function () {
  'use strict';
  var root = document.getElementById('qt-root');
  if (!root) return;
  var slides = [].slice.call(root.querySelectorAll('.qt-slide'));
  var dots = [].slice.call(root.querySelectorAll('.qt-dots button'));
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cur = 0, timer = null, paused = false;
  function show(i) {
    cur = i;
    slides.forEach(function (s, n) { s.classList.toggle('on', n === i); s.setAttribute('aria-hidden', n === i ? 'false' : 'true'); });
    dots.forEach(function (d, n) { d.classList.toggle('on', n === i); d.setAttribute('aria-current', n === i ? 'true' : 'false'); });
  }
  function start() { if (reduce) return; stop(); timer = setInterval(function () { if (!paused) show((cur + 1) % slides.length); }, 7500); }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  dots.forEach(function (d, n) { d.addEventListener('click', function () { show(n); start(); }); });
  root.addEventListener('mouseenter', function () { paused = true; });
  root.addEventListener('mouseleave', function () { paused = false; });
  root.addEventListener('focusin', function () { paused = true; });
  root.addEventListener('focusout', function () { paused = false; });
  show(0); start();
})();
