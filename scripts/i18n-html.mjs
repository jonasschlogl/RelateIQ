// Tiny HTML text translator (no dependencies).
//
// It finds every visible text segment of a page (plus a few text carrying
// attributes such as alt, aria-label, placeholder and the meta descriptions)
// and swaps it for the translation found in a dictionary
// { "English text": "Translated text" }.
//
// - A segment is a run of text with its inline tags (<strong>, <em>, <a>,
//   <span>, <br>). Inline tags are written without attributes in the keys, e.g.
//   "Check a message <strong>before you send it</strong>". Attributes (href,
//   class ...) are put back from the original markup.
// - Anything without a translation stays English, so an unfinished language
//   never breaks a page. translateHtml() reports what was missing.
//
//   extractSegments(html)            -> array of English strings (page order, unique)
//   translateHtml(html, dict, stats) -> translated html

const OPAQUE = /^(script|style|svg|noscript|pre)$/i;
const INLINE = /^(strong|b|em|i|span|a|br|small|mark|sup|sub|u|code)$/i;
const VOID_INLINE = /^br$/i;
const VOID = /^(meta|link|img|br|hr|input|source|path|circle|rect|line|polyline|polygon|use|stop)$/i;
const ATTRS = ["alt", "title", "aria-label", "placeholder", "data-monthly", "data-yearly", "data-label", "data-short"];
const META_KEYS = /^(description|og:title|og:description|twitter:title|twitter:description|og:image:alt)$/i;

const hasLetters = (s) => /\p{L}/u.test(s);
const collapse = (s) => s.replace(/\s+/g, " ").trim();

function tokenize(html) {
  const out = [];
  const re = /<!--[\s\S]*?-->|<[a-zA-Z\/!][^>]*>|[^<]+/g;
  let m;
  while ((m = re.exec(html))) {
    const v = m[0];
    if (v.startsWith("<!--")) out.push({ t: "comment", v });
    else if (v[0] === "<") out.push({ t: "tag", v });
    else out.push({ t: "text", v });
  }
  return out;
}
const tagName = (v) => (v.match(/^<\/?\s*([a-zA-Z][a-zA-Z0-9-]*)/) || [])[1]?.toLowerCase() || "";
const isClose = (v) => /^<\s*\//.test(v);

function metaKeyOf(tag) {
  const k = tag.match(/\s(?:name|property)=("([^"]*)"|'([^']*)')/);
  return k ? k[2] || k[3] : "";
}

function mapAttrs(tag, fn) {
  return tag.replace(/(\s)([a-zA-Z:-]+)=("([^"]*)"|'([^']*)')/g, (all, sp, name, q, v1, v2) => {
    const val = v1 !== undefined ? v1 : v2;
    const res = fn(name.toLowerCase(), val);
    if (res === undefined || res === val) return all;
    return `${sp}${name}="${res.replace(/"/g, "&quot;")}"`;
  });
}

// mark tokens that sit inside script/style/svg/pre blocks
function markOpaque(toks) {
  let depth = 0;
  for (const tk of toks) {
    tk.opaque = false;
    if (tk.t === "tag") {
      const name = tagName(tk.v);
      if (OPAQUE.test(name)) {
        if (isClose(tk.v)) { tk.opaque = true; depth = Math.max(0, depth - 1); continue; }
        if (!/\/>$/.test(tk.v)) { tk.opaque = true; depth++; continue; }
      }
    }
    if (depth > 0) tk.opaque = true;
  }
}

// inline tokens we can reason about: text, inline tags, comments break runs
function isRunToken(tk) {
  if (tk.opaque) return false;
  if (tk.t === "text") return true;
  if (tk.t === "tag") return INLINE.test(tagName(tk.v));
  return false;
}

// matching of inline tags inside [a,b): returns map open->close, and set of unmatched
function matchTags(toks, a, b) {
  const stack = [];
  const pair = new Map();
  const unmatched = new Set();
  for (let i = a; i < b; i++) {
    const tk = toks[i];
    if (tk.t !== "tag") continue;
    const name = tagName(tk.v);
    if (VOID_INLINE.test(name)) continue;
    if (!isClose(tk.v)) stack.push(i);
    else {
      let j = stack.length - 1;
      while (j >= 0 && tagName(toks[stack[j]].v) !== name) j--;
      if (j < 0) unmatched.add(i);
      else { for (let k = stack.length - 1; k > j; k--) unmatched.add(stack[k]); pair.set(stack[j], i); stack.length = j; }
    }
  }
  stack.forEach((i) => unmatched.add(i));
  return { pair, unmatched };
}

// Calls emit(a, b) for every translatable token range [a, b] (inclusive).
function findSegments(toks, emit) {
  let i = 0;
  while (i < toks.length) {
    if (!isRunToken(toks[i])) { i++; continue; }
    let j = i;
    while (j < toks.length && isRunToken(toks[j])) j++;
    splitRun(toks, i, j, emit);
    i = j;
  }
}

