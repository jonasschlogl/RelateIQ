/* RelationshipAI "Cocoa Heart" interactions: scroll-lit statement, rotating giant clover, heart cursor + burst. */
(function () {
  var rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (x) { return Math.min(1, Math.max(0, x)); };
  /* 1. words light up as you scroll */
  var lit = $$('[data-lit]');
  lit.forEach(function (el) { el.innerHTML = el.textContent.trim().split(/\s+/).map(function (w) { return '<span class="lw">' + w + '</span>'; }).join(' '); });
  var giant = $('.f-giant'), tick = false;
  function frame() {
    tick = false; var H = innerHeight;
    lit.forEach(function (el) {
      var r = el.getBoundingClientRect(), p = clamp((H * .85 - r.top) / (H * .6 + r.height * .4)), ws = el._lw || (el._lw = $$('.lw', el));
      if (!rm && (r.bottom < -H || r.top > H * 2)) return;
      ws.forEach(function (w, i) { w.classList.toggle('on', rm || i / ws.length < p); });
    });
    if (giant && !rm) {
      if (innerWidth > 760) giant.style.transform = 'translate(-50%,-50%) rotate(' + (scrollY * .04).toFixed(1) + 'deg)';
      else { var gs = giant._svg || (giant._svg = giant.querySelector('svg')); if (gs && scrollY < H * 1.6) gs.style.transform = 'rotate(' + (scrollY * .06).toFixed(1) + 'deg)'; }
    }
  }
  addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(frame); } }, { passive: true });
  addEventListener('resize', frame); frame();
  /* 2. heart cursor that lags behind the pointer; click bursts hearts */
  if (!rm && matchMedia('(hover:hover) and (pointer:fine)').matches) {
    var cu = $('.f-cur'); if (!cu) return;
    document.documentElement.classList.add('hc');
    var x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, h = cu.innerHTML;
    addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; cu.style.opacity = 1; var t = e.target.closest && e.target.closest('a,button,input,summary,label,.page,.pg-head'); cu.classList.toggle('big', !!t); });
    (function lp() { x += (tx - x) * .18; y += (ty - y) * .18; cu.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; requestAnimationFrame(lp); })();
    addEventListener('pointerdown', function (e) {
      for (var i = 0; i < 9; i++) {
        var s = document.createElement('span'); s.className = 'f-bh'; s.innerHTML = h; s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px'; document.body.appendChild(s);
        var a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 70;
        (function (s, a, d) { s.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: 'translate(calc(-50% + ' + Math.cos(a) * d + 'px),calc(-50% + ' + (Math.sin(a) * d - 30) + 'px)) scale(1) rotate(' + ((Math.random() * 80 - 40) | 0) + 'deg)', opacity: 0 }], { duration: 800 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = function () { s.remove(); }; })(s, a, d);
      }
    });
  }
})();

/* Scroll story (desktop, motion allowed): one pinned stage; as you scroll the scenes swap in and out
   (the three tools, the live Message check, experts, early testers). Mobile / reduced motion keep the stacked deck and sections.
   Reaching the last scene "opens" all three tool pages for the deck's unlock gate. */
