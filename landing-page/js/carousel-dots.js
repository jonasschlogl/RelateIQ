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
    var d = dots.children;
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
