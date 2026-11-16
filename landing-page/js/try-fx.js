// Homepage Message check: types example messages into the empty input, so the phone feels alive. Stops on focus or use.
(function () {
  var card = document.getElementById("try-card"), inp = document.getElementById("try-draft");
  if (!card || !inp || !card.classList.contains("tw-min")) return;
  var calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lines = [].map.call(card.querySelectorAll(".tw-ex button"), function (b) { return b.getAttribute("data-ex"); });
  var base = inp.getAttribute("placeholder") || "Paste your message…";
  if (calm || !lines.length) return;
  var li = 0, ci = 0, dir = 1, stop = false, t;
  function quit() { stop = true; clearTimeout(t); inp.setAttribute("placeholder", base); }
  inp.addEventListener("focus", quit); card.addEventListener("click", function (e) { if (e.target.closest("button")) quit(); });
  function step() {
    if (stop || inp.value || card.classList.contains("used")) { quit(); return; }
    var s = lines[li];
    ci += dir; inp.setAttribute("placeholder", s.slice(0, ci) + (ci < s.length || dir < 0 ? "|" : ""));
    if (dir > 0 && ci >= s.length) { dir = -1; t = setTimeout(step, 1700); return; }
    if (dir < 0 && ci <= 0) { dir = 1; li = (li + 1) % lines.length; t = setTimeout(step, 450); return; }
    t = setTimeout(step, dir > 0 ? 55 : 22);
  }
  var seen = false;
  if ("IntersectionObserver" in window) new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting && !seen) { seen = true; o.disconnect(); t = setTimeout(step, 700); } }); }, { threshold: .3 }).observe(card);
  else t = setTimeout(step, 1500);
})();
