/* Hero product preview: three clickable demos, auto-advance until the visitor interacts */
(function () {
  'use strict';
  var root = document.getElementById('dm-root');
  if (!root) return;
  var panels = [].slice.call(root.querySelectorAll('.dm-panel'));
  var tabs = [].slice.call(root.querySelectorAll('.dm-tab'));
  var cur = 0, stopped = false;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DUR = [11, 12, 11];

  function fit() {
    var w = window.innerWidth, h = window.innerHeight, ps;
    if (w <= 980) ps = Math.min(.92, (w - 56) / 390);
    else ps = Math.max(.56, Math.min(.86, (h - 250) / 800));
    root.style.setProperty('--ps', ps.toFixed(3));
  }
  fit(); window.addEventListener('resize', fit);

  function show(i) {
    cur = i;
    panels.forEach(function (p, n) { p.classList.toggle('on', n === i); });
    tabs.forEach(function (t, n) {
      var on = n === i;
      t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false');
      var pg = t.querySelector('.pg');
      if (on) { pg.style.setProperty('--dur', DUR[i] + 's'); }
    });
    // restart the progress animation
    var pg = tabs[i].querySelector('.pg'); pg.style.animation = 'none'; void pg.offsetWidth; pg.style.animation = '';
    if (i === 2) resetTone();
    try { if (window.umami && window.umami.track) window.umami.track('hero-demo-' + ['practice', 'coach', 'check'][i]); } catch (e) {}
  }

  tabs.forEach(function (t, n) {
    t.addEventListener('click', function () { stopped = true; root.classList.add('stopped'); show(n); });
    var pg = t.querySelector('.pg');
    pg.addEventListener('animationend', function () {
      if (stopped || reduce || !t.classList.contains('on')) return;
      show((cur + 1) % panels.length);
    });
  });
  root.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      var n = (cur + (e.key === 'ArrowRight' ? 1 : panels.length - 1)) % panels.length;
      stopped = true; root.classList.add('stopped'); show(n); tabs[n].focus();
    }
  });

  /* tone rewrites in the Message check demo */
  var REW = [
    ['I’m upset and I need a minute. Can we talk tonight?', 'Risk: low'],
    ['I’m hurt, and I still want to work this out. Tonight?', 'Risk: low'],
    ['I’m upset you didn’t tell me. I’d like to talk tonight.', 'Risk: medium']
  ];
  var tbtn = [].slice.call(root.querySelectorAll('.dm-tn button'));
  var rwp = root.querySelector('#dm-rwp'), rwt = root.querySelector('#dm-rwt');
  function setTone(n) {
    tbtn.forEach(function (b, k) { b.classList.toggle('on', k === n); });
    rwp.classList.add('sw');
    setTimeout(function () { rwp.textContent = REW[n][0]; rwt.textContent = REW[n][1]; rwp.classList.remove('sw'); }, 230);
  }
  function resetTone() { tbtn.forEach(function (b, k) { b.classList.toggle('on', k === 0); }); rwp.textContent = REW[0][0]; rwt.textContent = REW[0][1]; }
  tbtn.forEach(function (b, n) { b.addEventListener('click', function () { stopped = true; root.classList.add('stopped'); setTone(n); }); });

  // when auto-advancing the Message check demo, flip through the tones once so people see it is interactive
  var obs = new MutationObserver(function () {
    var p = panels[2];
    if (p.classList.contains('on') && !stopped && !reduce) {
      setTimeout(function () { if (!stopped && p.classList.contains('on')) setTone(1); }, 6200);
      setTimeout(function () { if (!stopped && p.classList.contains('on')) setTone(2); }, 8200);
    }
  });
  obs.observe(panels[2], { attributes: true, attributeFilter: ['class'] });

  // start the first progress bar
  show(0);
})();
