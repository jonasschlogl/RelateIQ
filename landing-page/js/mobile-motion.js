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

  /* ---- tilt: cards straighten as they rise (firstchair-style) ---- */
  document.querySelectorAll('.m-rise').forEach(function (el, n) {
    el.style.setProperty('--r', (n % 2 ? 2.2 : -2.2) + 'deg');
  });

  /* ---- headlines reveal word by word from a mask ---- */
  function splitWords(root) {
    var idx = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var parts = c.nodeValue.split(/(\s+)/), frag = document.createDocumentFragment();
          parts.forEach(function (t) {
            if (!t) return;
            if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(' ')); return; }
            var o = document.createElement('span'), i = document.createElement('span');
            o.className = 'm-w'; i.textContent = t; i.style.setProperty('--w', idx++);
            o.appendChild(i); frag.appendChild(o);
          });
          node.replaceChild(frag, c);
        } else if (c.nodeType === 1) walk(c);
      });
    })(root);
  }
  var heads = Array.prototype.slice.call(document.querySelectorAll('.hx-head h2, .hx-final h2, .hx-sec .apr-head h2'));
  heads.forEach(function (h) { h.setAttribute('aria-label', h.textContent); splitWords(h); h.classList.add('m-split'); });
  var io2 = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('m-in'); io2.unobserve(e.target); } });
  }, { threshold: 0.4 });
  heads.forEach(function (h) { io2.observe(h); });

  /* ---- ticker strip under the hero ---- */
  var hero = document.querySelector('.hx-hero');
  if (hero) {
    var words = ['Reply with a clear head', 'Say the hard thing kindly', 'Practice before the talk', 'Read it the way they will', 'Private by default'];
    var row = words.map(function (w) { return '<span>' + w + '</span><i></i>'; }).join('');
    var strip = document.createElement('div');
    strip.className = 'm-ticker'; strip.setAttribute('aria-hidden', 'true');
    strip.innerHTML = '<div class="m-ticker-in"><div>' + row + '</div><div>' + row + '</div></div>';
    hero.insertAdjacentElement('afterend', strip);
  }

  /* ---- spinning sticker on the final card ---- */
  var fin = document.querySelector('.hx-final');
  if (fin) {
    var st = document.createElement('div');
    st.className = 'm-sticker'; st.setAttribute('aria-hidden', 'true');
    st.innerHTML = '<svg viewBox="0 0 120 120"><defs><path id="mst" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0"/></defs>' +
      '<g class="m-st-ring"><text textLength="268" lengthAdjust="spacing"><textPath href="#mst">FREE TO START \u2022 NO CARD NEEDED \u2022</textPath></text></g>' +
      '<path class="m-st-heart" d="M60 78s-15-9.2-19.2-18.8C37.8 52 41.6 45 48.4 45c4.2 0 7.4 2.4 9.2 5.4.8 1.2 2.8 1.2 3.6 0 1.8-3 5-5.4 9.2-5.4 6.8 0 10.6 7 7.6 14.2C75 68.8 60 78 60 78z"/></svg>';
    fin.appendChild(st);
  }

  /* ---- nav hides while scrolling down, returns on scroll up ---- */
  var nav = document.getElementById('nav'), lastY = window.pageYOffset, tick = false;
  if (nav) {
    window.addEventListener('scroll', function () {
      if (tick) return; tick = true;
      window.requestAnimationFrame(function () {
        var y = window.pageYOffset, d = y - lastY;
        if (Math.abs(d) > 6) {
          var open = document.getElementById('links') && document.getElementById('links').classList.contains('open');
          nav.classList.toggle('m-nav-hide', d > 0 && y > 140 && !open);
          lastY = y;
        }
        tick = false;
      });
    }, { passive: true });
  }
})();
