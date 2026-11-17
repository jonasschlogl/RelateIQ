// Mobile only: each flagship card holds a small chat. Scrolling reveals its bubbles one by one while the card stays pinned;
// only when the last bubble is in does the next card slide over it. Desktop keeps the horizontal scroll untouched.
(function () {
  var deck = document.getElementById("deck"), stage = deck && deck.querySelector(".deck-stage"); if (!stage) return;
  var pages = [].slice.call(stage.querySelectorAll(".page")), cards = [].slice.call(document.querySelectorAll("#f-hp .f-hc"));
  var mq = matchMedia("(max-width: 700px)"), rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (pages.length !== 3 || cards.length !== 3) return;
  var T = [.04, .27, .5, .73], W = .2, items = [], tick = false;
  var sm = function (x) { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  pages.forEach(function (pg, i) {
    var body = pg.querySelector(".flag-body"), img = pg.querySelector("img.fl-ph"), src = cards[i].querySelector(".f-scr"); if (!body || !src) return;
    var box = document.createElement("div"); box.className = "m-chat"; box.setAttribute("aria-hidden", "true");
    var title = src.querySelector(".f-pt"), t = document.createElement("div"); t.className = "f-pt"; t.innerHTML = (title ? title.innerHTML : "") + "<em>Example</em>";
    if (img) { var bg = img.cloneNode(); bg.alt = ""; box.appendChild(bg); }
    box.appendChild(t);
    var bs = [].slice.call(src.querySelectorAll(".f-b")).map(function (b) { var c = b.cloneNode(true); c.removeAttribute("style"); box.appendChild(c); return c; });
    body.appendChild(box); items.push({ page: pg, bubbles: bs });
  });
  if (rm) { stage.classList.add("m-chat-static"); return; }
  function dwell() { return Math.round(innerHeight * .6); }
  function size() { var d = dwell(); stage.style.setProperty("--dw", d + "px"); }
  function frame() {
    tick = false; if (!mq.matches) return;
    var dw = dwell(), span = Math.max(1, dw - 60), sb = stage.getBoundingClientRect().bottom;
    items.forEach(function (it, i) {
      var pg = it.page, h = pg.offsetHeight, top = parseFloat(getComputedStyle(pg).top) || 0, nat;
      nat = i < 2 ? items[i + 1].page.getBoundingClientRect().top - h - dw : sb - dw - h;
      var p = Math.min(1, Math.max(0, (top - nat) / span));
      it.bubbles.forEach(function (b, k) { var a = sm((p - T[Math.min(k, 3)]) / W); b.style.opacity = a.toFixed(3); b.style.transform = "translateY(" + ((1 - a) * 16).toFixed(1) + "px) scale(" + (.94 + .06 * a).toFixed(3) + ")"; });
    });
  }
  function req() { if (!tick) { tick = true; requestAnimationFrame(frame); } }
  addEventListener("scroll", req, { passive: true }); addEventListener("resize", function () { size(); req(); }); addEventListener("load", function () { size(); req(); });
  size(); req();
})();
