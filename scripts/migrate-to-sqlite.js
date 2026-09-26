// One-time migration: old data/db.json (plain JSON file storage) -> the new
// SQLite database (lib/store.js).
//
// Usage (run once, from the project root, on the SAME machine/volume where
// the live data/db.json lives — e.g. on Railway itself, or against a copy
// you've downloaded locally):
//
//   node scripts/migrate-to-sqlite.js
//
// Optional env vars (same conventions the app itself uses):
//   OLD_DB_PATH   path to the old JSON file (default: data/db.json)
//   DB_PATH       path the NEW sqlite file should be written to (default:
//                 data/relateiq.sqlite — same default lib/store.js uses)
//
// Safe to re-run: every write goes through the same save*() upsert functions
// server.js will use going forward (INSERT ... ON CONFLICT DO UPDATE), so
// running this twice against the same old JSON file just re-applies the same
// rows — it will not create duplicates or error out.
//
// This script does NOT delete or modify data/db.json. It only reads it. Keep
// that file around until you've confirmed the app is working correctly on
// SQLite — it's your rollback copy.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  saveUser,
  saveConversation,
  savePartnerProfile,
  saveCheckin,
  saveShare,
  saveCompare,
  savePushSubscription,
  setEmailJobField,
  loadDb,
} from "../lib/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const oldDbPath = process.env.OLD_DB_PATH || path.join(projectRoot, "data", "db.json");

function fail(msg) {
  console.error(`\nMigration aborted: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(oldDbPath)) {
  fail(
    `old JSON database not found at ${oldDbPath}\n` +
      `Set OLD_DB_PATH to point at your existing data/db.json (or copy it into place) and try again.`
  );
}

let oldDb;
try {
  oldDb = JSON.parse(fs.readFileSync(oldDbPath, "utf8"));
} catch (err) {
  fail(`could not parse ${oldDbPath} as JSON: ${err.message}`);
}

const EMPTY = { users: [], conversations: [], partnerProfiles: [], checkins: [], shares: [], compares: [], pushSubscriptions: [], emailJobs: {} };
const users = Array.isArray(oldDb.users) ? oldDb.users : EMPTY.users;
const conversations = Array.isArray(oldDb.conversations) ? oldDb.conversations : EMPTY.conversations;
const partnerProfiles = Array.isArray(oldDb.partnerProfiles) ? oldDb.partnerProfiles : EMPTY.partnerProfiles;
const checkins = Array.isArray(oldDb.checkins) ? oldDb.checkins : EMPTY.checkins;
const shares = Array.isArray(oldDb.shares) ? oldDb.shares : EMPTY.shares;
const compares = Array.isArray(oldDb.compares) ? oldDb.compares : EMPTY.compares;
const pushSubscriptions = Array.isArray(oldDb.pushSubscriptions) ? oldDb.pushSubscriptions : EMPTY.pushSubscriptions;
const emailJobs = oldDb.emailJobs && typeof oldDb.emailJobs === "object" ? oldDb.emailJobs : EMPTY.emailJobs;

console.log(`Reading old database: ${oldDbPath}`);
console.log(
  `Found: ${users.length} users, ${conversations.length} conversations, ${partnerProfiles.length} partner profiles, ` +
    `${checkins.length} check-ins, ${shares.length} shares, ${compares.length} compares, ${pushSubscriptions.length} push subscriptions.`
);

let counts = { users: 0, conversations: 0, partnerProfiles: 0, checkins: 0, shares: 0, compares: 0, pushSubscriptions: 0 };
let errors = [];

function migrateEach(label, records, fn, key) {
  for (const record of records) {
    try {
      fn(record);
      counts[key]++;
    } catch (err) {
      errors.push(`${label} ${record?.id ?? "(no id)"}: ${err.message}`);
    }
  }
}

migrateEach("user", users, saveUser, "users");
migrateEach("conversation", conversations, saveConversation, "conversations");
migrateEach("partner profile", partnerProfiles, savePartnerProfile, "partnerProfiles");
migrateEach("check-in", checkins, saveCheckin, "checkins");
migrateEach("share", shares, saveShare, "shares");
migrateEach("compare", compares, saveCompare, "compares");
migrateEach("push subscription", pushSubscriptions, savePushSubscription, "pushSubscriptions");

if (emailJobs.lastDailyReminder) setEmailJobField("lastDailyReminder", emailJobs.lastDailyReminder);
if (emailJobs.lastWeeklyDigest) setEmailJobField("lastWeeklyDigest", emailJobs.lastWeeklyDigest);

console.log("\nMigrated:");
console.log(`  users:             ${counts.users} / ${users.length}`);
console.log(`  conversations:     ${counts.conversations} / ${conversations.length}`);
console.log(`  partnerProfiles:   ${counts.partnerProfiles} / ${partnerProfiles.length}`);
console.log(`  checkins:          ${counts.checkins} / ${checkins.length}`);
console.log(`  shares:            ${counts.shares} / ${shares.length}`);
console.log(`  compares:          ${counts.compares} / ${compares.length}`);
console.log(`  pushSubscriptions: ${counts.pushSubscriptions} / ${pushSubscriptions.length}`);
console.log(`  emailJobs:         lastDailyReminder=${emailJobs.lastDailyReminder ?? "(none)"}, lastWeeklyDigest=${emailJobs.lastWeeklyDigest ?? "(none)"}`);

if (errors.length) {
  console.log(`\n${errors.length} record(s) failed to migrate:`);
  for (const e of errors) console.log(`  - ${e}`);
}

// Verification pass: read everything back out of the new SQLite database and
// confirm the counts line up with what we just wrote (not a byte-for-byte
// diff, but enough to catch anything that silently didn't persist).
const verify = loadDb();
const verifyOk =
  verify.users.length >= counts.users &&
  verify.conversations.length >= counts.conversations &&
  verify.partnerProfiles.length >= counts.partnerProfiles &&
  verify.checkins.length >= counts.checkins &&
  verify.shares.length >= counts.shares &&
  verify.compares.length >= counts.compares &&
  verify.pushSubscriptions.length >= counts.pushSubscriptions;

console.log(`\nVerification (reading back from SQLite): ${verifyOk ? "OK" : "MISMATCH — see counts above"}`);
console.log(
  `SQLite now has: ${verify.users.length} users, ${verify.conversations.length} conversations, ${verify.partnerProfiles.length} partner profiles, ` +
    `${verify.checkins.length} check-ins, ${verify.shares.length} shares, ${verify.compares.length} compares, ${verify.pushSubscriptions.length} push subscriptions.`
);

if (errors.length || !verifyOk) {
  console.log("\nMigration finished WITH PROBLEMS — do not delete data/db.json. Review the errors above before deploying.");
  process.exit(1);
}

console.log("\nMigration finished successfully. Keep data/db.json around as a backup until you've confirmed the app works correctly.");
