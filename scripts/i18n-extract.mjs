// Collects every English UI string of the app into public/i18n/_source.json.
//   node scripts/i18n-extract.mjs
// Needs acorn (not a dependency of the app): npm i --no-save acorn. Strings with dynamic parts use {0}, {1}... placeholders.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as acorn from "acorn";
import { extractSegments } from "./i18n-html.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUB = path.join(ROOT, "public");
const SRC_OUT = process.argv[2] === "--stdout";
const SKIP_HTML = new Set(["admin.html", "privacy.html", "terms.html", "method.html"]);
const SKIP_JS = new Set(["admin.js", "i18n.js"]);
const found = new Map(); // text -> Set(origin)
const add = (text, origin) => {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || !/\p{L}{2}/u.test(t)) return;
  if (!found.has(t)) found.set(t, new Set());
  found.get(t).add(origin);
};

// ---- HTML pages
for (const f of fs.readdirSync(PUB).filter((f) => f.endsWith(".html") && !SKIP_HTML.has(f))) {
  const html = fs.readFileSync(path.join(PUB, f), "utf8");
  for (const seg of extractSegments(html)) add(seg, f);
}

// ---- JS helpers
const SKIP_CALLEE = /^(getElementById|querySelector|querySelectorAll|closest|matches|add|remove|toggle|contains|addEventListener|removeEventListener|setAttribute|getAttribute|removeAttribute|hasAttribute|createElement|getItem|setItem|removeItem|fetch|authFetch|log|error|warn|includes|startsWith|endsWith|indexOf|split|match|test|replace|replaceAll|padStart|require|stringify|parse|getComputedStyle|setProperty|getPropertyValue|dispatchEvent|Event|CustomEvent|URLSearchParams|get|has|set|append|open|postMessage|toLocaleDateString|toLocaleString|toLocaleTimeString|Intl|DateTimeFormat|NumberFormat|escapeHtml|encodeURIComponent|decodeURIComponent|RegExp|focus|scrollIntoView|from|find|findIndex|filter|some|every)$/;

function tplToString(node) {
  let out = "";
  node.quasis.forEach((q, i) => {
    out += q.value.cooked ?? q.value.raw;
    if (i < node.expressions.length) out += `{${i}}`;
  });
  return out;
}

