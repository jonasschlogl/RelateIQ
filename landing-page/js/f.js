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
      var r = el.getBoundingClientRect(), p = clamp((H * .85 - r.top) / (H * .6 + r.height * .4)), ws = $$('.lw', el);
      ws.forEach(function (w, i) { w.classList.toggle('on', rm || i / ws.length < p); });
    });
    if (giant && !rm) giant.style.transform = 'translate(-50%,-50%) rotate(' + (scrollY * .04).toFixed(1) + 'deg)';
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
   Reaching the end of the pin "opens" all three cards for the deck's unlock gate. */
(function () {
  var hp = document.querySelector('[data-hp]'), deck = document.getElementById('deck'); if (!hp || !deck) return;
  var rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, tr = hp.querySelector('.f-htrack'), bar = hp.querySelector('.f-hbar i'), cards = [].slice.call(hp.querySelectorAll('.f-hc')), opened = false, root = document.documentElement;
  function on() { return !rm && innerWidth > 900; }
  function size() {
    var yes = on(); root.classList.toggle('f-pinon', yes);
    if (!yes) { hp.style.height = ''; return; }
    hp.style.height = (tr.scrollWidth - innerWidth + innerHeight + 160) + 'px';
  }
  function open() { if (opened) return; opened = true; for (var i = 0; i < 2; i++) { var f = deck.querySelector('.page[data-s="front"] .pg-next'); if (f) f.click(); } }
  function mv() {
    if (!on()) return;
    var r = hp.getBoundingClientRect(), p = Math.min(1, Math.max(0, -r.top / (hp.offsetHeight - innerHeight)));
    tr.style.transform = 'translateX(' + (-p * (tr.scrollWidth - innerWidth)).toFixed(1) + 'px)';
    if (bar) bar.style.transform = 'scaleX(' + p.toFixed(3) + ')';
    cards.forEach(function (c) { var cr = c.getBoundingClientRect(); if (cr.left < innerWidth * .62 && cr.right > innerWidth * .3 && r.top < innerHeight * .5) c.classList.add('live'); });
    if (p > .985) open();
  }
  addEventListener('resize', function () { size(); mv(); });
  addEventListener('scroll', mv, { passive: true });
  size(); mv(); setTimeout(function () { size(); mv(); }, 600); addEventListener('load', function () { size(); mv(); });
})();
