/* Reveal the quotes section when it scrolls into view. Without JS the section is simply visible. */
(function () {
  'use strict';
  var sec = document.querySelector('.qs-sec');
  if (!sec) return;
  if (!('IntersectionObserver' in window)) return;
  sec.classList.add('qs-ready');
  var io = new IntersectionObserver(function (e) {
    if (e[0].isIntersecting) { sec.classList.add('qs-in'); io.disconnect(); }
  }, { threshold: 0.18 });
  io.observe(sec);
})();