function looksLikeUi(s) {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length < 2 || t.length > 500) return false;
  if (!/\p{L}{2}/u.test(t)) return false;
  if (/^[a-z0-9_\-.:/#\[\]=@%?&,;|*+()'"~^$!<>]+$/.test(t)) return false; // identifiers, selectors, urls
  if (/^(https?:|\/|\.|#|data:|rgb|hsl|var\()/i.test(t)) return false;
  if (/^[A-Z0-9_]+$/.test(t) && t.includes("_")) return false;
  if (/^[a-z]+([A-Z][a-z]+)+$/.test(t)) return false; // camelCase
  if (/^[a-z]+(-[a-z]+)+$/.test(t)) return false; // css-class
  if (!/\s/.test(t) && !/^[A-Z\p{Lu}]/u.test(t)) return false; // single lowercase word
  if (/^\{\d+\}$/.test(t)) return false;
  if (/^(PATCH|POST|PUT|GET|DELETE|Bearer|UTC|IntersectionObserver|PushManager|OK)$/.test(t) && t !== "OK") return false;
  if (/^[a-z0-9-]+( [a-z0-9-]+)+$/.test(t) && /-/.test(t)) return false; // css class lists
  if (/^\(|^[0-9.]+(px|%)?( [0-9.-]+(px|%)?)+$|=\"/.test(t)) return false; // media queries, css values, attribute fragments
  return true;
}

function handleString(s, origin) {
  if (/<[a-zA-Z\/][^>]*>/.test(s)) {
    // HTML snippet: split like a page
    let segs = [];
    try { segs = extractSegments(`<div>${s}</div>`); } catch (e) { segs = []; }
    for (const seg of segs) if (looksLikeUi(seg) || /\{\d+\}/.test(seg)) add(seg, origin);
  } else if (looksLikeUi(s)) add(s, origin);
}

// "a " + x + " b" and `a ${x}` + "b": a sentence written as a concatenation is one
// string for the person reading it, so it is one key with {0}, {1} ... placeholders.
function leavesOf(node, out) {
  if (node.type === "BinaryExpression" && node.operator === "+") {
    leavesOf(node.left, out);
    leavesOf(node.right, out);
  } else out.push(node);
  return out;
}
function joinConcat(node) {
  const leaves = leavesOf(node, []);
  let n = 0;
  let str = "";
  let texty = 0;
  for (const l of leaves) {
    if (l.type === "Literal" && typeof l.value === "string") { str += l.value; texty++; }
    else if (l.type === "TemplateLiteral") {
      texty++;
      l.quasis.forEach((q, i) => {
        str += q.value.cooked ?? q.value.raw;
        if (i < l.expressions.length) str += `{${n++}}`;
      });
    } else str += `{${n++}}`;
  }
  return { str, texty, leaves };
}

function walk(node, parent, fn) {
  if (!node || typeof node.type !== "string") return;
  fn(node, parent);
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === "string" && walk(c, node, fn));
    else if (v && typeof v.type === "string") walk(v, node, fn);
  }
}

function calleeName(call) {
  const c = call.callee;
  if (c.type === "Identifier") return c.name;
  if (c.type === "MemberExpression" && c.property.type === "Identifier") return c.property.name;
  return "";
}

// ---- client JS
for (const f of fs.readdirSync(path.join(PUB, "js")).filter((f) => f.endsWith(".js") && !SKIP_JS.has(f))) {
  const src = fs.readFileSync(path.join(PUB, "js", f), "utf8");
  const ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "script", allowAwaitOutsideFunction: true });
  const joined = new Set();
  walk(ast, null, (n, p) => {
    let s = null;
    if (n.type === "BinaryExpression" && n.operator === "+" && !(p && p.type === "BinaryExpression" && p.operator === "+")) {
      const j = joinConcat(n);
      if (j.texty >= 2 && j.leaves.some((l) => l.type === "Literal" || l.type === "TemplateLiteral")) {
        j.leaves.forEach((l) => joined.add(l));
        handleString(j.str, "js/" + f);
      }
      return;
    }
    if (joined.has(n)) return;
    if (n.type === "Literal" && typeof n.value === "string") s = n.value;
    else if (n.type === "TemplateLiteral") s = tplToString(n);
    if (s === null) return;
    if (p) {
      if (p.type === "Property" && p.key === n && !p.computed) return;
      if (p.type === "CallExpression" && p.arguments[0] === n && SKIP_CALLEE.test(calleeName(p))) return;
      if (p.type === "BinaryExpression" && /^[=!]==?$/.test(p.operator)) return;
      if (p.type === "SwitchCase") return;
      if (p.type === "MemberExpression" && p.property === n) return;
      if (p.type === "ImportDeclaration") return;
    }
    handleString(s, "js/" + f);
  });
}

// ---- server.js: user-visible fields only
{
  const src = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
  const ast = acorn.parse(src, { ecmaVersion: "latest", sourceType: "module", allowAwaitOutsideFunction: true });
  const KEYS = new Set(["error", "message", "title", "heading", "body", "note", "hint", "label", "reason", "headline", "text", "later", "first", "tip"]);
  const addNode = (v) => {
    if (v.type === "BinaryExpression" && v.operator === "+") {
      const j = joinConcat(v);
      if (j.str.length <= 400 && looksLikeUi(j.str)) add(j.str, "server.js");
      return;
    }
    let s = null;
    if (v.type === "Literal" && typeof v.value === "string") s = v.value;
    else if (v.type === "TemplateLiteral") s = tplToString(v);
    if (s && s.length <= 400 && looksLikeUi(s)) add(s, "server.js");
  };
  walk(ast, null, (n) => {
    if (n.type === "Property" && !n.computed && ((n.key.type === "Identifier" && KEYS.has(n.key.name)) || (n.key.type === "Literal" && KEYS.has(n.key.value)))) addNode(n.value);
    if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && /^(DAILY_QUESTIONS|PRACTICE_SCENARIOS|SCENARIOS)$/.test(n.id.name) && n.init?.type === "ArrayExpression") {
      for (const el of n.init.elements) if (el) addNode(el);
    }
  });
}

add("Language", "i18n.js"); // aria-label of the language menu
const keys = [...found.keys()].sort((a, b) => a.localeCompare(b));
const out = {};
for (const k of keys) out[k] = "";
fs.mkdirSync(path.join(PUB, "i18n"), { recursive: true });
fs.writeFileSync(path.join(PUB, "i18n", "_source.json"), JSON.stringify(Object.keys(out), null, 1));
const by = {};
for (const [k, o] of found) for (const x of o) by[x] = (by[x] || 0) + 1;
console.log("strings:", keys.length);
console.log(by);
