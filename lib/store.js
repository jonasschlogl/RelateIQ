import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Defaults to <project root>/data/db.json for local dev. On a host with a
// persistent volume (so the data survives a redeploy), set DB_PATH to a
// file inside that volume.
//
// Resolved lazily (called fresh each time, not cached in a top-level const)
// because this module is imported before server.js calls dotenv.config() —
// with ES modules, imports are evaluated before the importing file's own
// code runs, so a top-level `process.env.DB_PATH` read here would always
// see it as unset. Calling it from inside each function instead means it's
// read at request time, well after .env has been loaded.
function getDbPath() {
  return process.env.DB_PATH || path.join(__dirname, "..", "data", "db.json");
}

const EMPTY_DB = {
  users: [],
  conversations: [],
  partnerProfiles: [],
  checkins: [],
  shares: [],
  emailJobs: { lastDailyReminder: null, lastWeeklyDigest: null },
  pushSubscriptions: [],
};

function ensureDb() {
  const DB_PATH = getDbPath();
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(EMPTY_DB, null, 2));
  }
}

// Simple JSON-file storage — good enough for local dev / a single-server MVP.
// If you outgrow this (multiple users, concurrent writes, hosting on a
// read-only filesystem), swap readDb/writeDb for a real database
// (e.g. SQLite via better-sqlite3, or Postgres) — every route in server.js
// only talks to this file, so that's the one place to change.

export function readDb() {
  ensureDb();
  const raw = fs.readFileSync(getDbPath(), "utf-8");
  let db;
  try {
    db = JSON.parse(raw);
    if (!db || typeof db !== "object") db = {};
  } catch (e) {
    db = {};
  }

  // Migration guard: older copies of data/db.json only had users +
  // conversations. Backfill any collections added later so existing
  // installs don't crash when new features ship.
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.conversations)) db.conversations = [];
  if (!Array.isArray(db.partnerProfiles)) db.partnerProfiles = [];
  if (!Array.isArray(db.checkins)) db.checkins = [];
  if (!Array.isArray(db.shares)) db.shares = [];
  if (!db.emailJobs || typeof db.emailJobs !== "object") {
    db.emailJobs = { lastDailyReminder: null, lastWeeklyDigest: null };
  }
  if (!Array.isArray(db.pushSubscriptions)) db.pushSubscriptions = [];

  return db;
}

export function writeDb(db) {
  fs.writeFileSync(getDbPath(), JSON.stringify(db, null, 2));
}

export function generateId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
