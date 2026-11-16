// Free Message check on the landing page: no account, nothing saved. Calls the app's public endpoint.
(function () {
  var card = document.getElementById("try-card");
  if (!card) return;
  var local = /^(localhost|127\.)/.test(location.hostname);
  var API = local ? "http://localhost:3010" : "https://app.relationshipaiadvice.com";
  var REG = "https://app.relationshipaiadvice.com/register.html?src=landing-try";
  var draft = document.getElementById("try-draft"), go = document.getElementById("try-go"), err = document.getElementById("try-err"), out = document.getElementById("try-out"), left = document.getElementById("try-left");
  var busy = false, remaining = null;

  function anon() {
    try {
      var id = localStorage.getItem("relateiq_anon");
      if (!id) { id = "a" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem("relateiq_anon", id); }
      return id;
    } catch (e) { return null; }
  }
  function beacon(name, where) {
    try { fetch(API + "/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ name: name, where: where || "landing", anonId: anon() }) }).catch(function () {}); } catch (e) {}
  }
  function umami(name) { try { if (window.umami && window.umami.track) window.umami.track(name); } catch (e) {} }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function setErr(msg) { err.textContent = msg || ""; err.hidden = !msg; }
  function leftText() {
    if (remaining === null) return "";
    if (remaining <= 0) return "No free checks left today";
    return remaining === 1 ? "1 free check left today" : remaining + " free checks left today";
  }
  function ctaBlock(title, text, where) {
    var box = el("div", "try-cta"); box.appendChild(el("h3", "", title)); box.appendChild(el("p", "", text));
    var a = el("a", "hx-btn", "Create free account"); a.href = REG;
    a.addEventListener("click", function () { beacon("try_cta_click", where); umami("try-landing-cta-" + where); });
    box.appendChild(a); return box;
  }

  // First view of the widget
  var seen = false;
  function onView() { if (seen) return; seen = true; beacon("try_view", "landing"); }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting) { onView(); o.disconnect(); } }); }, { threshold: 0.3 }).observe(card);
  } else onView();

  fetch(API + "/api/public/message-check").then(function (r) { return r.json(); }).then(function (d) {
    if (typeof d.remaining === "number") { remaining = d.remaining; left.textContent = leftText(); }
  }).catch(function () {});

  [].forEach.call(card.querySelectorAll(".try-ex button"), function (b) {
    b.addEventListener("click", function () { draft.value = b.getAttribute("data-ex"); draft.focus(); setErr(""); });
  });

  var LABEL = { low: "Low risk", medium: "Could go wrong", high: "High risk" };
  function render(d) {
    out.innerHTML = "";
    var read = el("div", "try-read");
    read.appendChild(el("span", "try-risk " + (d.risk || "medium"), LABEL[d.risk] || ""));
    read.appendChild(el("p", "", d.read));
    out.appendChild(read);
    if ((d.flags || []).length) { var ul = el("ul", "try-flags"); d.flags.forEach(function (f) { ul.appendChild(el("li", "", f)); }); out.appendChild(ul); }
    out.appendChild(el("h3", "try-h", "Versions you can send"));
    d.versions.forEach(function (v) {
      var box = el("div", "try-ver"), head = el("div", "try-ver-head");
      head.appendChild(el("strong", "", v.label));
      var cp = el("button", "try-copy", "Copy"); cp.type = "button";
      cp.addEventListener("click", function () { try { navigator.clipboard.writeText(v.text).then(function () { cp.textContent = "Copied"; setTimeout(function () { cp.textContent = "Copy"; }, 1500); }); } catch (e) {} });
      head.appendChild(cp); box.appendChild(head); box.appendChild(el("p", "", v.text)); out.appendChild(box);
    });
    var lock = el("div", "try-ver locked"), lh = el("div", "try-ver-head");
    lh.appendChild(el("strong", "", "Tailored to them")); lh.appendChild(el("span", "try-lock", "Free account"));
    lock.appendChild(lh); lock.appendChild(el("p", "", "Say who it is for and get a version that fits how they react.")); out.appendChild(lock);
    out.appendChild(ctaBlock("Want this every time, tailored to your partner?", "Create a free account (no card): more checks, a coach that remembers your story, and a place to rehearse the hard talk.", "after"));
  }

  go.addEventListener("click", function () {
    if (busy) return;
    var text = draft.value.trim();
    if (text.length < 3) { setErr("Paste the message you're thinking of sending."); return; }
    setErr(""); busy = true; go.disabled = true; go.textContent = "Reading it…";
    umami("try-landing-check");
    fetch(API + "/api/public/message-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: text, anonId: anon() }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        var d = res.d || {};
        if (typeof d.remaining === "number") remaining = d.remaining;
        left.textContent = leftText();
        if (!res.ok) {
          setErr(d.error || "Couldn't check that right now.");
          if (d.needAccount) { out.innerHTML = ""; out.appendChild(ctaBlock("That's your free checks for today", "Create a free account (no card) to keep checking messages and get replies that fit you.", "gate")); }
          return;
        }
        render(d);
        out.scrollIntoView({ behavior: "smooth", block: "nearest" });
      })
      .catch(function () { setErr("Couldn't connect. Please try again."); })
      .then(function () { busy = false; go.disabled = false; go.textContent = "Check my message"; });
  });
})();