(function () {
  var hp = document.querySelector('[data-hp]'), deck = document.getElementById('deck'); if (!hp || !deck) return;
  var rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, tr = hp.querySelector('.f-htrack'), bar = hp.querySelector('.f-hbar i'),
      tools = [].slice.call(hp.querySelectorAll('.f-hc')), scenes = [], moved = [], opened = false, root = document.documentElement, cur = -1, labels = [], mounted = false;
  function on() { return !rm && innerWidth > 900; }
  function park(node) { moved.push({ node: node, parent: node.parentNode, next: node.nextSibling }); }
  function scene(node, cls, label) { node.classList.add('f-sc', cls); node.setAttribute('data-label', label); tr.appendChild(node); scenes.push(node); }
  function mount() {
    if (mounted) return; mounted = true; scenes = []; moved = [];
    tools.forEach(function (c, i) { c.classList.add('f-sc'); var t = c.querySelector('.f-tag b'); c.setAttribute('data-label', ['Practice', 'Coach', 'Check'][i] || (t ? t.textContent : 'Tool')); scenes.push(c); });
    var tw = document.getElementById('try-card'), ex = document.querySelector('#experts > .hx-wrap'), ts = document.querySelector('#testers > .hx-wrap');
    if (tw) { park(tw); scene(tw, 'f-sc-try', 'Try it'); }
    if (ex) { park(ex); ex.classList.add('ex-sec'); scene(ex, 'f-sc-free', 'Experts'); }
    if (ts) { park(ts); ts.classList.add('ts-sec'); scene(ts, 'f-sc-free', 'Testers'); }
    root.classList.add('f-story'); cur = -1; labels = scenes.map(function (s) { return s.getAttribute('data-label'); });
    document.dispatchEvent(new CustomEvent('fstory:init', { detail: { labels: labels } }));
  }
  function unmount() {
    if (!mounted) return; mounted = false;
    moved.slice().reverse().forEach(function (m) { m.node.style.zoom = ''; m.node.classList.remove('f-sc', 'f-sc-try', 'f-sc-free', 'is-on', 'is-past', 'ex-sec', 'ts-sec'); m.node.removeAttribute('data-label'); m.parent.insertBefore(m.node, m.next); });
    tools.forEach(function (c) { c.classList.remove('f-sc', 'is-on', 'is-past'); c.removeAttribute('data-label'); });
    moved = []; scenes = []; tools.forEach(function (c) { c.style.zoom = ''; }); root.classList.remove('f-story'); document.dispatchEvent(new CustomEvent('fstory:off'));
  }
  function fit() {
    if (!mounted) return;
    var avail = tr.clientHeight - 12;
    scenes.forEach(function (s) { s.style.zoom = ''; var h = s.offsetHeight; if (h > avail && avail > 200) s.style.zoom = (avail / h).toFixed(3); });
  }
  function per() { return innerHeight * .85; }
  function size() {
    var yes = on(); root.classList.toggle('f-pinon', yes);
    if (!yes) { unmount(); hp.style.height = ''; return; }
    mount(); hp.style.height = Math.round(innerHeight + (scenes.length - 1) * per()) + 'px'; fit();
  }
  function open() { if (opened) return; opened = true; for (var i = 0; i < 2; i++) { var f = deck.querySelector('.page[data-s="front"] .pg-next'); if (f) f.click(); } }
  function set(i) {
    if (i === cur) return; cur = i;
    scenes.forEach(function (s, k) {
      s.classList.toggle('is-on', k === i); s.classList.toggle('is-past', k < i);
      if (k === i) { s.removeAttribute('inert'); s.removeAttribute('aria-hidden'); } else { s.setAttribute('inert', ''); s.setAttribute('aria-hidden', 'true'); }
      if (k === i && s.classList.contains('f-hc')) s.classList.add('live');
    });
    document.dispatchEvent(new CustomEvent('fstory:scene', { detail: { i: i, n: scenes.length } }));
  }
  function mv() {
    if (!on() || !mounted) return;
    var r = hp.getBoundingClientRect(), span = hp.offsetHeight - innerHeight, p = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
    if (bar) bar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
    set(Math.min(scenes.length - 1, Math.round(p * (scenes.length - 1) + (.0001))));
    if (p > .985) open();
  }
  window.fStoryGo = function (i) {
    if (!mounted || i < 0 || i >= scenes.length) return;
    var span = hp.offsetHeight - innerHeight, y = hp.getBoundingClientRect().top + scrollY + (scenes.length > 1 ? i / (scenes.length - 1) : 0) * span;
    scrollTo({ top: y, behavior: 'smooth' });
  };
  addEventListener('resize', function () { size(); mv(); });
  addEventListener('scroll', mv, { passive: true });
  size(); mv(); setTimeout(function () { size(); mv(); }, 600); addEventListener('load', function () { size(); mv(); });
})();

/* gentle parallax on the photographic scene below the hero */
(function () {
  var s = document.querySelector('.f-herobg'); if (!s) return; var img = s.querySelector('img'); if (innerWidth < 761) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var tick = false;
  function f() { tick = false; var r = s.getBoundingClientRect(), h = innerHeight; if (r.bottom < 0 || r.top > h) return; var p = (r.top + r.height / 2 - h / 2) / h; img.style.transform = 'translateY(' + (p * 40).toFixed(1) + 'px) scale(' + (1.01 + Math.abs(p) * .015).toFixed(3) + ')'; }
  addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(f); } }, { passive: true }); f();
})();
