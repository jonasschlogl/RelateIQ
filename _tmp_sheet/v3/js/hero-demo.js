/* Hero product preview: three clickable demos, auto-advance until the visitor interacts */
(function () {
  'use strict';
  var root = document.getElementById('dm-root');
  if (!root) return;
  var panels = [].slice.call(root.querySelectorAll('.dm-panel'));
  var tabs = [].slice.call(root.querySelectorAll('.dm-tab'));
  var cur = 0, stopped = false;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DUR = [9, 9, 12];

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

  /* Message check: one short draft, a tone gauge and three one-tap rewrites */
  var STATES = [
    { t: 'Fine.', k: .08, v: 'Likely to start a fight', c: 'bad' },
    { t: 'I need a minute.', k: .84, v: 'Safe to send', c: 'good' },
    { t: 'I\u2019m hurt. Let\u2019s talk.', k: .94, v: 'Warm and clear', c: 'good' },
    { t: 'I\u2019m upset. Tonight?', k: .7, v: 'Direct and calm', c: 'good' }
  ];
  var tbtn = [].slice.call(root.querySelectorAll('.dm-tn button'));
  var bp = root.querySelector('#dm-bp'), vd = root.querySelector('#dm-vd'), gauge = root.querySelector('#dm-g');
  function setState(n, active) {
    tbtn.forEach(function (b, k) { b.classList.toggle('on', active && k === n - 1); });
    bp.classList.add('sw');
    setTimeout(function () {
      bp.textContent = STATES[n].t; vd.textContent = STATES[n].v; vd.className = 'vd ' + STATES[n].c;
      gauge.style.setProperty('--k', STATES[n].k); bp.classList.remove('sw');
    }, 220);
  }
  function resetTone() { tbtn.forEach(function (b) { b.classList.remove('on'); }); bp.textContent = STATES[0].t; vd.textContent = STATES[0].v; vd.className = 'vd bad'; gauge.style.setProperty('--k', STATES[0].k); }
  tbtn.forEach(function (b, n) { b.addEventListener('click', function () { stopped = true; root.classList.add('stopped'); setState(n + 1, true); }); });

  // when the demo plays on its own, step through the tones so people see it is interactive
  var obs = new MutationObserver(function () {
    var p = panels[2];
    if (p.classList.contains('on') && !stopped && !reduce) {
      [[2400, 1], [5200, 2], [7800, 3]].forEach(function (s) {
        setTimeout(function () { if (!stopped && p.classList.contains('on')) setState(s[1], true); }, s[0]);
      });
    }
  });
  obs.observe(panels[2], { attributes: true, attributeFilter: ['class'] });

  // start the first progress bar
  show(0);
})();