function splitRun(toks, a, b, emit) {
  const { pair, unmatched } = matchTags(toks, a, b);
  // cut the run at unmatched tags
  let start = a;
  for (let i = a; i < b; i++) {
    if (unmatched.has(i)) { processRange(toks, start, i, pair, emit); start = i + 1; }
  }
  processRange(toks, start, b, pair, emit);
}

// range [a,b) is balanced
function processRange(toks, a, b, pair, emit) {
  // top-level scan
  let depth0Letters = false;
  const tops = [];
  for (let i = a; i < b; ) {
    const tk = toks[i];
    if (tk.t === "tag") {
      if (pair.has(i)) { tops.push([i, pair.get(i)]); i = pair.get(i) + 1; continue; }
      i++; continue; // br etc.
    }
    if (tk.t === "text" && hasLetters(tk.v)) depth0Letters = true;
    i++;
  }
  if (depth0Letters) {
    // first / last non-whitespace tokens
    let s = a, e = b - 1;
    while (s <= e && toks[s].t === "text" && !toks[s].v.trim()) s++;
    while (e >= s && toks[e].t === "text" && !toks[e].v.trim()) e--;
    if (s <= e) emit(s, e);
    return;
  }
  for (const [o, c] of tops) processRange(toks, o + 1, c, pair, emit);
}

function normKey(toks, s, e) {
  let k = "";
  for (let i = s; i <= e; i++) {
    const tk = toks[i];
    if (tk.t === "text") k += tk.v;
    else {
      const name = tagName(tk.v);
      k += VOID_INLINE.test(name) ? "<br>" : isClose(tk.v) ? `</${name}>` : `<${name}>`;
    }
  }
  return collapse(k);
}

function expand(translated, toks, s, e) {
  // put the original attributes back on the opening tags
  const queues = {};
  for (let i = s; i <= e; i++) {
    const tk = toks[i];
    if (tk.t === "tag" && !isClose(tk.v)) (queues[tagName(tk.v)] ||= []).push(tk.v);
  }
  let bad = false;
  const res = translated.replace(/<(\/?)([a-zA-Z]+)\s*\/?>/g, (all, close, name) => {
    name = name.toLowerCase();
    if (close) return `</${name}>`;
    const q = queues[name];
    if (!q || !q.length) { bad = true; return all; }
    return q.shift();
  });
  const leftover = Object.values(queues).some((q) => q.length);
  return bad || leftover ? null : res;
}

function attrPass(toks, onAttr) {
  for (const tk of toks) {
    if (tk.t !== "tag" || tk.opaque || isClose(tk.v)) continue;
    const name = tagName(tk.v);
    const isMeta = name === "meta";
    const mk = isMeta ? metaKeyOf(tk.v) : "";
    tk.v = mapAttrs(tk.v, (an, av) => {
      if ((isMeta && an === "content" && META_KEYS.test(mk)) || ATTRS.includes(an)) return onAttr(av);
      return undefined;
    });
  }
}

export function extractSegments(html) {
  const toks = tokenize(html);
  markOpaque(toks);
  const seen = new Set();
  const list = [];
  const add = (k) => { k = collapse(k); if (k && hasLetters(k) && !seen.has(k)) { seen.add(k); list.push(k); } };
  // <title> is plain text inside head, found by the run finder
  findSegments(toks, (s, e) => add(normKey(toks, s, e)));
  attrPass(toks, (v) => { add(v); return undefined; });
  return list;
}

export function translateHtml(html, dict, stats = { hit: 0, miss: new Set() }) {
  const toks = tokenize(html);
  markOpaque(toks);
  attrPass(toks, (v) => {
    const k = collapse(v);
    if (!k || !hasLetters(k)) return undefined;
    const tr = dict[k];
    if (typeof tr === "string" && tr) { stats.hit++; return tr; }
    stats.miss.add(k);
    return undefined;
  });
  const jobs = [];
  findSegments(toks, (s, e) => jobs.push([s, e]));
  for (const [s, e] of jobs) {
    const k = normKey(toks, s, e);
    if (!k || !hasLetters(k)) continue;
    const tr = dict[k];
    if (typeof tr !== "string" || !tr) { stats.miss.add(k); continue; }
    const out = expand(tr, toks, s, e);
    if (out === null) { stats.miss.add(k + "  [tag mismatch]"); continue; }
    const lead = toks[s].t === "text" ? toks[s].v.match(/^\s*/)[0] : "";
    const trail = toks[e].t === "text" ? toks[e].v.match(/\s*$/)[0] : "";
    toks[s].v = lead + out + trail;
    for (let i = s + 1; i <= e; i++) toks[i].v = "";
    stats.hit++;
  }
  return toks.map((t) => t.v).join("");
}
