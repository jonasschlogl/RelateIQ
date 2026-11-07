/* Interactions for the content pages (feature pages, blog topics, blog articles).
   Ported from the old pop-up windows: feature tabs, blog filters, "show more", reveal on scroll, parallax, TOC, share. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* feature tabs */
  function pick(p, i) {
    $$('.tb-b', p).forEach(function (b) { var o = +b.getAttribute('data-i') === i; b.classList.toggle('on', o); b.setAttribute('aria-selected', o ? 'true' : 'false'); if (o) { var l = b.parentNode; if (l.scrollWidth > l.clientWidth + 4) l.scrollTo({ left: Math.max(0, b.offsetLeft - 20), behavior: 'smooth' }); } });
    $$('.tb-ex,.tb-cap', p).forEach(function (x) { x.classList.toggle('on', +x.getAttribute('data-i') === i); });
    var st = $('.tb-stage', p); if (st) st.setAttribute('data-i', i);
  }
  $$('.fm-panel').forEach(function (p) { pick(p, 0); $$('.bl-x', p).forEach(function (x) { x.hidden = true; }); });
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t.closest) return;
    var tb = t.closest('.tb-b'); if (tb) { e.preventDefault(); pick(tb.closest('.fm-panel'), +tb.getAttribute('data-i')); return; }
    var fl = t.closest('.bl-fl');
    if (fl) {
      e.preventDefault(); var pp = fl.closest('.fm-panel'), kk = fl.getAttribute('data-t'), nn = 0;
      $$('.bl-fl', pp).forEach(function (b) { b.classList.toggle('on', b === fl); b.setAttribute('aria-pressed', b === fl ? 'true' : 'false'); });
      $$('.bl-card', pp).forEach(function (c) { var ok = kk === 'all' || (' ' + c.getAttribute('data-t') + ' ').indexOf(' ' + kk + ' ') > -1; c.hidden = !ok; if (ok) { nn++; c.classList.add('in'); c.classList.remove('bl-pop'); void c.offsetWidth; c.classList.add('bl-pop'); } });
      var ct = $('.bl-count', pp); if (ct) ct.textContent = nn + ' article' + (nn == 1 ? '' : 's'); return;
    }
    var sm = t.closest('.bl-sm');
    if (sm) { e.preventDefault(); var p2 = sm.closest('.fm-panel'); $$('.bl-x', p2).forEach(function (x, i) { x.hidden = false; x.classList.add('rv'); x.style.transitionDelay = (i * 90) + 'ms'; requestAnimationFrame(function () { requestAnimationFrame(function () { x.classList.add('in'); }); }); }); sm.hidden = true; }
  });
  /* reveal on scroll */
  var T = $$('.fm-panel .pg-sec>h3,.fm-panel .tbx,.fm-panel .mo-c,.fm-panel .mo-also,.fm-panel .pg-good li,.fm-panel .pg-end h3,.fm-panel .pg-end .fm-cta,.fm-panel .pg-end .fm-avail,.fm-panel .fm-meth,.fm-panel .bl-card:not(.bl-x),.fm-panel .bl-topics,.fm-panel .bl-cta,.fm-panel .su-h,.fm-panel .su-c,.fm-panel .su-t2,.fm-panel .su-note,.sp-end-card,.mt-f,.legal-summary,.method-block');
  if ('IntersectionObserver' in window && !rm) {
    var io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }); }, { threshold: .1, rootMargin: '0px 0px -6% 0px' });
    T.forEach(function (e) { var li = e.matches('.pg-good li,.mo-c,.bl-card,.su-c,.su-t2') ? [].indexOf.call(e.parentNode.children, e) : 0; e.classList.add('rv'); e.style.transitionDelay = (li * (e.matches('.mo-c') ? 70 : e.matches('.bl-card') ? 90 : 50)) + 'ms'; io.observe(e); });
  }
  /* parallax on feature rows */
  var rows = $$('.pg-f'), tick = false;
  function par() { tick = false; var H = innerHeight; rows.forEach(function (f) { var r = f.getBoundingClientRect(); if (r.bottom < -200 || r.top > H + 200) return; var v = ((r.top + r.height / 2) - H / 2) / H; f.style.setProperty('--p', Math.max(-1, Math.min(1, v)).toFixed(3)); }); }
  if (rows.length && !rm && innerWidth > 700) { addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(par); } }, { passive: true }); par(); }
  /* article: table of contents highlight + share */
  var toc = $('.toc'), heads = $$('.article-body h2[id]');
  if (toc && heads.length && 'IntersectionObserver' in window) {
    var links = {}; $$('a', toc).forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var cur = null, set = function (id) { if (id === cur || !links[id]) return; cur = id; Object.keys(links).forEach(function (k) { links[k].classList.toggle('active', k === id); }); };
    var io2 = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) set(e.target.id); }); }, { rootMargin: '-110px 0px -65% 0px', threshold: 0 });
    heads.forEach(function (h) { io2.observe(h); }); set(heads[0].id);
  }
  $$('[data-share]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var url = btn.getAttribute('data-share'), title = btn.getAttribute('data-title') || document.title;
      if (navigator.share) { navigator.share({ title: title, url: url }).catch(function () { }); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { btn.classList.add('copied'); setTimeout(function () { btn.classList.remove('copied'); }, 1800); });
    });
  });
})();
