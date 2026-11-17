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

/* horizontal pin for the three tools (desktop, motion allowed). Falls back to the stacked deck otherwise.
   Each card first "plays": its chat bubbles appear one by one as you scroll while the track stands still;
   only when the last bubble is in does the track slide on to the next card. Reaching the end "opens" all three cards for the deck's unlock gate. */
(function () {
  var hp = document.querySelector('[data-hp]'), deck = document.getElementById('deck'); if (!hp || !deck) return;
  var rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, tr = hp.querySelector('.f-htrack'), bar = hp.querySelector('.f-hbar i'), cards = [].slice.call(hp.querySelectorAll('.f-hc')), opened = false, root = document.documentElement,
      bubbles = cards.map(function (c) { return [].slice.call(c.querySelectorAll('.f-b')); }), T = [.04, .27, .5, .73], W = .2, D = 0, S = 0, X = 0;
  function on() { return !rm && innerWidth > 900; }
  var sm = function (x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  function clear() { bubbles.forEach(function (bs) { bs.forEach(function (b) { b.style.opacity = ""; b.style.transform = ""; }); }); }
  function size() {
    var yes = on(); root.classList.toggle('f-pinon', yes);
    if (!yes) { hp.style.height = ''; clear(); cards.forEach(function (c) { c.classList.add('live'); }); return; }
    cards.forEach(function (c) { c.classList.remove('live'); });
    X = tr.scrollWidth - innerWidth; D = Math.max(420, Math.round(innerHeight * .8));
    S = X + D * cards.length + 160; hp.style.height = (S + innerHeight) + 'px';
  }
  function open() { if (opened) return; opened = true; for (var i = 0; i < 2; i++) { var f = deck.querySelector('.page[data-s="front"] .pg-next'); if (f) f.click(); } }
  function mv() {
    if (!on() || !S) return;
    var r = hp.getBoundingClientRect(), y = Math.min(S, Math.max(0, -r.top)), n = cards.length, m = X / (n - 1), x = 0, rest = y;
    /* timeline: [card 0 plays][slide][card 1 plays][slide][card 2 plays] */
    for (var i = 0; i < n; i++) {
      var q = Math.min(1, Math.max(0, rest / D)); rest -= D;
      bubbles[i].forEach(function (b, k) { var a = sm((q - T[Math.min(k, 3)]) / W); b.style.opacity = a.toFixed(3); b.style.transform = "translateY(" + ((1 - a) * 14).toFixed(1) + "px) scale(" + (.96 + .04 * a).toFixed(3) + ")"; });
      if (i < n - 1) { var s = Math.min(1, Math.max(0, rest / m)); x += s * m; rest -= m; }
    }
    tr.style.transform = 'translateX(' + (-x).toFixed(1) + 'px)';
    if (bar) bar.style.transform = 'scaleX(' + Math.min(1, y / (S - 160)).toFixed(3) + ')';
    if (y >= S - 60) open();
  }
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
