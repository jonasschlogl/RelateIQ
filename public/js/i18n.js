// App language: a switcher in the header plus a runtime translator for the
// interface. Dictionaries live in /i18n/<code>.json ({ "English text": "Translation" }).
// - The chosen language is kept in localStorage (relateiq_lang); English is the default.
// - Text is matched as a whole: a text node, or an element made of text and inline
//   tags (<strong>, <a>, ...), which is how the dictionaries were extracted.
//   Keys with {0}, {1} ... are patterns for text that has dynamic parts.
// - Anything without a translation simply stays English.
// - AI replies are NOT touched here; they follow the language the person writes in.
(function () {
  var LANGS = [
    { code: "en", htmlLang: "en", name: "English", short: "EN", locale: "" },
    { code: "sv", htmlLang: "sv", name: "Svenska", short: "SV", locale: "sv-SE" },
    { code: "no", htmlLang: "nb", name: "Norsk", short: "NO", locale: "nb-NO" },
    { code: "da", htmlLang: "da", name: "Dansk", short: "DA", locale: "da-DK" },
    { code: "fi", htmlLang: "fi", name: "Suomi", short: "FI", locale: "fi-FI" },
    { code: "de", htmlLang: "de", name: "Deutsch", short: "DE", locale: "de-DE" },
    { code: "fr", htmlLang: "fr", name: "Français", short: "FR", locale: "fr-FR" },
    { code: "es", htmlLang: "es", name: "Español", short: "ES", locale: "es-ES" },
    { code: "it", htmlLang: "it", name: "Italiano", short: "IT", locale: "it-IT" },
    { code: "pt", htmlLang: "pt", name: "Português", short: "PT", locale: "pt-PT" },
    { code: "nl", htmlLang: "nl", name: "Nederlands", short: "NL", locale: "nl-NL" },
    { code: "pl", htmlLang: "pl", name: "Polski", short: "PL", locale: "pl-PL" },
    { code: "cs", htmlLang: "cs", name: "Čeština", short: "CS", locale: "cs-CZ" },
    { code: "sk", htmlLang: "sk", name: "Slovenčina", short: "SK", locale: "sk-SK" },
    { code: "ro", htmlLang: "ro", name: "Română", short: "RO", locale: "ro-RO" },
    { code: "hu", htmlLang: "hu", name: "Magyar", short: "HU", locale: "hu-HU" },
  ];
  var VERSION = "1";
  var KEY = "relateiq_lang";

  function find(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return LANGS[i];
    return null;
  }
  function storedLang() {
    try {
      var c = localStorage.getItem(KEY);
      if (c && find(c)) return c;
    } catch (e) {}
    return browserLang();
  }
  // First visit, nothing chosen yet: use the browser's language when we have it.
  // Nothing is stored, so picking a language in the menu always wins from then on.
  function browserLang() {
    var list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]) || [];
    for (var i = 0; i < list.length; i++) {
      var c = String(list[i] || "").toLowerCase().split("-")[0];
      if (c === "nb" || c === "nn") c = "no";
      if (find(c)) return c;
    }
    return "en";
  }

  var lang = storedLang();
  var meta = find(lang);
  window.appLanguage = lang;
  // Locale for dates and numbers; undefined keeps the browser's own for English.
  window.appLocale = meta.locale || undefined;
  document.documentElement.lang = meta.htmlLang;

  // ---------------------------------------------------------------- switcher
  var GLOBE =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 4 5.7 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.7-4-9s1.4-6.4 4-9z"/></svg>';

  function buildSwitcher() {
    var d = document.createElement("details");
    d.className = "lang-switch";
    d.setAttribute("data-no-i18n", "");
    var html = '<summary aria-label="Language">' + GLOBE + "<span>" + meta.short + '</span></summary><ul class="lang-list">';
    LANGS.forEach(function (l) {
      html +=
        '<li><a href="#" lang="' + l.htmlLang + '" hreflang="' + l.htmlLang + '" data-lang="' + l.code + '"' +
        (l.code === lang ? ' aria-current="true"' : "") + ">" + l.name + "</a></li>";
    });
    d.innerHTML = html + "</ul>";
    d.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[data-lang]");
      if (!a) return;
      e.preventDefault();
      setLang(a.getAttribute("data-lang"));
    });
    document.addEventListener("click", function (e) {
      if (d.open && !d.contains(e.target)) d.open = false;
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && d.open) d.open = false;
    });
    return d;
  }

  function setLang(code) {
    if (!find(code) || code === lang) return;
    try {
      localStorage.setItem(KEY, code);
    } catch (e) {}
    location.reload();
  }
  window.setAppLanguage = setLang;

  function mountSwitcher() {
    if (document.querySelector(".lang-switch")) return;
    var sw = buildSwitcher();
    var nav = document.querySelector(".site-nav .nav-links");
    var sidebar = document.querySelector(".sidebar-bottom");
    var auth = document.querySelector(".auth-page");
    if (nav) {
      var wrap = document.createElement("div");
      wrap.className = "lang-slot";
      wrap.appendChild(sw);
      nav.appendChild(wrap);
    } else if (sidebar) {
      sidebar.insertBefore(sw, sidebar.firstChild);
      sw.classList.add("lang-switch-sidebar");
    } else if (auth) {
      var corner = document.createElement("div");
      corner.className = "lang-corner";
      corner.appendChild(sw);
      auth.appendChild(corner);
    } else {
      var fixed = document.createElement("div");
      fixed.className = "lang-corner";
      fixed.appendChild(sw);
      document.body.appendChild(fixed);
    }
  }

  // --------------------------------------------------------------- translator
  var INLINE = /^(strong|b|em|i|span|a|small|mark|sup|sub|u|code|br)$/i;
  var SKIP = /^(script|style|textarea|pre|svg|noscript|input)$/i;
  var ATTRS = ["placeholder", "title", "aria-label", "alt", "data-label", "data-short", "data-monthly", "data-yearly"];
  var SKIP_SEL = "[data-no-i18n], .msg-text, [contenteditable='true']";

  var exact = Object.create(null);
  var patterns = [];
  var cache = Object.create(null);
  var ready = false;

  function collapse(s) {
    return s.replace(/\s+/g, " ").trim();
  }
  var ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", middot: "·", hellip: "…", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", mdash: "—", ndash: "–", times: "×", larr: "←", rarr: "→", copy: "©", check: "✓" };
  function decodeText(s) {
    if (s.indexOf("&") < 0) return s;
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (all, n) {
      if (n[0] === "#") {
        var cp = n[1] === "x" || n[1] === "X" ? parseInt(n.slice(2), 16) : parseInt(n.slice(1), 10);
        return isNaN(cp) ? all : String.fromCodePoint(cp);
      }
      return Object.prototype.hasOwnProperty.call(ENT, n.toLowerCase()) ? ENT[n.toLowerCase()] : all;
    });
  }
  // Keys come from HTML source: decode entities in the text parts, keep the tags.
  function decodeKey(s) {
    if (s.indexOf("&") < 0) return s;
    return s
      .split(/(<\/?[a-zA-Z][^>]*>)/)
      .map(function (p, i) {
        return i % 2 ? p : decodeText(p);
      })
      .join("");
  }
  function esc(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // keys whose {n} right after a word is free text (e.g. " with Sam"), not a plural "s"
  var FREE_SLOT = /^(Couldn't change your plan|Ideas for this week|Last week|Yesterday was hard|Your rehearsals|You've used today)/;
  function load(dict) {
    var pats = [];
    Object.keys(dict).forEach(function (k) {
      var v = dict[k];
      if (typeof v !== "string" || !v) return;
      var key = collapse(decodeKey(k));
      var val = decodeKey(v);
      if (/\{\d+\}/.test(key)) {
        var order = [];
        var src = "";
        var lastIdx = 0;
        key.replace(/\{(\d+)\}/g, function (m, n, off) {
          // A placeholder at the very start is a name or a number, never a whole
          // sentence: stops short patterns from grabbing longer text (e.g. AI-written).
          var pre = key.slice(lastIdx, off);
          // right after a letter ("message{1}") the placeholder is the plural "s"
          var cap = /[A-Za-z]$/.test(pre) && !FREE_SLOT.test(key) ? "(s?)" : "((?:(?!\\.\\s)[\\s\\S]){0," + (off === 0 ? 40 : 300) + "}?)";
          src += esc(pre) + cap;
          order.push(+n);
          lastIdx = off + m.length;
          return m;
        });
        src += esc(key.slice(lastIdx));
        var literal = key.replace(/\{\d+\}/g, "").length;
        pats.push({ re: new RegExp("^" + src + "$"), order: order, tpl: val, lit: literal });
      } else {
        exact[key] = val;
      }
    });
    pats.sort(function (a, b) {
      return b.lit - a.lit;
    });
    patterns = pats;
  }

  // Returns the translation of an already collapsed string, or null.
  function lookup(core, depth) {
    if (!core) return null;
    var hit = exact[core];
    if (hit !== undefined) return hit;
    if (core in cache) return cache[core];
    var out = null;
    if (!/^[\d\s.,:;!?%$€+\-\/()]*$/.test(core)) {
      for (var i = 0; i < patterns.length; i++) {
        var p = patterns[i];
        var m = p.re.exec(core);
        if (!m) continue;
        var caps = {};
        for (var j = 0; j < p.order.length; j++) {
          var cap = m[j + 1];
          var tcap = depth > 2 ? null : lookup(collapse(cap), (depth || 0) + 1);
          // keep the spaces around the piece (" with Sam" stays " mit Sam")
          caps[p.order[j]] = tcap !== null && tcap !== undefined ? cap.match(/^\s*/)[0] + tcap + cap.match(/\s*$/)[0] : cap;
        }
        out = p.tpl.replace(/\{(\d+)\}/g, function (all, n) {
          return Object.prototype.hasOwnProperty.call(caps, n) ? caps[n] : "";
        });
        break;
      }
    }
    if (Object.keys(cache).length > 4000) cache = Object.create(null);
    cache[core] = out;
    return out;
  }

  function skipped(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      if (SKIP.test(n.nodeName)) return true;
      if (n.matches && n.matches(SKIP_SEL)) return true;
    }
    return false;
  }
  // attributes of an <input>/<textarea> are fine to translate, their content is not
  function skippedForAttrs(el) {
    if (el.matches && el.matches(SKIP_SEL)) return true;
    return el.parentNode && el.parentNode.nodeType === 1 ? skipped(el.parentNode) : false;
  }

  // ---- element level: an element made of text plus inline tags
  function isMixedLeaf(el) {
    var hasText = false;
    var hasInline = false;
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) {
        if (/\S/.test(c.nodeValue)) hasText = true;
      } else if (c.nodeType === 1) {
        if (!INLINE.test(c.nodeName) || SKIP.test(c.nodeName) || (c.matches && c.matches(SKIP_SEL))) return false;
        hasInline = true;
        if (!inlineOnly(c)) return false;
      } else if (c.nodeType !== 8) return false;
    }
    return hasText && hasInline;
  }
  function inlineOnly(el) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1 && (!INLINE.test(c.nodeName) || (c.matches && c.matches(SKIP_SEL)))) return false;
    }
    return true;
  }

  function keyOf(el, blankIds) {
    var k = "";
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) k += c.nodeValue;
      else if (c.nodeType === 1) {
        var n = c.nodeName.toLowerCase();
        if (n === "br") k += "<br>";
        else k += "<" + n + ">" + (blankIds && c.id ? "" : keyOf(c, blankIds)) + "</" + n + ">";
      }
    }
    return k;
  }

  // translated html-ish string -> tree of {tag, kids} / strings
  function parse(str) {
    var root = { kids: [] };
    var stack = [root];
    var re = /<(\/?)([a-zA-Z]+)\s*\/?>|([^<]+)/g;
    var m;
    while ((m = re.exec(str))) {
      var top = stack[stack.length - 1];
      if (m[3] !== undefined) top.kids.push(m[3]);
      else if (m[2].toLowerCase() === "br") top.kids.push({ tag: "br", kids: [] });
      else if (m[1]) {
        if (stack.length < 2 || stack[stack.length - 1].tag !== m[2].toLowerCase()) return null;
        stack.pop();
      } else {
        var node = { tag: m[2].toLowerCase(), kids: [] };
        top.kids.push(node);
        stack.push(node);
      }
    }
    return stack.length === 1 ? root : null;
  }

  function collect(el, q) {
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 1) {
        (q[c.nodeName.toLowerCase()] = q[c.nodeName.toLowerCase()] || []).push(c);
        collect(c, q);
      }
    }
  }
  function countTags(node, into) {
    node.kids.forEach(function (k) {
      if (typeof k !== "string") {
        into[k.tag] = (into[k.tag] || 0) + 1;
        countTags(k, into);
      }
    });
    return into;
  }

  function fill(parentEl, node, queues, lead, trail) {
    var frag = [];
    node.kids.forEach(function (k, i) {
      if (typeof k === "string") {
        var t = k;
        if (parentEl.__top) {
          if (i === 0) t = lead + t.replace(/^\s+/, "");
          if (i === node.kids.length - 1) t = t.replace(/\s+$/, "") + trail;
        }
        frag.push(document.createTextNode(t));
      } else {
        var orig = queues[k.tag] && queues[k.tag].shift();
        var el = orig || document.createElement(k.tag);
        if (k.tag !== "br") {
          // an empty translated tag keeps what the page put inside it
          if (k.kids.length || !orig) {
            while (el.firstChild) el.removeChild(el.firstChild);
            fill(el, k, queues, "", "").forEach(function (n) {
              el.appendChild(n);
            });
          } else {
            // consume its descendants from the queues so order stays aligned
            var skip = {};
            collect(el, skip);
            Object.keys(skip).forEach(function (t) {
              var q = queues[t];
              if (!q) return;
              skip[t].forEach(function (s) {
                var ix = q.indexOf(s);
                if (ix >= 0) q.splice(ix, 1);
              });
            });
          }
        }
        frag.push(el);
      }
    });
    return frag;
  }

  function translateLeaf(el) {
    var variants = [false, true];
    for (var vi = 0; vi < variants.length; vi++) {
      var raw = keyOf(el, variants[vi]);
      var core = collapse(raw);
      var tr = lookup(core, 0);
      if (tr === null || tr === undefined) continue;
      var tree = parse(tr);
      if (!tree) return false;
      // The original elements must be enough for the translated tags.
      var queues = {};
      collect(el, queues);
      var need = countTags(tree, {});
      for (var t in need) if (!queues[t] || queues[t].length < need[t]) return false;
      var lead = (raw.match(/^\s*/) || [""])[0];
      var trail = (raw.match(/\s*$/) || [""])[0];
      var holder = { __top: true };
      var nodes = fill(holder, tree, queues, lead, trail);
      while (el.firstChild) el.removeChild(el.firstChild);
      nodes.forEach(function (n) {
        el.appendChild(n);
      });
      el.__i18nDone = 1;
      return true;
    }
    return false;
  }

  // ---- plain text nodes
  function translateTextNode(node) {
    var v = node.nodeValue;
    if (node.__i18nOut === v) return;
    if (!/\p{L}/u.test(v)) return;
    var core = collapse(v);
    var tr = lookup(core, 0);
    if (tr === null || tr === undefined || tr.indexOf("<") >= 0 && /<\/?[a-z]+>/i.test(tr)) return;
    var lead = (v.match(/^\s*/) || [""])[0];
    var trail = (v.match(/\s*$/) || [""])[0];
    var out = lead + tr + trail;
    if (out === v) return;
    node.nodeValue = out;
    node.__i18nOut = out;
  }

  function translateAttrs(el) {
    if (el.nodeType !== 1) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i];
      var v = el.getAttribute(a);
      if (!v || !/\p{L}/u.test(v)) continue;
      var tr = lookup(collapse(v), 0);
      if (tr !== null && tr !== undefined && tr !== v) el.setAttribute(a, tr);
    }
    if (el.nodeName === "INPUT" && /^(submit|button)$/i.test(el.type) && el.value) {
      var tv = lookup(collapse(el.value), 0);
      if (tv) el.value = tv;
    }
  }

  function translateTree(root) {
    if (root.nodeType === 3) {
      if (root.parentNode && !skipped(root.parentNode)) translateTextNode(root);
      return;
    }
    if (root.nodeType !== 1) return;
    if (skippedForAttrs(root)) return;
    translateAttrs(root);
    if (SKIP.test(root.nodeName)) return;
    if (isMixedLeaf(root) && translateLeaf(root)) return;
    for (var c = root.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) translateTextNode(c);
      else if (c.nodeType === 1) translateTree(c);
    }
  }

  function translateTitle() {
    var t = document.title;
    var tr = lookup(collapse(t), 0);
    if (tr) document.title = tr;
  }

  var observer = null;
  function observe() {
    observer = new MutationObserver(function (records) {
      observer.disconnect();
      try {
        records.forEach(function (r) {
          if (r.type === "childList") {
            r.addedNodes.forEach(function (n) {
              translateTree(n);
            });
            // text swapped inside an element made of text + inline tags
            if (r.target.nodeType === 1 && !skipped(r.target) && isMixedLeaf(r.target)) translateLeaf(r.target);
          } else if (r.type === "characterData") {
            var p = r.target.parentNode;
            if (p && p.nodeType === 1 && !skipped(p)) {
              if (isMixedLeaf(p) && translateLeaf(p)) return;
              translateTextNode(r.target);
            }
          } else if (r.type === "attributes") {
            if (!skippedForAttrs(r.target)) translateAttrs(r.target);
          }
        });
      } catch (e) {
        if (window.console) console.error("i18n:", e);
      }
      start();
    });
    start();
  }
  function start() {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });
  }

  function reveal() {
    var s = document.getElementById("i18n-hide");
    if (s) s.parentNode.removeChild(s);
  }

  function run() {
    var sum = document.querySelector(".lang-switch > summary");
    var lt = lookup("Language", 0);
    if (sum && lt) sum.setAttribute("aria-label", lt);
    translateTitle();
    translateTree(document.body);
    ready = true;
  }

  var dictP = null;
  function init() {
    mountSwitcher();
    if (lang === "en") return;
    dictP.then(function (dict) {
      load(dict);
      run();
      observe();
      reveal();
    });
  }

  if (lang !== "en") {
    var st = document.createElement("style");
    st.id = "i18n-hide";
    st.textContent = "html{visibility:hidden}";
    document.head.appendChild(st);
    dictP = fetch("i18n/" + lang + ".json?v=" + VERSION)
      .then(function (r) {
        return r.ok ? r.json() : {};
      })
      .catch(function () {
        return {};
      });
    // never leave the page blank
    setTimeout(reveal, 3500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
