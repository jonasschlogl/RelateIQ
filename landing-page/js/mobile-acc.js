/* Phones: decorate section bars (icon + number), one shine on open, smooth FAQ open/close. */
(function () {
  var mq = window.matchMedia('(max-width: 700px)');
  var ICON = {
    approach: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    compare: '<path d="M12 4v16M6 20h12"/><path d="M5 7h14"/><path d="M5 7l-2.5 6a3 3 0 0 0 5 0z"/><path d="M19 7l-2.5 6a3 3 0 0 0 5 0z"/>',
    trust: '<rect x="5" y="10.5" width="14" height="9.5" rx="3"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14.5v2"/>',
    pricing: '<path d="M3.5 12.2V5.5a2 2 0 0 1 2-2h6.7l8.3 8.3a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0z"/><circle cx="8" cy="8" r="1.4"/>',
    faq: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.6a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.3 1-1.3 2"/><path d="M12 17.2v.1"/>'
  };
  var ORDER = ['approach', 'compare', 'trust', 'pricing', 'faq'];
  function decorate() {
    [].forEach.call(document.querySelectorAll('section.acc > .acc-btn'), function (b) {
      if (b.getAttribute('data-n')) return;
      var id = b.parentNode.id, i = ORDER.indexOf(id);
      if (i < 0) return;
      b.setAttribute('data-n', ('0' + (i + 1)).slice(-2));
      var ic = document.createElement('span');
      ic.className = 'acc-ic'; ic.setAttribute('aria-hidden', 'true');
      ic.innerHTML = '<svg viewBox="0 0 24 24">' + ICON[id] + '</svg>';
      b.insertBefore(ic, b.firstChild);
      var sh = document.createElement('span');
      sh.className = 'acc-shine'; sh.setAttribute('aria-hidden', 'true');
      b.appendChild(sh);
      b.addEventListener('click', function () {
        b.classList.remove('acc-pop'); void b.offsetWidth;
        if (b.getAttribute('aria-expanded') === 'true') b.classList.add('acc-pop');
      });
    });
  }
  /* FAQ: animate the height of <details> */
  function faq() {
    document.addEventListener('click', function (e) {
      var s = e.target.closest && e.target.closest('.faq-item > summary');
      if (!s || !mq.matches) return;
      var d = s.parentNode;
      if (!d.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      e.preventDefault();
      if (d._anim) d._anim.cancel();
      var ease = 'cubic-bezier(.2,.8,.2,1)', h0 = d.offsetHeight, opening = !d.open, h1;
      d.style.overflow = 'hidden';
      if (opening) { d.open = true; h1 = d.scrollHeight; }
      else { h1 = s.offsetHeight; }
      var a = d._anim = d.animate({ height: [h0 + 'px', h1 + 'px'] }, { duration: 380, easing: ease });
      var done = function () { d._anim = null; if (!opening) d.open = false; d.style.height = d.style.overflow = ''; };
      a.onfinish = done; a.oncancel = function () { d.style.height = d.style.overflow = ''; };
      if (opening) { /* close siblings for a tidy list */
        [].forEach.call(d.parentNode.querySelectorAll('.faq-item[open]'), function (o) {
          if (o === d || !o.animate) return;
          var oh = o.offsetHeight, os = o.querySelector('summary').offsetHeight;
          o.style.overflow = 'hidden';
          var oa = o.animate({ height: [oh + 'px', os + 'px'] }, { duration: 320, easing: ease });
          oa.onfinish = function () { o.open = false; o.style.height = o.style.overflow = ''; };
        });
      }
    }, true);
  }
  decorate(); faq();
})();
