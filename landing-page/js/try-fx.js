// Homepage Message check: a looping demo plays inside the phone (typed message, "thinking", verdict, calmer reply).
// It stops and clears itself the moment someone focuses the input or taps an example. Decorative only: nothing is sent.
(function () {
  var card = document.getElementById("try-card"), inp = document.getElementById("try-draft"), msgs = document.getElementById("try-msgs");
  if (!card || !inp || !msgs || !card.classList.contains("tw-min")) return;
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var base = inp.getAttribute("placeholder") || "Paste your message…";
  var demo = [
    ["Fine. Do whatever you want.", "Reads cold", "Likely to start a fight.", 86, "I’m upset you didn’t tell me. Can we talk tonight?"],
    ["You never listen to me.", "Sounds like blame", "They may get defensive.", 72, "I feel unheard lately. Can we talk?"],
    ["We need to talk.", "Sounds alarming", "They may start to worry.", 64, "Can we talk tonight? Nothing bad, I just miss us."]
  ];
  var stop = false, started = false, timer;
  function wait(ms) { return new Promise(function (r) { timer = setTimeout(r, ms); }); }
  function alive() { return !stop && !inp.value && !card.classList.contains("used") && document.activeElement !== inp; }
  function bubble(cls, html) { var d = document.createElement("div"); d.className = "tw-b " + cls; d.setAttribute("data-demo", ""); d.innerHTML = html; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; }
  function clear() { [].slice.call(msgs.querySelectorAll("[data-demo]")).forEach(function (n) { n.remove(); }); inp.setAttribute("placeholder", base); }
  function quit() { if (stop) return; stop = true; clearTimeout(timer); clear(); }
  inp.addEventListener("focus", quit);
  card.addEventListener("click", function (e) { if (e.target.closest("button")) quit(); });

  /* phone follows the pointer a little (desktop, hover devices) */
  var ph = card.querySelector(".tw-ph");
  if (ph && window.matchMedia && matchMedia("(hover:hover) and (pointer:fine)").matches) {
    var raf = 0, rx = 0, ry = 0;
    function apply() { raf = 0; ph.style.transform = "perspective(1000px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg)"; }
    card.addEventListener("pointermove", function (e) {
      if (innerWidth <= 900) return; var r = ph.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      ry = Math.max(-1, Math.min(1, (e.clientX - cx) / 600)) * 9; rx = Math.max(-1, Math.min(1, (e.clientY - cy) / 500)) * -7;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    card.addEventListener("pointerleave", function () { rx = ry = 0; if (!raf) raf = requestAnimationFrame(apply); });
  }
  function esc(t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  async function run() {
    var i = 0;
    while (alive()) {
      var d = demo[i % demo.length]; i++;
      for (var c = 1; c <= d[0].length && alive(); c++) { inp.setAttribute("placeholder", d[0].slice(0, c) + "|"); await wait(55); }
      if (!alive()) break; await wait(450); inp.setAttribute("placeholder", base);
      bubble("me", esc(d[0])); await wait(500); if (!alive()) break;
      var dots = bubble("ai", '<span class="tw-dots"><i></i><i></i><i></i></span>'); await wait(1100); dots.remove(); if (!alive()) break;
      bubble("note", "<small>" + esc(d[1]) + "</small>" + esc(d[2]) + '<span class="tw-meter" style="--v:' + d[3] + '%"><i></i></span>'); await wait(800); if (!alive()) break;
      bubble("ai", esc(d[4])); await wait(3400); if (!alive()) break;
      clear(); await wait(500);
    }
    quit();
  }
  function go() { if (started) return; started = true; setTimeout(run, 700); }
  if ("IntersectionObserver" in window) new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting) { o.disconnect(); go(); } }); }, { threshold: .35 }).observe(card);
  else setTimeout(go, 1500);
})();
