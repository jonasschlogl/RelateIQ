// Relationship memory v2: what the coach remembers about a user between
// conversations. Pure logic only (no database, no OpenAI), so it can be tested
// on its own. server.js wires it to the store and the model.
//
// Stored as one JSON doc per user (docs table, kind "memory", key "main"), and
// also rendered to plain text into users.relationshipMemory, which the older
// code paths (Message check, After a fight, talk plan, focus, ideas) keep reading.
import crypto from "node:crypto";

export const MEMORY_KIND = "memory";
export const MEMORY_KEY = "main";

export const SECTIONS = ["facts", "themes", "patterns", "preferences", "openThreads"];
const LIMITS = { facts: 16, themes: 6, patterns: 8, preferences: 6, openThreads: 3 };
const MAX_ITEM = 220;
const MAX_FORGOTTEN = 40;
const MAX_PROCESSED = 1500;
const MAX_RENDERED = 3000;

export const MEMORY_UPDATE_PROMPT = `You maintain a private memory about ONE user of a relationship coaching app, so their coach can pick up where things stand instead of starting from zero. You receive the current memory, a list of things the user asked to forget, and new conversation excerpts (lines start with "User:" or "Coach:"). Return the COMPLETE updated memory.

Respond with ONLY a JSON object in exactly this shape:
{"facts": ["..."], "themes": ["..."], "patterns": ["..."], "preferences": ["..."], "openThreads": [{"text": "...", "status": "open"}]}

What each list holds (every item is one plain sentence, at most 200 characters). Together they should let a coach pick up like a therapist who has read their case notes, so keep the useful detail instead of vague summaries:
- facts: things the user said about their own life and relationship that stay true for months. Names of their partner and other key people, how long they have been together, living situation, children, work and big stressors, how the relationship started and what changed when, important history (earlier relationships, family background) only when the user said it themselves, big upcoming events with a date. Max 16.
- themes: recurring issues in the relationship and the deeper cycle behind them when it is visible (for example the same fight under different topics). Only if they show up in more than one conversation or the user calls them ongoing. Max 6.
- patterns: how the user tends to react or act in conflict, what the partner tends to do in the same cycle, what sets the user off, and what has been tried so far with how it went. Neutral and observable, never a diagnosis or a verdict. Max 8.
- preferences: how the user wants and is able to be helped (blunt or gentle, practical steps or reflection, short or detailed, no theory), what advice they said worked or did not work for them, and what they said they want from the relationship. Only if they said so or it is clearly evident. Max 6.
- openThreads: concrete things in motion: something the coach suggested that the user said they would try, a conversation they plan to have, an event coming up. Use status "open" or "resolved". Mark an item "resolved" when the new excerpts show it happened or was dropped, OR when the Coach already asked about it in the new excerpts. At most 3 open items.

Rules:
- Use only what the user actually said. Never invent, never guess, never quote at length.
- Keep existing items that are still true, merge duplicates, remove items the new excerpts contradict or make outdated. A passing mood or one bad day is not a fact.
- Write in the language the user mostly writes in (detect it automatically), third person, calm and factual, for a coach to keep privately in mind.
- Never store contact details, addresses, passwords, account numbers, or medical details. If violence, abuse or self-harm was mentioned, store only "safety concerns were mentioned" and nothing more.
- Never store anything on the forget list, unless the user clearly brings it up again as current.
- If nothing is worth remembering yet, return empty lists.`;

export function emptyMemory() {
  return {
    version: 1,
    facts: [],
    themes: [],
    patterns: [],
    preferences: [],
    openThreads: [],
    forgotten: [],
    processed: {},
    runs: { date: null, count: 0 },
    lastFailAt: null,
    updatedAt: null,
  };
}

function cleanText(s) {
  return String(s ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ITEM);
}

