// Interactive quiz for /quiz/<slug>/ pages. Data comes from #quiz-data (built by build-quiz.mjs).
// Starts on question 1 right away (people arrive from a quiz video via the bio link), shares the
// result as a story image, and sends Umami events with the traffic source.
(function () {
  var box = document.getElementById("quiz");
  var raw = document.getElementById("quiz-data");
  if (!box || !raw) return;
  var D = JSON.parse(raw.textContent);
  var L = "ABCDE";
  var answers = [];
  var started = false;

  // where the visitor came from (set on /links/ or any page with ?utm_source=)
  var src = "direct";
  try {
    var u = new URLSearchParams(location.search).get("utm_source");
    if (u) sessionStorage.setItem("ra_src", u);
    src = sessionStorage.getItem("ra_src") || (document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : "direct");
  } catch (e) {}
  var track = function (name, data) { try { data = data || {}; data.quiz = D.slug; data.src = src; if (window.umami) window.umami.track(name, data); } catch (e) {} };

  var el = function (tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function keepInView() {
    var r = box.getBoundingClientRect();
    if (r.top < 70 || r.top > window.innerHeight * 0.45) window.scrollTo({ top: r.top + window.scrollY - 84, behavior: "smooth" });
  }

  function show(i) {
    var q = D.qs[i];
    box.innerHTML = "";
    var head = el("div", "qz-head");
    head.appendChild(el("span", "qz-count", "Question " + (i + 1) + " of " + D.qs.length));
    if (i > 0) {
      var back = el("button", "qz-back", "Back");
      back.type = "button";
      back.onclick = function () { answers.pop(); show(i - 1); };
      head.appendChild(back);
    }
    box.appendChild(head);
    var bar = el("div", "qz-bar"); var fill = el("span"); fill.style.width = (i / D.qs.length * 100) + "%"; bar.appendChild(fill); box.appendChild(bar);
    var h = el("h3", "qz-q", esc(q[0])); h.tabIndex = -1; box.appendChild(h);
    var list = el("div", "qz-opts");
    q[1].forEach(function (text, k) {
      var o = el("button", "qz-opt", "<b>" + L[k] + "</b><span>" + esc(text) + "</span>");
      o.type = "button";
      o.onclick = function () {
        o.classList.add("is-on");
        answers[i] = k;
        if (!started) { started = true; track("quiz-start"); }
        if (i === 3) track("quiz-halfway");
        setTimeout(function () { if (i + 1 < D.qs.length) { show(i + 1); keepInView(); } else result(); }, 180);
      };
      list.appendChild(o);
    });
    box.appendChild(list);
    if (i > 0) try { h.focus({ preventScroll: true }); } catch (e) {}
  }

  // ---------- story image (1080x1920) ----------
  function wrap(ctx, text, maxW) {
    var words = text.split(" "), lines = [], cur = "";
    words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  function loadImg(url) { return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = url; }); }
  function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function storyImage(R) {
    var W = 1080, H = 1920, c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d");
    var fonts = ["600 120px Fraunces", "italic 600 120px Fraunces", "700 40px 'DM Sans'", "500 46px 'DM Sans'"];
    var ready = document.fonts && document.fonts.load ? Promise.all(fonts.map(function (f) { return document.fonts.load(f).catch(function () {}); })) : Promise.resolve();
    return Promise.all([ready, loadImg("/logo-tile.svg")]).then(function (r) {
      var logo = r[1], tint = D.tint || "#f4b8c4";
      x.fillStyle = "#fff3e2"; x.fillRect(0, 0, W, H);
      var g = x.createRadialGradient(160, 220, 0, 160, 220, 950); g.addColorStop(0, tint); g.addColorStop(1, "rgba(255,243,226,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
      var g2 = x.createRadialGradient(960, 1760, 0, 960, 1760, 820); g2.addColorStop(0, "rgba(247,217,154,.95)"); g2.addColorStop(1, "rgba(255,243,226,0)"); x.fillStyle = g2; x.fillRect(0, 0, W, H);
      // brand
      x.textAlign = "left"; x.fillStyle = "#3b2218"; x.font = "600 62px Fraunces, Georgia, serif";
      var bw = x.measureText("RelationshipAI").width, bx = W / 2 - (bw + 112) / 2;
      if (logo) x.drawImage(logo, bx, 168, 92, 92);
      x.fillText("RelationshipAI", bx + 112, 234);
      // card
      var cx = 80, cy = 340, cw = W - 160, ch = 1180;
      x.fillStyle = "#3b2218"; roundRect(x, cx + 14, cy + 14, cw, ch, 64); x.fill();
      x.fillStyle = "#fffaf2"; roundRect(x, cx, cy, cw, ch, 64); x.fill();
      x.lineWidth = 4; x.strokeStyle = "#3b2218"; x.stroke();
      x.textAlign = "center";
      x.font = "700 36px 'DM Sans', sans-serif";
      var kick = ("My result · " + (D.kicker || "Quiz")).toUpperCase();
      var kw = x.measureText(kick).width + 64;
      x.fillStyle = tint; roundRect(x, W / 2 - kw / 2, cy + 90, kw, 74, 37); x.fill(); x.lineWidth = 3; x.strokeStyle = "#3b2218"; x.stroke();
      x.fillStyle = "#3b2218"; x.fillText(kick, W / 2, cy + 140);
      var size = 140; x.font = "italic 600 " + size + "px Fraunces, Georgia, serif";
      var lines = wrap(x, R.name, cw - 120);
      while (lines.length > 2 && size > 90) { size -= 10; x.font = "italic 600 " + size + "px Fraunces, Georgia, serif"; lines = wrap(x, R.name, cw - 120); }
      var y = cy + 330;
      x.fillStyle = "#8a4a30";
      lines.forEach(function (l) { x.fillText(l, W / 2, y); y += size * 1.05; });
      x.fillStyle = "#3b2218"; x.font = "500 50px 'DM Sans', sans-serif";
      y += 36;
      wrap(x, R.line, cw - 160).forEach(function (l) { x.fillText(l, W / 2, y); y += 66; });
      y += 54; x.font = "700 32px 'DM Sans', sans-serif"; x.fillStyle = "#b03a60"; x.fillText("MY STRENGTHS", W / 2, y); y += 64;
      x.font = "500 40px 'DM Sans', sans-serif"; x.fillStyle = "#4a2d20";
      (R.good || []).slice(0, 2).forEach(function (s) { wrap(x, s, cw - 180).forEach(function (l) { x.fillText(l, W / 2, y); y += 54; }); y += 16; });
      x.fillStyle = "#3b2218"; x.font = "600 66px Fraunces, Georgia, serif";
      x.fillText("What's yours?", W / 2, cy + ch - 120);
      x.font = "700 38px 'DM Sans', sans-serif"; x.fillStyle = "#8a4a30";
      x.fillText("relationshipaiadvice.com/quiz", W / 2, cy + ch - 58);
      x.font = "500 36px 'DM Sans', sans-serif"; x.fillStyle = "#4a2d20";
      x.fillText("Free 2-minute relationship quizzes", W / 2, 1640);
      return new Promise(function (res) { c.toBlob(function (b) { res(b); }, "image/png"); });
    });
  }

  function result() {
    var n = D.results.length, counts = [];
    for (var k = 0; k < n; k++) counts[k] = 0;
    answers.forEach(function (a) { counts[a]++; });
    var order = counts.map(function (c, k) { return [c, k]; }).sort(function (a, b) { return b[0] - a[0] || a[1] - b[1]; });
    var main = order[0][1], second = order[1][0] > 0 && order[1][0] >= order[0][0] - 1 ? order[1][1] : -1;
    var R = D.results[main];
    track("quiz-result", { result: R.name });
    var letters = answers.map(function (a) { return L[a]; }).join(" ");
    box.innerHTML = "";
    var r = el("div", "qz-result");
    r.appendChild(el("span", "qz-count", "Your result · your answers: " + letters));
    r.appendChild(el("h3", "qz-r-name", "Mostly " + L[main] + ": <em>" + esc(R.name) + "</em>"));
    r.appendChild(el("p", "qz-r-line", esc(R.line)));
    var shareRow = el("div", "qz-r-share");
    var shareImg = el("button", "qz-share-img", "Share my result " + arrow);
    shareImg.type = "button";
    shareImg.onclick = function () {
      shareImg.disabled = true;
      storyImage(R).then(function (blob) {
        shareImg.disabled = false;
        if (!blob) return;
        var file = new File([blob], "my-" + D.slug + "-result.png", { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          track("quiz-share-image", { result: R.name, how: "share" });
          navigator.share({ files: [file], title: "My result", text: "I got " + R.name + ". Take the quiz: " + location.origin + location.pathname }).catch(function () {});
        } else {
          track("quiz-share-image", { result: R.name, how: "download" });
          var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
          shareImg.innerHTML = "Saved. Post it to your story " + arrow;
        }
      });
    };
    var share = el("button", "qz-share", "Send the quiz to your partner");
    share.type = "button";
    share.onclick = function () {
      var url = location.origin + location.pathname;
      track("quiz-share-link");
      if (navigator.share) { navigator.share({ title: document.title, text: "I got " + R.name + ". What do you get?", url: url }).catch(function () {}); }
      else if (navigator.clipboard) { navigator.clipboard.writeText(url).then(function () { share.textContent = "Link copied"; }); }
    };
    shareRow.appendChild(shareImg); shareRow.appendChild(share);
    r.appendChild(shareRow);
    r.appendChild(el("p", "qz-r-text", esc(R.text)));
    if (second >= 0) r.appendChild(el("p", "qz-r-mix", "You also scored high on <b>" + esc(D.results[second].name) + "</b>. Most people are a mix, so read both."));
    var cols = el("div", "qz-r-cols");
    cols.appendChild(el("div", "qz-r-col", "<h4>Your strengths</h4><ul>" + R.good.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"));
    cols.appendChild(el("div", "qz-r-col", "<h4>Watch out for</h4><ul>" + R.watch.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"));
    r.appendChild(cols);
    r.appendChild(el("div", "qz-r-tip", "<h4>Try this week</h4><p>" + esc(R.tip) + "</p>"));
    var cta = el("div", "qz-r-cta");
    cta.innerHTML = "<p>" + esc(D.tool[3]) + "</p>" +
      '<div class="qz-r-btns"><a class="hx-btn" href="' + D.reg + '?quiz=' + encodeURIComponent(D.slug) + '&qr=' + main + '" data-umami-event="quiz-cta-register-' + D.slug + '">Try it free</a></div>';
    r.appendChild(cta);
    var acts = el("div", "qz-r-acts");
    acts.innerHTML = '<a class="qz-link" href="' + D.article[0] + '" data-umami-event="quiz-article-' + D.slug + '">Read: ' + esc(D.article[1]) + " " + arrow + "</a>";
    var again = el("button", "qz-again", "Retake");
    again.type = "button";
    again.onclick = function () { answers = []; show(0); keepInView(); };
    acts.appendChild(again);
    r.appendChild(acts);
    box.appendChild(r);
    var top = box.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top: top, behavior: "smooth" });
  }

  show(0);
})();
