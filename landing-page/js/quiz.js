// Interactive quiz for /quiz/<slug>/ pages. Data comes from #quiz-data (built by build-quiz.mjs).
(function () {
  var box = document.getElementById("quiz");
  var raw = document.getElementById("quiz-data");
  if (!box || !raw) return;
  var D = JSON.parse(raw.textContent);
  var L = "ABCDE";
  var answers = [];
  var step = 0;
  var track = function (name, data) { try { if (window.umami) window.umami.track(name, data); } catch (e) {} };
  var el = function (tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var arrow = '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  function start() {
    box.innerHTML = "";
    var s = el("div", "qz-start");
    s.appendChild(el("p", "qz-start-t", "Answer with your first instinct. There are no wrong answers."));
    var b = el("button", "hx-btn qz-begin", "Start the quiz " + arrow);
    b.type = "button";
    b.onclick = function () { track("quiz-start", { quiz: D.slug }); show(0); };
    s.appendChild(b);
    box.appendChild(s);
  }

  function show(i) {
    step = i;
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
    var bar = el("div", "qz-bar"); var fill = el("span"); fill.style.width = ((i) / D.qs.length * 100) + "%"; bar.appendChild(fill); box.appendChild(bar);
    var h = el("h3", "qz-q", esc(q[0])); h.tabIndex = -1; box.appendChild(h);
    var list = el("div", "qz-opts");
    q[1].forEach(function (text, k) {
      var o = el("button", "qz-opt", '<b>' + L[k] + '</b><span>' + esc(text) + '</span>');
      o.type = "button";
      o.onclick = function () {
        o.classList.add("is-on");
        answers[i] = k;
        setTimeout(function () { i + 1 < D.qs.length ? show(i + 1) : result(); }, 180);
      };
      list.appendChild(o);
    });
    box.appendChild(list);
    try { h.focus({ preventScroll: true }); } catch (e) {}
  }

  function result() {
    var n = D.results.length, counts = [];
    for (var k = 0; k < n; k++) counts[k] = 0;
    answers.forEach(function (a) { counts[a]++; });
    var order = counts.map(function (c, k) { return [c, k]; }).sort(function (a, b) { return b[0] - a[0] || a[1] - b[1]; });
    var main = order[0][1], second = order[1][0] > 0 && order[1][0] >= order[0][0] - 1 ? order[1][1] : -1;
    var R = D.results[main];
    track("quiz-result", { quiz: D.slug, result: R.name });
    var letters = answers.map(function (a) { return L[a]; }).join(" ");
    box.innerHTML = "";
    var r = el("div", "qz-result");
    r.appendChild(el("span", "qz-count", "Your result · your answers: " + letters));
    r.appendChild(el("h3", "qz-r-name", "Mostly " + L[main] + ": <em>" + esc(R.name) + "</em>"));
    r.appendChild(el("p", "qz-r-line", esc(R.line)));
    r.appendChild(el("p", "qz-r-text", esc(R.text)));
    if (second >= 0) r.appendChild(el("p", "qz-r-mix", "You also scored high on <b>" + esc(D.results[second].name) + "</b>. Most people are a mix, so read both."));
    var cols = el("div", "qz-r-cols");
    cols.appendChild(el("div", "qz-r-col", "<h4>Your strengths</h4><ul>" + R.good.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"));
    cols.appendChild(el("div", "qz-r-col", "<h4>Watch out for</h4><ul>" + R.watch.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"));
    r.appendChild(cols);
    r.appendChild(el("div", "qz-r-tip", "<h4>Try this week</h4><p>" + esc(R.tip) + "</p>"));
    var cta = el("div", "qz-r-cta");
    cta.innerHTML = "<h4>" + esc(D.tool[1]) + "</h4><p>" + esc(D.tool[2]) + "</p>" +
      '<div class="qz-r-btns"><a class="hx-btn" href="' + D.reg + '" data-umami-event="quiz-cta-register-' + D.slug + '">Try it free</a>' +
      '<a class="qz-link" href="' + D.tool[0] + '" data-umami-event="quiz-cta-tool-' + D.slug + '">See how it works ' + arrow + '</a></div>';
    r.appendChild(cta);
    var acts = el("div", "qz-r-acts");
    acts.innerHTML = '<a class="qz-link" href="' + D.article[0] + '" data-umami-event="quiz-article-' + D.slug + '">Read: ' + esc(D.article[1]) + ' ' + arrow + '</a>';
    var share = el("button", "qz-share", "Send this quiz to your partner");
    share.type = "button";
    share.onclick = function () {
      var url = location.origin + location.pathname;
      track("quiz-share", { quiz: D.slug });
      if (navigator.share) { navigator.share({ title: document.title, text: "I got " + R.name + ". What do you get?", url: url }).catch(function () {}); }
      else if (navigator.clipboard) { navigator.clipboard.writeText(url).then(function () { share.textContent = "Link copied"; }); }
    };
    var again = el("button", "qz-again", "Retake");
    again.type = "button";
    again.onclick = function () { answers = []; show(0); };
    acts.appendChild(share); acts.appendChild(again);
    r.appendChild(acts);
    box.appendChild(r);
    var top = box.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top: top, behavior: "smooth" });
  }

  start();
})();