function norm(s) {
  return cleanText(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function itemId(text) {
  return crypto.createHash("sha1").update(norm(text)).digest("hex").slice(0, 8);
}

// A stored doc (or garbage) -> a safe memory object.
export function normalizeMemory(raw) {
  const m = emptyMemory();
  if (!raw || typeof raw !== "object") return m;
  for (const s of SECTIONS) {
    const arr = Array.isArray(raw[s]) ? raw[s] : [];
    const seen = new Set();
    for (const it of arr) {
      const text = cleanText(typeof it === "string" ? it : it && it.text);
      if (!text || seen.has(norm(text))) continue;
      seen.add(norm(text));
      m[s].push({ id: (it && it.id) || itemId(text), text });
      if (m[s].length >= LIMITS[s]) break;
    }
  }
  m.forgotten = (Array.isArray(raw.forgotten) ? raw.forgotten : []).map(cleanText).filter(Boolean).slice(-MAX_FORGOTTEN);
  if (raw.processed && typeof raw.processed === "object") {
    const entries = Object.entries(raw.processed).filter(([k, v]) => typeof k === "string" && Number.isFinite(v));
    m.processed = Object.fromEntries(entries.slice(-MAX_PROCESSED));
  }
  if (raw.runs && typeof raw.runs === "object") m.runs = { date: raw.runs.date || null, count: Number(raw.runs.count) || 0 };
  m.lastFailAt = raw.lastFailAt || null;
  m.updatedAt = raw.updatedAt || null;
  return m;
}

export function isEmptyMemory(m) {
  return SECTIONS.every((s) => !m[s] || m[s].length === 0);
}

function matchesForgotten(text, forgotten) {
  const t = norm(text);
  if (!t) return false;
  return forgotten.some((f) => {
    const n = norm(f);
    if (!n) return false;
    if (n === t) return true;
    return n.length >= 14 && t.length >= 14 && (t.includes(n) || n.includes(t));
  });
}

// Validates the model's answer and merges it into the current memory.
// Returns the new memory, or null when the answer is unusable (the caller then
// keeps the old memory).
export function applyModelUpdate(current, out) {
  if (!out || typeof out !== "object") return null;
  const next = { ...current, facts: [], themes: [], patterns: [], preferences: [], openThreads: [] };
  const oldIds = new Map();
  for (const s of SECTIONS) for (const it of current[s]) oldIds.set(norm(it.text), it.id);
  let total = 0;
  for (const s of SECTIONS) {
    let arr = Array.isArray(out[s]) ? out[s] : [];
    if (s === "openThreads") {
      arr = arr.filter((it) => !(it && typeof it === "object" && String(it.status || "open").toLowerCase() === "resolved"));
    }
    const seen = new Set();
    for (const it of arr) {
      const text = cleanText(typeof it === "string" ? it : it && it.text);
      const key = norm(text);
      if (!text || seen.has(key) || matchesForgotten(text, current.forgotten)) continue;
      seen.add(key);
      next[s].push({ id: oldIds.get(key) || itemId(text), text });
      total++;
      if (next[s].length >= LIMITS[s]) break;
    }
  }
  // A model that suddenly returns nothing at all is more likely wrong than right.
  const hadAny = !isEmptyMemory(current);
  if (total === 0 && hadAny) return null;
  return next;
}

// The plain-text form read by the coach prompt and the older features.
// Most important first, because some readers only use the first 600 characters.
export function renderMemoryText(m) {
  const line = (label, items) => (items.length ? `${label}: ${items.map((i) => i.text).join("; ")}` : "");
  const parts = [
    line("Facts", m.facts),
    line("Recurring themes", m.themes),
    line("How they tend to react", m.patterns),
    line("How they like to be coached", m.preferences),
  ].filter(Boolean);
  let out = "";
  for (const p of parts) {
    if ((out + "\n" + p).length > MAX_RENDERED - 220) break;
    out += (out ? "\n" : "") + p;
  }
  if (m.openThreads.length) {
    const t = `Open thread: ${m.openThreads[0].text}`;
    out += (out ? "\n\n" : "") + t;
  }
  return out.slice(0, MAX_RENDERED);
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function runsToday(m, now = new Date()) {
  return m.runs && m.runs.date === dayKey(now) ? m.runs.count : 0;
}

export function bumpRuns(m, now = new Date()) {
  const d = dayKey(now);
  m.runs = { date: d, count: (m.runs && m.runs.date === d ? m.runs.count : 0) + 1 };
}

// Which conversation material has not been processed yet. Coach conversations
// by message count, practice rehearsals by their debrief.
export function collectNewMaterial(conversations, processed, { budget = 9000 } = {}) {
  const items = [];
  const sorted = [...conversations].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  for (const c of sorted) {
    const msgs = Array.isArray(c.messages) ? c.messages : [];
    if (c.mode === "practice") {
      const key = "d:" + c.id;
      if (c.practiceDebrief && processed[key] === undefined) {
        let d = null;
        try {
          d = JSON.parse(c.practiceDebrief);
        } catch {}
        const bits = d && [d.watchFor, d.tip].filter(Boolean).join(" ");
        if (bits) items.push({ key, value: 1, text: `(rehearsal with ${c.partnerName || "partner"}, coach debrief): ${String(bits).slice(0, 500)}` });
      }
      continue;
    }
    const done = Number.isFinite(processed[c.id]) ? processed[c.id] : 0;
    const fresh = msgs.slice(done);
    if (!fresh.some((m) => m.role === "user")) continue;
    const lines = fresh
      .slice(-24)
      .map((m) => {
        const t = String(m.content || "").replace(/\s+/g, " ").trim().slice(0, 500);
        return t ? `${m.role === "user" ? "User" : "Coach"}: ${t}` : null;
      })
      .filter(Boolean);
    if (!lines.length) continue;
    const date = c.createdAt ? String(c.createdAt).slice(0, 10) : "undated";
    items.push({ key: c.id, value: msgs.length, text: `(${date}):\n${lines.join("\n")}` });
  }
  // Newest first when over budget; whatever does not fit stays unprocessed for the next run.
  const picked = [];
  let used = 0;
  for (const it of items.slice().reverse()) {
    if (used + it.text.length > budget && picked.length) continue;
    picked.unshift(it);
    used += it.text.length;
  }
  return { picked, covered: picked };
}

// Marks every existing conversation as processed (used on the very first run, where older
// history is covered by the legacy note, and after the user clears the memory).
export function baselineProcessed(conversations) {
  const out = {};
  for (const c of conversations) {
    if (c.mode === "practice") {
      if (c.practiceDebrief) out["d:" + c.id] = 1;
    } else {
      out[c.id] = Array.isArray(c.messages) ? c.messages.length : 0;
    }
  }
  return out;
}

export function buildUpdateUserContent({ current, legacyText, material, today }) {
  const cur = {};
  for (const s of SECTIONS) cur[s] = current[s].map((i) => (s === "openThreads" ? { text: i.text, status: "open" } : i.text));
  const parts = [`Today: ${today}`, `Current memory:\n${JSON.stringify(cur)}`];
  if (legacyText) parts.push(`Older free-text memory note (use as extra background, it may be outdated):\n${String(legacyText).slice(0, 900)}`);
  parts.push(`Forget list (the user asked to forget these):\n${current.forgotten.length ? current.forgotten.map((f) => "- " + f).join("\n") : "(empty)"}`);
  parts.push(`New conversation excerpts:\n"""\n${material.map((m) => m.text).join("\n\n---\n\n")}\n"""`);
  return parts.join("\n\n");
}

export function markProcessed(m, covered) {
  for (const it of covered) m.processed[it.key] = it.value;
  const entries = Object.entries(m.processed);
  if (entries.length > MAX_PROCESSED) m.processed = Object.fromEntries(entries.slice(-MAX_PROCESSED));
}

export function removeItem(m, section, id) {
  if (!SECTIONS.includes(section)) return null;
  const idx = m[section].findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const [gone] = m[section].splice(idx, 1);
  m.forgotten = [...m.forgotten, gone.text].slice(-MAX_FORGOTTEN);
  return gone;
}

export function publicMemory(m) {
  const out = { updatedAt: m.updatedAt, empty: isEmptyMemory(m), sections: {} };
  for (const s of SECTIONS) out.sections[s] = m[s].map((i) => ({ id: i.id, text: i.text }));
  return out;
}
