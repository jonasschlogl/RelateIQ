/* Page dots under the swipe rows (experts, testers). Mobile only: CSS hides them on desktop. */
(function () {
  function init(list) {
    var cards = Array.prototype.slice.call(list.children);
    if (cards.length < 2) return;
    var dots = document.createElement('div');
    dots.className = 'm-dots';
    dots.setAttribute('aria-hidden', 'true');
    cards.forEach(function () { dots.appendChild(document.createElement('i')); });
    list.insertAdjacentElement('afterend', dots);
    if (list.classList.contains('ts-grid')) {
      var mk = function (dir) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'm-arr ' + (dir < 0 ? 'prev' : 'next');
        b.setAttribute('aria-label', dir < 0 ? 'Previous' : 'Next');
        b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="' + (dir < 0 ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7') + '"/></svg>';
        b.addEventListener('click', function () { list.scrollBy({ left: dir * (cards[0].offsetWidth + 12), behavior: 'smooth' }); });
        return b;
      };
      dots.removeAttribute('aria-hidden');
      dots.insertBefore(mk(-1), dots.firstChild); dots.appendChild(mk(1));
    }
    var d = dots.querySelectorAll('i');
    function update() {
      var mid = list.scrollLeft + list.clientWidth / 2, best = 0, bd = 1e9;
      cards.forEach(function (c, i) {
        var dist = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
        if (dist < bd) { bd = dist; best = i; }
      });
      for (var i = 0; i < d.length; i++) d[i].className = i === best ? 'on' : '';
    }
    list.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    update();
  }
  document.querySelectorAll('.ex-grid, .ts-grid').forEach(init);
})();
