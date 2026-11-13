/* RelationshipAI get-started funnel. One screen per step; answers stay in memory only.
   The last step sends people to the free sign-up in the app. Nothing from the quiz is sent anywhere. */
(function () {
  'use strict';

  var HEART = 'M50 88 C20 64 6 46 6 30 C6 16 17 8 29 8 C38 8 46 13 50 21 C54 13 62 8 71 8 C83 8 94 16 94 30 C94 46 80 64 50 88 Z';
  var T0 = Date.now();

  /* ---------- icons ---------- */
  var IC = {
    chat: '<path d="M4 5h16v11H9l-4 4v-4H4z"/>',
    heart: '<path d="M12 20s-7-4.4-9-9c-1.4-3.4.4-6.5 3.6-6.5 2 0 3.5 1.1 4.4 2.6l1-.1c.9-1.400 2.400-2.500 4.400-2.500 3.200 0 5 3.100 3.600 6.500-2 4.600-8 9-8 9z"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.500V12l3 2"/>',
    moon: '<path d="M20 14.500A8 8 0 1 1 9.500 4a6.500 6.500 0 0 0 10.500 10.500z"/>',
    spark: '<path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800z"/><path d="M19 17v4M17 19h4"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2.500"/><path d="M11 18h2"/>',
    door: '<path d="M6 21V4h12v17M4 21h16"/><circle cx="15" cy="12.500" r=".8"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    cup: '<path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.300"/><path d="M17 14.500c2.400 0 4 1.600 4 3.500"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1"/><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
    wave: '<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>',
    shield: '<path d="M12 3l8 3v6c0 4.500-3.400 8-8 9-4.600-1-8-4.500-8-9V6z"/>',
    ghost: '<path d="M6 21V11a6 6 0 0 1 12 0v10l-3-2-3 2-3-2z"/><circle cx="10" cy="11" r=".9"/><circle cx="14" cy="11" r=".9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.400 1.400M17.600 17.600L19 19M19 5l-1.400 1.400M6.400 17.600L5 19"/>'
  };
  var CK = '<span class="qz-ck" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="' + HEART + '" fill="#f58fab"/></svg></span>';
  function photo(file, pos, icon) {
    return '<span class="qz-ph"><img src="' + PH + file + '.webp?v=2" alt="" width="600" height="600" decoding="async" draggable="false" style="--pos:' + (pos || '50% 35%') + '">' + (icon ? ic(icon) : '') + CK + '</span>';
  }
  function warm(list) { (list || []).forEach(function (f) { var im = new Image(); im.src = PH + f + '.webp?v=2'; }); }
  function ic(name) { return '<span class="qz-ic"><svg viewBox="0 0 24 24" aria-hidden="true">' + (IC[name] || '') + '</svg></span>'; }

  /* ---------- content ---------- */
  var PH = '/img/quiz/';
  var QUESTIONS = [
    { id: 'why', h: 'What brings you here?', opts: [
      ['We fight about the same things', 'bolt', 'why-fight', '50% 40%'], ['I overthink every text', 'chat', 'why-overthink', '45% 40%'],
      ['A hard talk is coming up', 'door', 'why-talk', '40% 40%'], ['Just curious about me', 'eye', 'why-curious', '50% 35%'] ] },
    { id: 'status', h: 'Where are you right now?', opts: [
      ['Single, and learning', 'sun', 'st-single', '50% 40%'], ['Dating someone', 'heart', 'st-dating', '40% 35%'],
      ['In a relationship', 'users', 'st-rel', '50% 45%'], ['It’s complicated', 'link', 'st-compl', '50% 40%'] ] },
    { id: 'hard', h: 'Which moment is the hardest?', opts: [
      ['Waiting for a reply', 'clock', 'hd-wait', '55% 40%'], ['The hour after a fight', 'moon', 'hd-after', '65% 45%'],
      ['Saying how I really feel', 'chat', 'hd-feel', '60% 45%'], ['Feeling distance grow', 'wave', 'hd-dist', '50% 45%'] ] }
  ];

  // each pair: [a, b]; every option adds one point to a style
  var PAIRS = [
    [ { t: 'I keep checking my phone for their reply.', i: 'phone', s: 'A', p: 'p1a', pos: '45% 50%' },
      { t: 'A day without texting? Totally fine.', i: 'cup', s: 'V', p: 'p1b', pos: '50% 60%' } ],
    [ { t: 'After a fight I need to talk it out now.', i: 'chat', s: 'A', p: 'p2a', pos: '72% 45%' },
      { t: 'After a fight I need space first.', i: 'door', s: 'V', p: 'p2b', pos: '50% 45%' } ],
    [ { t: 'I fear I’ll be too much if I ask for more.', i: 'ghost', s: 'F', p: 'p3a', pos: '40% 50%' },
      { t: 'Being close and being apart both feel okay.', i: 'shield', s: 'S', p: 'p3b', pos: '55% 50%' } ],
    [ { t: 'I say “it’s fine” when it isn’t.', i: 'wave', s: 'V', p: 'p4a', pos: '30% 40%' },
      { t: 'I say what I feel, kindly, and let it go.', i: 'sun', s: 'S', p: 'p4b', pos: '50% 50%' } ],
    [ { t: 'I overthink every message before I send it.', i: 'eye', s: 'A', p: 'p5a', pos: '45% 45%' },
      { t: 'I pull back when things get too intense.', i: 'door', s: 'V', p: 'p5b', pos: '88% 55%' } ]
  ];

  var RESULTS = {
    A: { name: 'The Anxious Heart', tag: 'You love with your whole chest.',
         gift: 'Devotion', hard: 'The waiting', desc: 'You notice every shift in tone and reach for closeness fast. When love feels uncertain, you lean in.', tip: 'say the need out loud, calmly, instead of sending the 2am text.',
         txt: 'You notice every shift in tone and reach for closeness fast. Your gift is devotion. Your hard part is the waiting.',
         bg: '#f58fab', hearts: ['#fff3e2', '#f9d98a', '#fff3e2', '#f9d98a'], key: 'anxious', trait: [.12, .2, .1, .4],
         before: 'Why haven’t you replied?? I guess I don’t matter.',
         after: 'I’m feeling a little anxious waiting to hear from you. Could you send me a quick note when you can?',
         note: ['Reads as: panic', 'Your need is reassurance. Say that instead of the accusation.'] },
    V: { name: 'The Guarded Heart', tag: 'You feel deeply, quietly.',
         gift: 'Steadiness', hard: 'Letting people see the storm', desc: 'You protect your calm by keeping some distance. You care deeply, you just show it quietly.', tip: 'name the pause and promise a return, so space never feels like leaving.',
         txt: 'You protect your calm by keeping some distance. Your gift is steadiness. Your hard part is letting people see the storm.',
         bg: '#f9d98a', hearts: ['#3b2218', '#f58fab', '#3b2218', '#f58fab'], key: 'avoidant', trait: [.85, .8, .8, .6],
         before: 'Fine. Do whatever you want.',
         after: 'I need a little time to think. I’ll come back to you tonight, and I do want to talk.',
         note: ['Reads as: cold', 'Name the pause and promise a return. Space stops feeling like leaving.'] },
    S: { name: 'The Steady Heart', tag: 'You bring the warm, calm room.',
         gift: 'Balance', hard: 'Patience on anxious days', desc: 'You can ask for what you need and hear a no without falling apart. You make the room feel safe.', tip: 'keep you steady, and give you words for the days your partner is not.',
         txt: 'You can ask for what you need and hear a no without falling apart. Your gift is balance. Your hard part is staying patient with anxious days.',
         bg: '#f8c7a3', hearts: ['#f58fab', '#f9d98a', '#f58fab', '#f9d98a'], key: 'secure', trait: [.5, .3, .45, .3],
         before: 'You always do this.',
         after: 'When plans change last minute I feel a bit sidelined. Can we find a better way to handle it?',
         note: ['Reads as: blame', 'Swap “always” for a feeling and a small ask.'] },
    F: { name: 'The Push-Pull Heart', tag: 'You want closeness and fear it.',
         gift: 'Depth', hard: 'The whiplash', desc: 'Part of you runs toward love and part of you braces for impact. You feel everything, fully.', tip: 'say both halves out loud and move at a pace you trust.',
         txt: 'Part of you runs toward love and part of you braces for impact. Your gift is depth. Your hard part is the whiplash.',
         bg: '#f58fab', hearts: ['#f9d98a', '#3b2218', '#f9d98a', '#3b2218'], key: 'fearful', trait: [.5, .6, .15, .75],
         before: 'Come here. No wait, just leave me alone.',
         after: 'I want to be close and I also feel overwhelmed. Can we go slowly and stay connected?',
         note: ['Reads as: mixed signals', 'Say both halves out loud. That is the whole skill.'] }
  };
  var TRAITS = [['Needs closeness', 'Needs space'], ['Talks it out', 'Goes quiet'], ['Reads every sign', 'Takes it as it comes'], ['Quick to trust', 'Slow to trust']];

  /* ---------- helpers ---------- */
  function clover(cols, size) {
    var out = '<svg viewBox="0 0 164 164" aria-hidden="true">';
    for (var k = 0; k < 4; k++) {
      out += '<g class="hh"><g transform="translate(82 82) rotate(' + (k * 90) + ') translate(0 -13) scale(.8) translate(-50 -88)"><path d="' + HEART + '" fill="' + cols[k] + '"/></g></g>';
    }
    return out + '</svg>';
  }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function track(name) { try { if (window.umami && window.umami.track) window.umami.track(name); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  /* ---------- state ---------- */
  var root = null, stage = null, top = null, prog = null, back = null;
  var standalone = document.body && document.body.hasAttribute('data-qz-standalone');
  var isOpen = false;
  var answers = {};
  var score = { A: 0, V: 0, S: 0, F: 0 };
  var result = null;
  var timers = [];
  var steps = [];
  var idx = 0;
  var hist = [];

  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  // build the step list
  QUESTIONS.forEach(function (q, n) { steps.push({ id: 'q-' + q.id, pct: 8 + n * 8, fn: function (go) { sQuestion(q, go); } }); });
  steps.push({ id: 'pairs', pct: 34, fn: sPairs });
  steps.push({ id: 'reveal', pct: 54, fn: sReveal });
  steps.push({ id: 'gen', pct: 66, fn: sGen, auto: true, noBack: true });
  steps.push({ id: 'replies', pct: 80, fn: sReplies });
  steps.push({ id: 'email', pct: 100, fn: sEmail });

  function warmStep(i) {
    var q = QUESTIONS[i];
    if (q && steps[i] && /^q-/.test(steps[i].id)) warm(q.opts.map(function (o) { return o[2]; }));
    else if (steps[i] && steps[i].id === 'pairs') warm(PAIRS[0].map(function (o) { return o.p; }));
  }
  function show(i, dir) {
    clearTimers();
    var s = steps[i];
    idx = i;
    warmStep(i + 1);
    var old = stage.firstElementChild;
    if (old) { old.classList.add('out'); setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 280); }
    var node = el('<section class="qz-step' + (dir === 'back' ? ' back' : '') + '" data-step="' + s.id + '"></section>');
    stage.appendChild(node);
    var next = function () { go(i + 1); };
    s.fn(next, node);
    top.hidden = false;
    back.disabled = !!s.noBack || i === 0;
    back.style.visibility = s.noBack ? 'hidden' : 'visible';
    prog.style.width = s.pct + '%';
    prog.parentNode.setAttribute('aria-valuenow', s.pct);
    track('start-step-' + s.id);
    var f = node.querySelector('input,button.qz-btn');
    if (f && s.id === 'email') { /* don't auto-focus on touch: avoids the keyboard jump */ }
  }
  function go(i) { if (i >= steps.length) return; hist.push(idx); show(i); }
  function onBack() {
    var s = steps[idx];
    if (s.noBack || !hist.length) return;
    var prev = hist.pop();
    // never land on auto steps
    while (steps[prev] && steps[prev].auto && hist.length) prev = hist.pop();
    if (steps[prev].id === 'pairs') { score = { A: 0, V: 0, S: 0, F: 0 }; pairN = 0; }
    show(prev, 'back');
  }

  /* ---------- steps ---------- */
  function sIntro(next, node) {
    node.className += ' qz-intro';
    node.innerHTML =
      '<div class="art"><picture><source media="(max-width: 760px)" srcset="/img/hero-scene-m.webp" /><img src="/img/hero-scene.webp" alt="" width="2560" height="1333" fetchpriority="high" /></picture><div class="brand"><img src="/logo-tile.svg" alt="" /><span>Relationship<b>AI</b></span></div></div>' +
      '<div class="body"><h1>Know how <em>you</em> love.</h1>' +
      '<p class="qz-sub">A few quick questions on how you text, fight and make up. Then a coach that speaks your language.</p>' +
      '<button type="button" class="qz-btn" data-umami-event="start-begin">Get started ' + ARROW + '</button>' +
      '<div class="qz-note"><span>Free</span><span>90 seconds</span><span>No card</span></div></div>';
    node.querySelector('.qz-btn').addEventListener('click', next);
  }

  function sQuestion(q, next, node) {
    node = stage.lastElementChild;
    var html = '<h2 class="qz-h">' + esc(q.h) + '</h2><div class="qz-opts">';
    q.opts.forEach(function (o, n) { html += '<button type="button" class="qz-opt" data-n="' + n + '">' + photo(o[2], o[3], o[1]) + '<span class="qz-lb">' + esc(o[0]) + '</span></button>'; });
    html += '</div><p class="qz-foot">You can change anything later.</p>';
    node.innerHTML = html;
    node.querySelectorAll('.qz-opt').forEach(function (b) {
      b.addEventListener('click', function () {
        node.querySelectorAll('.qz-opt').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel');
        answers[q.id] = q.opts[+b.dataset.n][0];
        later(next, 380);
      });
    });
  }

  var pairN = 0;
  function sPairs(next, node) {
    node = stage.lastElementChild;
    pairN = 0;
    node.innerHTML = '<h2 class="qz-h">Which one feels<br>more like you?</h2><span class="qz-pill" id="pcount">0 of 5</span><div class="qz-pair" id="pair"></div><p class="qz-pairtext">Tap the one that’s closer. No wrong answers.</p><div class="qz-foot"><button type="button" class="qz-link" id="pskip">Neither. Skip this one</button></div>';
    var box = node.querySelector('#pair');
    var count = node.querySelector('#pcount');
    function render() {
      var p = PAIRS[pairN];
      if (PAIRS[pairN + 1]) warm(PAIRS[pairN + 1].map(function (o) { return o.p; }));
      count.textContent = (pairN + 1) + ' of 5';
      box.className = 'qz-pair swap';
      box.innerHTML = '';
      p.forEach(function (o, n) {
        var b = el('<button type="button" class="qz-pc" data-n="' + n + '">' + photo(o.p, o.pos, o.i) +
          '<p>' + esc(o.t) + '</p></button>');
        b.addEventListener('click', function () { choose(n); });
        box.appendChild(b);
      });
      void box.offsetWidth;
    }
    function advance() {
      pairN++;
      if (pairN >= PAIRS.length) { later(next, 150); return; }
      render();
    }
    function choose(n) {
      var cards = box.querySelectorAll('.qz-pc');
      if (box.dataset.lock) return;
      box.dataset.lock = '1';
      cards[n].classList.add('sel');
      score[PAIRS[pairN][n].s]++;
      later(function () { box.classList.add('leaving'); }, 330);
      later(function () { delete box.dataset.lock; advance(); }, 520);
    }
    node.querySelector('#pskip').addEventListener('click', function () { if (!box.dataset.lock) advance(); });
    render();
  }

  function decide() {
    var A = score.A, V = score.V, S = score.S, F = score.F;
    if (F >= 1 && (A + F >= 2) && V >= 1) return 'F';
    if (F >= 2) return 'F';
    var best = 'S', max = -1;
    [['A', A], ['V', V], ['S', S], ['F', F]].forEach(function (p) { if (p[1] > max) { max = p[1]; best = p[0]; } });
    if (max === 0) return 'S';
    // tie between anxious and avoidant reads as push-pull
    if (A === V && A > S && A >= 2) return 'F';
    return best;
  }

  var DECO = [[8, 14, 20, -14, .5], [84, 10, 26, 18, .45], [90, 58, 18, 24, .4], [12, 70, 24, -22, .38], [70, 86, 16, 8, .35], [32, 90, 14, -8, .3], [50, 6, 12, 12, .3]];
  function artHTML() {
    var d = '';
    DECO.forEach(function (o, n) {
      d += '<svg class="fl" style="left:' + o[0] + '%;top:' + o[1] + '%;width:' + o[2] + 'px;--r:' + o[3] + 'deg;opacity:' + o[4] + ';animation-delay:-' + (n * 0.9) + 's" viewBox="0 0 100 100" aria-hidden="true"><path d="' + HEART + '" fill="#fff3e2"/></svg>';
    });
    return '<div class="rc-art"><i class="ring"></i><i class="ring r2"></i>' + d + clover(result.hearts).replace('<svg ', '<svg class="clv" ') + '</div>';
  }
  function sReveal(next, node) {
    node = stage.lastElementChild;
    result = RESULTS[decide()];
    root.style.setProperty('--rbg', result.bg);
    track('start-result-' + result.key);
    node.innerHTML = '<h2 class="qz-h" id="rh">A pattern is showing up\u2026</h2><div class="qz-load" id="rl"><div class="sk"></div><div class="ln"></div><div class="ln s"></div></div>';
    later(function () {
      var h = node.querySelector('#rh'), rl = node.querySelector('#rl');
      h.classList.add('flip'); rl.classList.add('gone');
      later(function () {
        h.textContent = 'Here\u2019s your style.'; h.classList.remove('flip');
        var traits = '';
        TRAITS.forEach(function (t, n) { traits += '<div class="qz-tr"><span>' + t[0] + '</span><i style="--p:' + Math.round(result.trait[n] * 100) + '%"></i><span>' + t[1] + '</span></div>'; });
        var nm = result.name, cut = nm.lastIndexOf(' ');
        var rcHTML =
          '<div class="qz-rc" style="--rbg:' + result.bg + '">' + artHTML() +
          '<div class="rc-body"><span class="rc-eye">Your attachment style</span>' +
          '<h3>' + nm.slice(0, cut) + ' <em>' + nm.slice(cut + 1) + '</em></h3>' +
          '<p class="rc-tag">' + result.tag + '</p><p class="rc-desc">' + result.desc + '</p>' +
          '<div class="rc-facts"><div><small>Your gift</small><b>' + result.gift + '</b></div><div><small>Your hard part</small><b>' + result.hard + '</b></div></div>' +
          '<div class="rc-tip"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + HEART + '" fill="#f58fab"/></svg><p><b>Your coach will</b> ' + result.tip + '</p></div></div></div>';
        rl.outerHTML = rcHTML +
          '<h3 class="qz-trh">The traits you lean toward</h3><div class="qz-traits">' + traits + '</div>' +
          '<div class="qz-sticky over"><button type="button" class="qz-btn" data-umami-event="start-reveal-continue">Continue ' + ARROW + '</button><p class="qz-legal" style="margin-top:10px">For fun and reflection, not a diagnosis.</p></div>';
        node.querySelector('.qz-btn').addEventListener('click', next);
        node.scrollTo({ top: 0 });
      }, 260);
    }, 2300);
  }

  function sGen(next, node) {
    node = stage.lastElementChild;
    node.className += ' qz-gen';
    node.innerHTML = '<div class="logo">' + clover(['#f9d98a', '#f58fab', '#f9d98a', '#f58fab']).replace('<svg ', '<svg class="" ').replace(/class="hh"/g, 'class="p"') + '</div>' +
      '<div class="bar"><i></i></div><div class="msg" id="gm"></div>';
    var msgs = ['Reading your pattern…', 'Matching your tone…', 'Warming up your coach…'];
    var gm = node.querySelector('#gm');
    msgs.forEach(function (m, n) { later(function () { gm.textContent = m; }, n * 1150); });
    later(next, 3700);
  }

  function sReplies(next, node) {
    node = stage.lastElementChild;
    node.innerHTML = '<h2 class="qz-h">Real replies.<br>In your voice.</h2><p class="qz-sub">Here’s how your coach would rework a message in your pattern.</p>' +
      '<div class="qz-seg" role="tablist"><button type="button" class="on" data-m="before" role="tab">Before</button><button type="button" data-m="after" role="tab">After</button></div>' +
      '<div class="qz-phone"><div class="who"><i></i>Message check</div><div class="qz-swap" id="sw"></div></div>' +
      '<div class="qz-sticky" style="margin-top:auto"><button type="button" class="qz-btn" data-umami-event="start-replies-continue">Continue ' + ARROW + '</button></div>';
    var sw = node.querySelector('#sw');
    var btns = node.querySelectorAll('.qz-seg button');
    function paint(m) {
      sw.classList.add('fade');
      later(function () {
        sw.innerHTML = m === 'before'
          ? '<div class="qz-b me">' + esc(result.before) + '</div><div class="qz-b note"><small>' + esc(result.note[0]) + '</small>Likely to start a fight.</div>'
          : '<div class="qz-b note"><small>Your coach suggests</small>' + esc(result.note[1]) + '</div><div class="qz-b me">' + esc(result.after) + '</div>';
        sw.classList.remove('fade');
      }, 220);
      btns.forEach(function (b) { b.classList.toggle('on', b.dataset.m === m); });
    }
    btns.forEach(function (b) { b.addEventListener('click', function () { clearTimers(); paint(b.dataset.m); }); });
    sw.innerHTML = '';
    paint('before');
    var cur = 'before', loop = function () { later(function () { cur = cur === 'before' ? 'after' : 'before'; paint(cur); loop(); }, 3400); };
    loop();
    node.querySelector('.qz-btn').addEventListener('click', next);
  }

  var VP = [
    { h: 'Rehearse the hard talk.', p: 'An AI plays your partner so you can practice with nothing at stake, then gives you a short debrief.',
      vis: '<div class="qz-phone" style="margin:0"><div class="who"><i></i>Practice with Alex</div><div class="qz-b me">There’s something I want to tell you.</div><div class="qz-b ai">Okay. I’m listening.</div><div class="qz-b note"><small>Debrief</small>Calm start, clear feeling. Next time: say what you need.</div></div>' },
    { h: 'Check it before you send.', p: 'Paste a message and see how it may land, with a calmer, warmer or more direct version.',
      vis: '<div class="qz-phone" style="margin:0"><div class="who"><i></i>Message check</div><div class="qz-b me">Fine. Do whatever you want.</div><div class="qz-b note"><small>Reads as cold</small>Likely to start a fight.</div><div class="qz-b ai">I’m upset you didn’t tell me. Can we talk tonight?</div></div>' },
    { h: 'A coach that remembers.', p: 'It knows your partner and your past chats, so you never start from zero, even at 2am.',
      vis: '<div class="qz-phone" style="margin:0"><div class="who"><i></i>Coach Chat</div><div class="qz-b me">He went quiet again.</div><div class="qz-b note"><small>Remembers</small>He withdraws when stressed.</div><div class="qz-b ai">That’s his stress pattern, not rejection.</div></div>' }
  ];
  function sVP(n, next) {
    var node = stage.lastElementChild, v = VP[n];
    node.className += ' qz-vp';
    var dots = '';
    for (var k = 0; k < 3; k++) dots += '<i' + (k === n ? ' class="on"' : '') + '></i>';
    node.innerHTML = '<div class="vis">' + v.vis + '</div><h2>' + v.h + '</h2><p class="qz-sub">' + v.p + '</p><div class="qz-dots">' + dots + '</div>' +
      '<div class="qz-sticky"><button type="button" class="qz-btn" data-umami-event="start-vp-' + (n + 1) + '">Continue ' + ARROW + '</button></div>';
    node.querySelector('.qz-btn').addEventListener('click', next);
  }

  var SAVED = null;
  function sEmail(next) {
    var node = stage.lastElementChild;
    node.innerHTML = '<h2 class="qz-h">Your coach is ready.<br>Try it free.</h2>' +
      '<p class="qz-sub">Create a free account and talk through what is on your mind, with a coach that fits how you love.</p>' +
      '<div class="qz-chips"><span>Free to start</span><span>No card</span><span>Private</span></div>' +
      (result ? '<div class="qz-credit" style="margin-top:22px"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="' + HEART + '" fill="#f58fab"/></svg><div><b>' + esc(result.name) + '</b><span>' + esc(result.tag) + '</span></div></div>' : '') +
      '<div class="qz-spacer"></div>' +
      '<a class="qz-btn" href="https://app.relationshipaiadvice.com/register.html" data-umami-event="start-signup" style="margin-top:26px;text-decoration:none">Try it free ' + ARROW + '</a>' +
      '<p class="qz-legal" style="font-size:14px">Already have an account? <a href="https://app.relationshipaiadvice.com/login.html" data-umami-event="start-login">Log in</a></p>';
  }

  function sDone(next) {
    var node = stage.lastElementChild;
    node.className += ' qz-done';
    var shareUrl = 'https://relationshipaiadvice.com/start/';
    node.innerHTML = '<div class="tick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.500l4.500 4.500L19 7.500"/></svg></div>' +
      '<h2 class="qz-h">You’re on the list.</h2><p class="qz-sub">We’ll email you once, the day RelationshipAI opens. Your result will be inside.</p>' +
      '<div class="mini" style="--rbg:' + result.bg + '"><div class="m">' + clover(result.hearts) + '</div><div><small>Your style</small><b>' + result.name + '</b></div></div>' +
      '<div class="btns"><button type="button" class="qz-btn" id="sh" data-umami-event="start-share">Share with someone</button>' +
      '<a class="qz-btn ghost" href="/" data-umami-event="start-back-home">Back to the site</a></div>';
    var sh = node.querySelector('#sh');
    sh.addEventListener('click', function () {
      var text = 'I got ' + result.name + '. What’s your attachment style?';
      if (navigator.share) { navigator.share({ title: 'Attachment style', text: text, url: shareUrl }).catch(function () {}); return; }
      var done = function () { sh.textContent = 'Link copied'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(shareUrl).then(done, done); else done();
    });
  }

  /* ---------- mount: overlay on the landing page, or standalone on /start/ ---------- */
  var X_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  function build() {
    root = document.createElement('div');
    root.className = 'qz-ov';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Get started with RelationshipAI');
    root.tabIndex = -1;
    root.innerHTML =
      '<div class="qz-bg" aria-hidden="true"></div><main class="qz-col" aria-live="polite">' +
      '<header class="qz-top"><a class="qz-brand" href="/" aria-label="RelationshipAI home"><img src="/logo-tile.svg" alt="" width="34" height="34" /><span>Relationship<b>AI</b></span></a>' +
      '<button type="button" class="qz-back" aria-label="Back"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<div class="qz-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></div>' +
      '<button type="button" class="qz-x" aria-label="Close">' + X_SVG + '</button></header>' +
      '<div class="qz-stage"></div></main>';
    document.body.appendChild(root);
    stage = root.querySelector('.qz-stage');
    top = root.querySelector('.qz-top');
    prog = root.querySelector('.qz-prog i');
    back = root.querySelector('.qz-back');
    back.addEventListener('click', onBack);
    root.querySelector('.qz-x').addEventListener('click', requestClose);
    root.querySelector('.qz-brand').addEventListener('click', function (e) { if (!standalone) { e.preventDefault(); requestClose(); } });
  }
  function reset() {
    clearTimers();
    answers = {}; score = { A: 0, V: 0, S: 0, F: 0 }; result = null; hist = []; idx = 0; pairN = 0; SAVED = null;
    root.style.removeProperty('--rbg');
    stage.innerHTML = '';
    T0 = Date.now();
    show(0);
  }
  function open() {
    if (isOpen) return;
    if (!root) build();
    isOpen = true;
    root.classList.add('on');
    if (!standalone) {
      document.documentElement.style.overflow = 'hidden';
      try { history.pushState({ qz: 1 }, '', '#get-started'); } catch (e) {}
    }
    reset();
    track('start-open');
    try { root.focus({ preventScroll: true }); } catch (e) {}
  }
  function doClose() {
    if (!isOpen || standalone) return;
    isOpen = false;
    clearTimers();
    root.classList.remove('on');
    document.documentElement.style.overflow = '';
  }
  function requestClose() {
    if (standalone) { location.href = '/'; return; }
    if (history.state && history.state.qz) history.back(); else doClose();
  }
  window.addEventListener('popstate', function () { if (isOpen && !standalone) doClose(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) requestClose(); });
  document.addEventListener('click', function (e) {
    if (standalone || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href="/start/"],a[href="/start"],a[data-qz-open]');
    if (!a) return;
    e.preventDefault();
    open();
  });
  window.RAIFunnel = { open: open };
  if (standalone) open();
})();
