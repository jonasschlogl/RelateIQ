// Free Message check on the landing page: a chat inside a phone. No account, nothing saved.
(function () {
  var card = document.getElementById("try-card");
  if (!card) return;
  var local = /^(localhost|127\.)/.test(location.hostname);
  var API = local ? "http://localhost:3010" : "https://app.relationshipaiadvice.com";
  var WHERE = card.getAttribute("data-where") || "landing";
  var MODE = card.getAttribute("data-mode") || "";
  var REG = "https://app.relationshipaiadvice.com/register.html?src=" + (WHERE === "landing" ? "landing-try" : "try-" + WHERE);
  var draft = document.getElementById("try-draft"), go = document.getElementById("try-go"), err = document.getElementById("try-err"),
      msgs = document.getElementById("try-msgs"), left = document.getElementById("try-left");
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
    if (remaining <= 0) return "0 checks left";
    return remaining === 1 ? "1 free check left" : remaining + " free checks left";
  }
  function toBottom() { msgs.scrollTop = msgs.scrollHeight; }
  function add(node) { msgs.appendChild(node); toBottom(); return node; }
  function ctaBubble(title, text, where) {
    var box = el("div", "tw-cta"); box.appendChild(el("b", "", title)); box.appendChild(el("span", "", text));
    var a = el("a", "", "Create free account"); a.href = REG;
    a.addEventListener("click", function () { beacon("try_cta_click", WHERE + "-" + where); umami("try-" + WHERE + "-cta-" + where); });
    box.appendChild(a); return box;
  }
  function autosize() { draft.style.height = "auto"; draft.style.height = Math.min(draft.scrollHeight, 96) + "px"; }

  var seen = false;
  function onView() { if (seen) return; seen = true; beacon("try_view", WHERE); umami("try-" + WHERE + "-view"); }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es, o) { es.forEach(function (e) { if (e.isIntersecting) { onView(); o.disconnect(); } }); }, { threshold: 0.3 }).observe(card);
  } else onView();

  fetch(API + "/api/public/message-check").then(function (r) { return r.json(); }).then(function (d) {
    if (typeof d.remaining === "number") { remaining = d.remaining; left.textContent = leftText(); }
  }).catch(function () {});

  var LABEL = { low: "Low risk", medium: "Could go wrong", high: "High risk" };
  function render(d) {
    var first = null;
    var read = el("div", "tw-b ai");
    read.appendChild(el("span", "tw-risk " + (d.risk || "medium"), LABEL[d.risk] || "Read"));
    read.appendChild(el("p", "t", d.read));
    if ((d.flags || []).length) { var ul = el("ul"); d.flags.forEach(function (f) { ul.appendChild(el("li", "", f)); }); read.appendChild(ul); }
    first = add(read);
    if (d.subtext) { var st = el("div", "tw-b ai tw-sub"); st.appendChild(el("small", "", "What they may hear")); st.appendChild(el("p", "t", "\u201c" + d.subtext + "\u201d")); add(st); }
    if ((d.checks || []).length) {
      var ck = el("div", "tw-b ai tw-checks"), ok = d.checks.filter(function (c) { return c.ok; }).length;
      ck.appendChild(el("small", "", "Checklist \u00b7 " + ok + " of " + d.checks.length));
      var cl = el("ul");
      d.checks.forEach(function (c) { var li = el("li", c.ok ? "ok" : "no"); li.appendChild(el("b", "", c.label)); if (c.note) li.appendChild(el("span", "", c.note)); cl.appendChild(li); });
      ck.appendChild(cl); add(ck);
    }
    d.versions.forEach(function (v, i) {
      var b = el("div", "tw-b note" + (i ? " rose" : "")), head = el("div", "tw-head");
      head.appendChild(el("small", "", v.label));
      var cp = el("button", "tw-copy", "Copy"); cp.type = "button";
      cp.addEventListener("click", function () { try { navigator.clipboard.writeText(v.text).then(function () { cp.textContent = "Copied"; setTimeout(function () { cp.textContent = "Copy"; }, 1500); }); } catch (e) {} });
      head.appendChild(cp); b.appendChild(head); b.appendChild(el("p", "t", v.text)); add(b);
    });
    if (d.locked) { renderLocked(d.locked); return; }
    var lock = el("div", "tw-b lock"); lock.appendChild(el("small", "", "Tailored to them · free account"));
    lock.appendChild(el("p", "t", "Say who it is for and get a version that fits how they react.")); add(lock);
    add(ctaBubble("Want this every time?", "Create a free account (no card): more checks, a coach that remembers your story, and a place to rehearse the hard talk.", "after"));
    msgs.scrollTop = Math.max(0, first.offsetTop - 10);
  }

  // Tool pages: the rest of the check lives in the app. Show it, blurred, so it's clear what's missing.
  function lockedBubble(cls, label, fake) {
    var b = el("div", "tw-b tw-locked " + cls); var h = el("div", "tw-head");
    h.appendChild(el("small", "", label)); h.appendChild(el("span", "tw-lk", "Free account"));
    b.appendChild(h); b.appendChild(el("p", "t tw-blur", fake)); b.setAttribute("aria-label", label + ": available with a free account");
    return add(b);
  }
  function renderLocked(l) {
    lockedBubble("note rose", l.versionLabel || "Second version", "A second version in a different tone, written so it is easy to send as it is.");
    lockedBubble("them", "Their likely reply", "What they would most likely text back, so you know what you are walking into.");
    lockedBubble("tip", "Tip for your situation", "Whether to send it now, wait, or say it in person, and what to do if they go quiet.");
    var box = el("div", "tw-cta");
    box.appendChild(el("b", "", "See the full check in the app"));
    box.appendChild(el("span", "", "Free account, no card: their likely reply, a second version and a tip for your situation. Pro also tailors it to the person."));
    var a = el("a", "", "Unlock with a free account"); a.href = REG;
    a.addEventListener("click", function () { beacon("try_cta_click", WHERE + "-unlock"); umami("try-" + WHERE + "-unlock"); });
    box.appendChild(a); add(box);
  }

  function submit(text) {
    if (busy) return;
    text = (text || draft.value).trim();
    if (text.length < 3) { setErr("Paste the message you're thinking of sending."); return; }
    setErr(""); busy = true; go.disabled = true; umami("try-" + WHERE + "-check");
    card.classList.add("used");
    add(el("div", "tw-b me", text)); draft.value = ""; autosize();
    var typing = el("div", "tw-b ai"); var dots = el("span", "tw-dots"); dots.innerHTML = "<i></i><i></i><i></i>"; typing.appendChild(dots); add(typing);
    fetch(API + "/api/public/message-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(MODE ? { draft: text, anonId: anon(), mode: MODE } : { draft: text, anonId: anon() }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        var d = res.d || {};
        if (typeof d.remaining === "number") remaining = d.remaining;
        left.textContent = leftText();
        typing.remove();
        if (!res.ok) {
          if (d.needAccount) add(ctaBubble("That's your free checks for today", "Create a free account (no card) to keep checking messages and get replies that fit you.", "gate"));
          else add(el("div", "tw-b ai", d.error || "Couldn't check that right now. Please try again."));
          return;
        }
        render(d);
      })
      .catch(function () { typing.remove(); add(el("div", "tw-b ai", "Couldn't connect. Please try again.")); })
      .then(function () { busy = false; go.disabled = false; });
  }

  go.addEventListener("click", function () { submit(); });
  draft.addEventListener("input", autosize);
  draft.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } });
  [].forEach.call(card.querySelectorAll(".tw-ex button"), function (b) {
    b.addEventListener("click", function () { submit(b.getAttribute("data-ex")); });
  });
})();
