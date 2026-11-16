/* Homepage motion: hero word reveal, scroll-filled headings, widget entrance, tool tabs. Pure enhancement. */
(function () {
  var rm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (rm) return;
  var root = document.documentElement; root.classList.add("mo");

  /* 1. hero headline: first line, word by word */
  var l1 = document.querySelector(".hx-hero h1 .hx-l1");
  if (l1 && l1.children.length === 0) {
    var words = l1.textContent.trim().split(/\s+/); l1.setAttribute("aria-label", l1.textContent.trim()); l1.textContent = "";
    words.forEach(function (w, i) {
      var o = document.createElement("span"); o.className = "mwo"; o.setAttribute("aria-hidden", "true");
      var n = document.createElement("span"); n.className = "mwi"; n.style.setProperty("--i", i); n.textContent = w;
      o.appendChild(n); l1.appendChild(o); if (i < words.length - 1) l1.appendChild(document.createTextNode(" "));
    });
  }

  /* 2. section headings: words fill in with scroll */
  var heads = [].slice.call(document.querySelectorAll("main > section:not(.hx-hero):not(.try-sec) .hx-head h2")), items = [];
  function split(node, out) {
    [].slice.call(node.childNodes).forEach(function (c) {
      if (c.nodeType === 3) {
        var parts = c.nodeValue.split(/(\s+)/), frag = document.createDocumentFragment();
        parts.forEach(function (p) { if (!p) return; if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(p)); } else { var s = document.createElement("span"); s.className = "sw"; s.textContent = p; frag.appendChild(s); out.push(s); } });
        node.replaceChild(frag, c);
      } else if (c.nodeType === 1) split(c, out);
    });
  }
  heads.forEach(function (h) { var w = []; split(h, w); if (w.length) items.push({ el: h, w: w }); });
  var ticking = false;
  function update() {
    ticking = false; var vh = innerHeight;
    items.forEach(function (it) {
      var r = it.el.getBoundingClientRect(); if (!r.height) { it.el.classList.add("sw-done"); return; }
      var p = (vh * .9 - r.top) / (vh * .45); p = Math.max(0, Math.min(1, p)); var n = it.w.length;
      if (p >= 1) { it.el.classList.add("sw-done"); return; } it.el.classList.remove("sw-done");
      it.w.forEach(function (s, i) { s.style.opacity = (.16 + .84 * Math.max(0, Math.min(1, p * (n + 1.5) - i))).toFixed(2); });
    });
  }
  function req() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  addEventListener("scroll", req, { passive: true }); addEventListener("resize", req); update();

  /* 3. widget card entrance */
  var tw = document.querySelector(".tw");
  if (tw && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { tw.classList.add("in"); io.disconnect(); } }); }, { threshold: .12 });
    io.observe(tw);
  } else if (tw) tw.classList.add("in");

  /* 4. tool tabs that follow the pinned horizontal scroll */
  var hp = document.querySelector("[data-hp]"), bar = hp && hp.querySelector(".f-hbar");
  if (hp && bar) {
    var cards = [].slice.call(hp.querySelectorAll(".f-hc")), tr = hp.querySelector(".f-htrack");
    var tabs = document.createElement("nav"); tabs.className = "mt-tabs"; tabs.setAttribute("role", "tablist"); tabs.setAttribute("aria-label", "Tools");
    var btns = cards.map(function (c, i) {
      var t = c.querySelector(".f-tag b"), b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab"); b.textContent = t ? t.textContent : "Tool " + (i + 1);
      b.addEventListener("click", function () {
        var max = tr.scrollWidth - innerWidth, p = max > 0 ? Math.max(0, Math.min(1, (cards[i].offsetLeft - 120) / max)) : 0;
        scrollTo({ top: hp.getBoundingClientRect().top + scrollY + p * (hp.offsetHeight - innerHeight), behavior: "smooth" });
      });
      tabs.appendChild(b); return b;
    });
    bar.appendChild(tabs);
    var cur = -1;
    function sync() {
      var idx = 0; cards.forEach(function (c, i) { if (c.getBoundingClientRect().left < innerWidth * .45) idx = i; });
      if (idx !== cur) { cur = idx; btns.forEach(function (b, i) { b.setAttribute("aria-selected", i === idx ? "true" : "false"); }); }
    }
    addEventListener("scroll", sync, { passive: true }); addEventListener("resize", sync); sync();
  }
})();
