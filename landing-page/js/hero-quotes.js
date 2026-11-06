(function () {
  var ul = document.querySelector('.hq');
  if (!ul) return;
  var items = [].slice.call(ul.children);
  if (items.length < 2) return;
  var nav = document.createElement('li');
  nav.className = 'hq-nav';
  var btns = [], cur = 0, timer = null, stopped = false;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  items.forEach(function (li, i) {
    var src = li.querySelector('.hq-by img'), name = li.querySelector('.hq-by b').textContent;
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Show quote by ' + name);
    b.style.setProperty('--c', getComputedStyle(li).getPropertyValue('--c'));
    b.innerHTML = (src ? '<img src="' + src.getAttribute('src') + '" alt="" width="48" height="48">' : '') + '<b></b>';
    b.lastChild.textContent = name;
    b.addEventListener('click', function () { stopped = true; show(i); });
    nav.appendChild(b);
    btns.push(b);
  });
  ul.appendChild(nav);
  ul.classList.add('js');
  function show(i) {
    cur = i;
    items.forEach(function (li, j) { li.classList.toggle('on', j === i); });
    btns.forEach(function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
  }
  function tick() { if (!stopped) show((cur + 1) % items.length); }
  function start() { if (reduce || stopped || timer) return; timer = setInterval(tick, 7000); }
  function pause() { clearInterval(timer); timer = null; }
  ul.addEventListener('mouseenter', pause);
  ul.addEventListener('mouseleave', start);
  ul.addEventListener('focusin', pause);
  show(0);
  start();
})();
