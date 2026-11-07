(function () {
  var sec = document.getElementById('testers'), btn = sec && sec.querySelector('.ts-more');
  if (btn) btn.addEventListener('click', function () { sec.classList.add('open'); });
})();
