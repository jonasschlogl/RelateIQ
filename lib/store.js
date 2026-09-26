import { DatabaseSync } from "node:sqlite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Storage: SQLite via Node's own built-in node:sqlite module (no npm
// dependency — ships with Node itself since 22.5). Replaces the old plain
// JSON-file storage (data/db.json), which had two real problems once this
// app started taking real users and payments:
//   1. Every write rewrote the ENTIRE file from an in-memory snapshot. Any
//      request with an `await` between reading and writing (which is most
//      of them — they call OpenAI/Stripe in between) could silently lose
//      another request's concurrent changes: not just a conflict on the
//      same record, but anything else that changed anywhere in the whole
//      database during that window.
//   2. No transactions, no locking, no indexes — fine for local dev, risky
//      once user data (including crisis-adjacent chat content) is on the
//      line.
//
// Design choice that keeps this migration low-risk: server.js still gets a
// `db` object shaped exactly like before — {users: [...], conversations:
// [...], ...} — via loadDb() below, so every existing `.find()`/`.filter()`/
// `.map()`/`.sort()` read in server.js needed ZERO changes. Only the WRITE
// side changed: instead of one big writeDb(db) that blindly overwrites
// everything, each mutation now persists immediately and only touches the
// one row (or, for appendConversationMessages, does a fresh
// read-append-write right at save time) that actually changed. That's what
// closes the race described above.
//
// Same DB_PATH escape hatch as before: on a host with a persistent volume
// (so data survives a redeploy), set DB_PATH to a file inside that volume.
// Resolved lazily (not cached in a top-level const) for the same reason as
// before: this module is imported before server.js calls dotenv.config().
// ---------------------------------------------------------------------------

function getDbPath() {
  return process.env.DB_PATH || path.join(__dirname, "..", "data", "relateiq.sqlite");
}

let conn = null;

function getConnection() {
  if (conn) return conn;
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  conn = new DatabaseSync(dbPath);
  // WAL = readers don't block the writer and vice versa; busy_timeout means
  // a write that arrives while another is briefly in flight waits instead
  // of failing outright.
  conn.exec("PRAGMA journal_mode = WAL;");
  conn.exec("PRAGMA busy_timeout = 5000;");
  conn.exec("PRAGMA foreign_keys = ON;");
  runMigrations(conn);
  return conn;
}

// Adds a column to an existing table if it isn't there yet. SQLite's ALTER
// TABLE ... ADD COLUMN has no "IF NOT EXISTS" clause (unlike CREATE TABLE
// above), so this checks PRAGMA table_info first — needed because the
// CREATE TABLE IF NOT EXISTS statements below only define the shape for a
// BRAND NEW database; a table that already exists (as it does on every
// deployment made before a given column was added) is left untouched by
// them. Safe to call on every boot: a no-op once the column exists.
function ensureColumn(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      passwordHash TEXT,
      plan TEXT NOT NULL DEFAULT 'free',
      createdAt TEXT,
      usageDate TEXT,
      usageCount INTEGER NOT NULL DEFAULT 0,
      attachmentStyle TEXT,
      attachmentQuizAt TEXT,
      stripeCustomerId TEXT,
      stripeSubscriptionId TEXT,
      subscriptionStatus TEXT,
      referralCode TEXT UNIQUE,
      referredBy TEXT,
      referralRewardGranted INTEGER NOT NULL DEFAULT 0,
      emailCheckinReminders INTEGER,
      emailWeeklyDigest INTEGER,
      lifetimeAttachmentCount INTEGER NOT NULL DEFAULT 0,
      lifetimePracticeConversations INTEGER NOT NULL DEFAULT 0,
      lifetimeMessageCoachUses INTEGER NOT NULL DEFAULT 0,
      insights TEXT,
      insightsAt TEXT
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'coach',
      partnerProfileId TEXT,
      partnerName TEXT,
      partnerTraits TEXT,
      partnerContext TEXT,
      partnerAttachmentStyle TEXT,
      partnerLearnedProfile TEXT,
      partnerLearnedVoice TEXT,
      scenario TEXT,
      aboutPartnerId TEXT,
      title TEXT,
      messages TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT,
      updatedAt TEXT,
      therapistSummary TEXT,
      therapistSummaryAt TEXT,
      practiceDebrief TEXT,
      practiceDebriefAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_userId ON conversations(userId);

    CREATE TABLE IF NOT EXISTS partnerProfiles (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT,
      traits TEXT,
      context TEXT,
      attachmentStyle TEXT,
      createdAt TEXT,
      learnedProfile TEXT,
      learnedVoice TEXT,
      learnedProfileConfidence TEXT,
      learnedProfileUpdatedAt TEXT,
      learnedProfileSource TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_partnerProfiles_userId ON partnerProfiles(userId);

    CREATE TABLE IF NOT EXISTS checkins (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      question TEXT,
      answer TEXT,
      score INTEGER,
      skipped INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT,
      answeredAt TEXT,
      UNIQUE(userId, date)
    );
    CREATE INDEX IF NOT EXISTS idx_checkins_userId ON checkins(userId);

    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT,
      token TEXT UNIQUE NOT NULL,
      items TEXT NOT NULL DEFAULT '[]',
      revoked INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_shares_userId ON shares(userId);
    CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token);

    CREATE TABLE IF NOT EXISTS compares (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      ownerStyle TEXT,
      partnerStyle TEXT,
      partnerRespondedAt TEXT,
      revoked INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_compares_userId ON compares(userId);
    CREATE INDEX IF NOT EXISTS idx_compares_token ON compares(token);

    CREATE TABLE IF NOT EXISTS pushSubscriptions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      subscription TEXT NOT NULL,
      createdAt TEXT,
      UNIQUE(userId, endpoint)
    );
    CREATE INDEX IF NOT EXISTS idx_pushSubscriptions_userId ON pushSubscriptions(userId);

    CREATE TABLE IF NOT EXISTS emailJobs (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      lastDailyReminder TEXT,
      lastWeeklyDigest TEXT
    );
    INSERT OR IGNORE INTO emailJobs (id, lastDailyReminder, lastWeeklyDigest) VALUES (1, NULL, NULL);
  `);

  // Columns added after the tables above already existed in production —
  // see ensureColumn's comment for why CREATE TABLE IF NOT EXISTS alone
  // doesn't add these to a database that was created before this change.
  ensureColumn(db, "conversations", "practiceDebrief", "TEXT");
  ensureColumn(db, "conversations", "practiceDebriefAt", "TEXT");
  ensureColumn(db, "partnerProfiles", "learnedProfileSource", "TEXT");
}

export function generateId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// row <-> app-object mappers. These are the ONLY place that knows about the
// SQL column shapes (booleans as 0/1, nested structures as JSON text) — every
// function below this section hands server.js plain objects that look
// exactly like the old JSON-file records.
// ---------------------------------------------------------------------------

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? undefined,
    passwordHash: row.passwordHash ?? undefined,
    plan: row.plan || "free",
    createdAt: row.createdAt ?? undefined,
    usage: row.usageDate != null ? { date: row.usageDate, count: row.usageCount } : undefined,
    attachmentStyle: row.attachmentStyle ?? null,
    attachmentQuizAt: row.attachmentQuizAt ?? undefined,
    stripeCustomerId: row.stripeCustomerId ?? null,
    stripeSubscriptionId: row.stripeSubscriptionId ?? null,
    subscriptionStatus: row.subscriptionStatus ?? null,
    referralCode: row.referralCode ?? undefined,
    referredBy: row.referredBy ?? null,
    referralRewardGranted: !!row.referralRewardGranted,
    emailCheckinReminders: row.emailCheckinReminders === null ? undefined : !!row.emailCheckinReminders,
    emailWeeklyDigest: row.emailWeeklyDigest === null ? undefined : !!row.emailWeeklyDigest,
    lifetimeAttachmentCount: row.lifetimeAttachmentCount || 0,
    lifetimePracticeConversations: row.lifetimePracticeConversations || 0,
    lifetimeMessageCoachUses: row.lifetimeMessageCoachUses || 0,
    insights: row.insights ? JSON.parse(row.insights) : undefined,
    insightsAt: row.insightsAt ?? undefined,
  };
}

function userToRow(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name ?? null,
    passwordHash: u.passwordHash ?? null,
    plan: u.plan || "free",
    createdAt: u.createdAt ?? null,
    usageDate: u.usage?.date ?? null,
    usageCount: u.usage?.count ?? 0,
    attachmentStyle: u.attachmentStyle ?? null,
    attachmentQuizAt: u.attachmentQuizAt ?? null,
    stripeCustomerId: u.stripeCustomerId ?? null,
    stripeSubscriptionId: u.stripeSubscriptionId ?? null,
    subscriptionStatus: u.subscriptionStatus ?? null,
    referralCode: u.referralCode ?? null,
    referredBy: u.referredBy ?? null,
    referralRewardGranted: u.referralRewardGranted ? 1 : 0,
    emailCheckinReminders: u.emailCheckinReminders === undefined ? null : u.emailCheckinReminders ? 1 : 0,
    emailWeeklyDigest: u.emailWeeklyDigest === undefined ? null : u.emailWeeklyDigest ? 1 : 0,
    lifetimeAttachmentCount: u.lifetimeAttachmentCount ?? 0,
    lifetimePracticeConversations: u.lifetimePracticeConversations ?? 0,
    lifetimeMessageCoachUses: u.lifetimeMessageCoachUses ?? 0,
    insights: u.insights ? JSON.stringify(u.insights) : null,
    insightsAt: u.insightsAt ?? null,
  };
}

function rowToConversation(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    mode: row.mode || "coach",
    partnerProfileId: row.partnerProfileId ?? null,
    partnerName: row.partnerName ?? null,
    partnerTraits: row.partnerTraits ?? null,
    partnerContext: row.partnerContext ?? null,
    partnerAttachmentStyle: row.partnerAttachmentStyle ?? null,
    partnerLearnedProfile: row.partnerLearnedProfile ?? null,
    partnerLearnedVoice: row.partnerLearnedVoice ?? null,
    scenario: row.scenario ?? null,
    aboutPartnerId: row.aboutPartnerId ?? null,
    title: row.title ?? "",
    messages: row.messages ? JSON.parse(row.messages) : [],
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
    therapistSummary: row.therapistSummary ?? undefined,
    therapistSummaryAt: row.therapistSummaryAt ?? undefined,
    practiceDebrief: row.practiceDebrief ?? undefined,
    practiceDebriefAt: row.practiceDebriefAt ?? undefined,
  };
}

function conversationToRow(c) {
  return {
    id: c.id,
    userId: c.userId,
    mode: c.mode || "coach",
    partnerProfileId: c.partnerProfileId ?? null,
    partnerName: c.partnerName ?? null,
    partnerTraits: c.partnerTraits ?? null,
    partnerContext: c.partnerContext ?? null,
    partnerAttachmentStyle: c.partnerAttachmentStyle ?? null,
    partnerLearnedProfile: c.partnerLearnedProfile ?? null,
    partnerLearnedVoice: c.partnerLearnedVoice ?? null,
    scenario: c.scenario ?? null,
    aboutPartnerId: c.aboutPartnerId ?? null,
    title: c.title ?? "",
    messages: JSON.stringify(c.messages || []),
    createdAt: c.createdAt ?? null,
    updatedAt: c.updatedAt ?? null,
    therapistSummary: c.therapistSummary ?? null,
    therapistSummaryAt: c.therapistSummaryAt ?? null,
    practiceDebrief: c.practiceDebrief ?? null,
    practiceDebriefAt: c.practiceDebriefAt ?? null,
  };
}

function rowToPartnerProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    traits: row.traits ?? "",
    context: row.context ?? "",
    attachmentStyle: row.attachmentStyle ?? null,
    createdAt: row.createdAt ?? undefined,
    learnedProfile: row.learnedProfile ?? undefined,
    learnedVoice: row.learnedVoice ?? undefined,
    learnedProfileConfidence: row.learnedProfileConfidence ?? undefined,
    learnedProfileUpdatedAt: row.learnedProfileUpdatedAt ?? undefined,
    learnedProfileSource: row.learnedProfileSource ?? undefined,
  };
}

function partnerProfileToRow(p) {
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    traits: p.traits ?? "",
    context: p.context ?? "",
    attachmentStyle: p.attachmentStyle ?? null,
    createdAt: p.createdAt ?? null,
    learnedProfile: p.learnedProfile ?? null,
    learnedVoice: p.learnedVoice ?? null,
    learnedProfileConfidence: p.learnedProfileConfidence ?? null,
    learnedProfileUpdatedAt: p.learnedProfileUpdatedAt ?? null,
    learnedProfileSource: p.learnedProfileSource ?? null,
  };
}

function rowToCheckin(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    date: row.date,
    question: row.question ?? "",
    answer: row.answer ?? null,
    score: row.score ?? null,
    skipped: !!row.skipped,
    createdAt: row.createdAt ?? undefined,
    answeredAt: row.answeredAt ?? undefined,
  };
}

function checkinToRow(c) {
  return {
    id: c.id,
    userId: c.userId,
    date: c.date,
    question: c.question ?? "",
    answer: c.answer ?? null,
    score: c.score ?? null,
    skipped: c.skipped ? 1 : 0,
    createdAt: c.createdAt ?? null,
    answeredAt: c.answeredAt ?? null,
  };
}

function rowToShare(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    title: row.title ?? "Untitled share",
    token: row.token,
    items: row.items ? JSON.parse(row.items) : [],
    revoked: !!row.revoked,
    createdAt: row.createdAt ?? undefined,
    updatedAt: row.updatedAt ?? undefined,
  };
}

function shareToRow(s) {
  return {
    id: s.id,
    userId: s.userId,
    title: s.title ?? "Untitled share",
    token: s.token,
    items: JSON.stringify(s.items || []),
    revoked: s.revoked ? 1 : 0,
    createdAt: s.createdAt ?? null,
    updatedAt: s.updatedAt ?? null,
  };
}

function rowToCompare(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    token: row.token,
    ownerStyle: row.ownerStyle,
    partnerStyle: row.partnerStyle ?? null,
    partnerRespondedAt: row.partnerRespondedAt ?? null,
    revoked: !!row.revoked,
    createdAt: row.createdAt ?? undefined,
  };
}

function compareToRow(c) {
  return {
    id: c.id,
    userId: c.userId,
    token: c.token,
    ownerStyle: c.ownerStyle,
    partnerStyle: c.partnerStyle ?? null,
    partnerRespondedAt: c.partnerRespondedAt ?? null,
    revoked: c.revoked ? 1 : 0,
    createdAt: c.createdAt ?? null,
  };
}

function rowToPushSubscription(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    subscription: JSON.parse(row.subscription),
    createdAt: row.createdAt ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Whole-snapshot read — used by authMiddleware and the couple of background
// jobs that used to call readDb(). Shape matches the old JSON file exactly,
// so every existing .find()/.filter()/.map()/.sort() in server.js keeps
// working unchanged. (At real scale, loading every table on every request
// is the next thing to optimize — e.g. only loading the current user's own
// conversations — but at this app's current size it's simpler and safer to
// keep the same "load it all, work with plain arrays" shape server.js
// already expects, and it isn't a correctness problem, only a future
// performance one.)
// ---------------------------------------------------------------------------

export function loadDb() {
  const db = getConnection();
  return {
    users: db.prepare("SELECT * FROM users").all().map(rowToUser),
    conversations: db.prepare("SELECT * FROM conversations").all().map(rowToConversation),
    partnerProfiles: db.prepare("SELECT * FROM partnerProfiles").all().map(rowToPartnerProfile),
    checkins: db.prepare("SELECT * FROM checkins").all().map(rowToCheckin),
    shares: db.prepare("SELECT * FROM shares").all().map(rowToShare),
    compares: db.prepare("SELECT * FROM compares").all().map(rowToCompare),
    pushSubscriptions: db.prepare("SELECT * FROM pushSubscriptions").all().map(rowToPushSubscription),
    emailJobs: getEmailJobs(),
  };
}

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export function getUserById(id) {
  return rowToUser(getConnection().prepare("SELECT * FROM users WHERE id = ?").get(id));
}

export function getUserByEmail(email) {
  return rowToUser(getConnection().prepare("SELECT * FROM users WHERE email = ?").get(email));
}

export function getUserByStripeCustomerId(stripeCustomerId) {
  return rowToUser(getConnection().prepare("SELECT * FROM users WHERE stripeCustomerId = ?").get(stripeCustomerId));
}

export function getUserByReferralCode(referralCode) {
  return rowToUser(getConnection().prepare("SELECT * FROM users WHERE referralCode = ?").get(referralCode));
}

export function saveUser(user) {
  const r = userToRow(user);
  getConnection()
    .prepare(
      `INSERT INTO users (
        id, email, name, passwordHash, plan, createdAt, usageDate, usageCount,
        attachmentStyle, attachmentQuizAt, stripeCustomerId, stripeSubscriptionId,
        subscriptionStatus, referralCode, referredBy, referralRewardGranted,
        emailCheckinReminders, emailWeeklyDigest, lifetimeAttachmentCount,
        lifetimePracticeConversations, lifetimeMessageCoachUses, insights, insightsAt
      ) VALUES (
        :id, :email, :name, :passwordHash, :plan, :createdAt, :usageDate, :usageCount,
        :attachmentStyle, :attachmentQuizAt, :stripeCustomerId, :stripeSubscriptionId,
        :subscriptionStatus, :referralCode, :referredBy, :referralRewardGranted,
        :emailCheckinReminders, :emailWeeklyDigest, :lifetimeAttachmentCount,
        :lifetimePracticeConversations, :lifetimeMessageCoachUses, :insights, :insightsAt
      )
      ON CONFLICT(id) DO UPDATE SET
        email=excluded.email, name=excluded.name, passwordHash=excluded.passwordHash,
        plan=excluded.plan, createdAt=excluded.createdAt, usageDate=excluded.usageDate,
        usageCount=excluded.usageCount, attachmentStyle=excluded.attachmentStyle,
        attachmentQuizAt=excluded.attachmentQuizAt, stripeCustomerId=excluded.stripeCustomerId,
        stripeSubscriptionId=excluded.stripeSubscriptionId, subscriptionStatus=excluded.subscriptionStatus,
        referralCode=excluded.referralCode, referredBy=excluded.referredBy,
        referralRewardGranted=excluded.referralRewardGranted,
        emailCheckinReminders=excluded.emailCheckinReminders, emailWeeklyDigest=excluded.emailWeeklyDigest,
        lifetimeAttachmentCount=excluded.lifetimeAttachmentCount,
        lifetimePracticeConversations=excluded.lifetimePracticeConversations,
        lifetimeMessageCoachUses=excluded.lifetimeMessageCoachUses,
        insights=excluded.insights, insightsAt=excluded.insightsAt`
    )
    .run(r);
  return user;
}

// Atomic — used for the free-plan daily AI-message counter. Resets to 1 for
// a new day, otherwise increments, all in one statement, so two concurrent
// requests can never stomp on each other's count.
export function incrementUserUsage(userId, today) {
  getConnection()
    .prepare(
      `UPDATE users
       SET usageCount = CASE WHEN usageDate = :today THEN usageCount + 1 ELSE 1 END,
           usageDate = :today
       WHERE id = :userId`
    )
    .run({ userId, today });
}

const LIFETIME_COUNTER_COLUMNS = new Set([
  "lifetimeAttachmentCount",
  "lifetimePracticeConversations",
  "lifetimeMessageCoachUses",
]);

// Atomic increment for the lifetime usage counters — real SQL `SET x = x +
// ?`, not a JS read-modify-write, so it can't lose an increment to a
// concurrent request the way the old JSON-file version silently could.
export function incrementUserColumn(userId, column, by = 1) {
  if (!LIFETIME_COUNTER_COLUMNS.has(column)) {
    throw new Error(`incrementUserColumn: column not allowed: ${column}`);
  }
  getConnection()
    .prepare(`UPDATE users SET ${column} = ${column} + ? WHERE id = ?`)
    .run(by, userId);
}

// ---------------------------------------------------------------------------
// conversations
// ---------------------------------------------------------------------------

export function saveConversation(conv) {
  const r = conversationToRow(conv);
  getConnection()
    .prepare(
      `INSERT INTO conversations (
        id, userId, mode, partnerProfileId, partnerName, partnerTraits, partnerContext,
        partnerAttachmentStyle, partnerLearnedProfile, partnerLearnedVoice, scenario,
        aboutPartnerId, title, messages, createdAt, updatedAt, therapistSummary, therapistSummaryAt,
        practiceDebrief, practiceDebriefAt
      ) VALUES (
        :id, :userId, :mode, :partnerProfileId, :partnerName, :partnerTraits, :partnerContext,
        :partnerAttachmentStyle, :partnerLearnedProfile, :partnerLearnedVoice, :scenario,
        :aboutPartnerId, :title, :messages, :createdAt, :updatedAt, :therapistSummary, :therapistSummaryAt,
        :practiceDebrief, :practiceDebriefAt
      )
      ON CONFLICT(id) DO UPDATE SET
        mode=excluded.mode, partnerProfileId=excluded.partnerProfileId, partnerName=excluded.partnerName,
        partnerTraits=excluded.partnerTraits, partnerContext=excluded.partnerContext,
        partnerAttachmentStyle=excluded.partnerAttachmentStyle, partnerLearnedProfile=excluded.partnerLearnedProfile,
        partnerLearnedVoice=excluded.partnerLearnedVoice, scenario=excluded.scenario,
        aboutPartnerId=excluded.aboutPartnerId, title=excluded.title, messages=excluded.messages,
        updatedAt=excluded.updatedAt, therapistSummary=excluded.therapistSummary,
        therapistSummaryAt=excluded.therapistSummaryAt, practiceDebrief=excluded.practiceDebrief,
        practiceDebriefAt=excluded.practiceDebriefAt`
    )
    .run(r);
  return conv;
}

export function deleteConversation(id) {
  getConnection().prepare("DELETE FROM conversations WHERE id = ?").run(id);
}

// The race-sensitive one: instead of trusting an in-memory `messages` array
// that may have been snapshotted before an `await` (e.g. the OpenAI call
// between pushing the user's message and pushing the assistant's reply),
// this re-reads the CURRENT persisted messages right at write time and
// appends to THAT. Closes the race window down to one synchronous
// read+write instead of however long the AI call took.
export function appendConversationMessages(convId, newMessages, patch = {}) {
  const db = getConnection();
  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(convId);
  if (!row) return null;
  const messages = row.messages ? JSON.parse(row.messages) : [];
  messages.push(...newMessages);
  const next = {
    messages: JSON.stringify(messages),
    updatedAt: patch.updatedAt ?? row.updatedAt,
    title: patch.title ?? row.title,
  };
  db.prepare("UPDATE conversations SET messages = :messages, updatedAt = :updatedAt, title = :title WHERE id = :id").run({
    ...next,
    id: convId,
  });
  return rowToConversation({ ...row, ...next });
}

// ---------------------------------------------------------------------------
// partnerProfiles
// ---------------------------------------------------------------------------

export function savePartnerProfile(p) {
  const r = partnerProfileToRow(p);
  getConnection()
    .prepare(
      `INSERT INTO partnerProfiles (
        id, userId, name, traits, context, attachmentStyle, createdAt,
        learnedProfile, learnedVoice, learnedProfileConfidence, learnedProfileUpdatedAt, learnedProfileSource
      ) VALUES (
        :id, :userId, :name, :traits, :context, :attachmentStyle, :createdAt,
        :learnedProfile, :learnedVoice, :learnedProfileConfidence, :learnedProfileUpdatedAt, :learnedProfileSource
      )
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, traits=excluded.traits, context=excluded.context,
        attachmentStyle=excluded.attachmentStyle, learnedProfile=excluded.learnedProfile,
        learnedVoice=excluded.learnedVoice, learnedProfileConfidence=excluded.learnedProfileConfidence,
        learnedProfileUpdatedAt=excluded.learnedProfileUpdatedAt, learnedProfileSource=excluded.learnedProfileSource`
    )
    .run(r);
  return p;
}

export function deletePartnerProfile(id) {
  getConnection().prepare("DELETE FROM partnerProfiles WHERE id = ?").run(id);
}

// ---------------------------------------------------------------------------
// checkins
// ---------------------------------------------------------------------------

export function saveCheckin(c) {
  const r = checkinToRow(c);
  getConnection()
    .prepare(
      `INSERT INTO checkins (id, userId, date, question, answer, score, skipped, createdAt, answeredAt)
       VALUES (:id, :userId, :date, :question, :answer, :score, :skipped, :createdAt, :answeredAt)
       ON CONFLICT(id) DO UPDATE SET
         question=excluded.question, answer=excluded.answer, score=excluded.score,
         skipped=excluded.skipped, answeredAt=excluded.answeredAt`
    )
    .run(r);
  return c;
}

// ---------------------------------------------------------------------------
// shares
// ---------------------------------------------------------------------------

export function saveShare(s) {
  const r = shareToRow(s);
  getConnection()
    .prepare(
      `INSERT INTO shares (id, userId, title, token, items, revoked, createdAt, updatedAt)
       VALUES (:id, :userId, :title, :token, :items, :revoked, :createdAt, :updatedAt)
       ON CONFLICT(id) DO UPDATE SET
         title=excluded.title, items=excluded.items, revoked=excluded.revoked, updatedAt=excluded.updatedAt`
    )
    .run(r);
  return s;
}

export function deleteShare(id) {
  getConnection().prepare("DELETE FROM shares WHERE id = ?").run(id);
}

export function getShareByToken(token) {
  return rowToShare(getConnection().prepare("SELECT * FROM shares WHERE token = ?").get(token));
}

// ---------------------------------------------------------------------------
// compares
// ---------------------------------------------------------------------------

export function saveCompare(c) {
  const r = compareToRow(c);
  getConnection()
    .prepare(
      `INSERT INTO compares (id, userId, token, ownerStyle, partnerStyle, partnerRespondedAt, revoked, createdAt)
       VALUES (:id, :userId, :token, :ownerStyle, :partnerStyle, :partnerRespondedAt, :revoked, :createdAt)
       ON CONFLICT(id) DO UPDATE SET
         partnerStyle=excluded.partnerStyle, partnerRespondedAt=excluded.partnerRespondedAt, revoked=excluded.revoked`
    )
    .run(r);
  return c;
}

export function deleteCompare(id) {
  getConnection().prepare("DELETE FROM compares WHERE id = ?").run(id);
}

export function getCompareByToken(token) {
  return rowToCompare(getConnection().prepare("SELECT * FROM compares WHERE token = ?").get(token));
}

// ---------------------------------------------------------------------------
// pushSubscriptions
// ---------------------------------------------------------------------------

export function savePushSubscription(sub) {
  const endpoint = sub.subscription?.endpoint || "";
  getConnection()
    .prepare(
      `INSERT INTO pushSubscriptions (id, userId, endpoint, subscription, createdAt)
       VALUES (:id, :userId, :endpoint, :subscription, :createdAt)
       ON CONFLICT(userId, endpoint) DO UPDATE SET
         id=excluded.id, subscription=excluded.subscription`
    )
    .run({
      id: sub.id,
      userId: sub.userId,
      endpoint,
      subscription: JSON.stringify(sub.subscription || {}),
      createdAt: sub.createdAt ?? null,
    });
  return sub;
}

export function deletePushSubscription(id) {
  getConnection().prepare("DELETE FROM pushSubscriptions WHERE id = ?").run(id);
}

// Used by POST /api/push/unsubscribe: drop either one specific subscription
// (userId + endpoint) or every subscription this user has (endpoint omitted
// — e.g. "stop notifying me on all my devices").
export function deletePushSubscriptionsForUser(userId, endpoint) {
  if (endpoint) {
    getConnection().prepare("DELETE FROM pushSubscriptions WHERE userId = ? AND endpoint = ?").run(userId, endpoint);
  } else {
    getConnection().prepare("DELETE FROM pushSubscriptions WHERE userId = ?").run(userId);
  }
}

export function getPushSubscriptionsForUser(userId) {
  return getConnection()
    .prepare("SELECT * FROM pushSubscriptions WHERE userId = ?")
    .all(userId)
    .map(rowToPushSubscription);
}

// ---------------------------------------------------------------------------
// emailJobs (singleton)
// ---------------------------------------------------------------------------

export function getEmailJobs() {
  const row = getConnection().prepare("SELECT * FROM emailJobs WHERE id = 1").get();
  return { lastDailyReminder: row?.lastDailyReminder ?? null, lastWeeklyDigest: row?.lastWeeklyDigest ?? null };
}

const EMAIL_JOB_FIELDS = new Set(["lastDailyReminder", "lastWeeklyDigest"]);

export function setEmailJobField(field, value) {
  if (!EMAIL_JOB_FIELDS.has(field)) throw new Error(`setEmailJobField: invalid field: ${field}`);
  getConnection()
    .prepare(`UPDATE emailJobs SET ${field} = ? WHERE id = 1`)
    .run(value);
}

// ---------------------------------------------------------------------------
// Only exported for the one-time migration script (scripts/migrate-to-sqlite.js)
// and tests — server.js never needs raw connection access.
// ---------------------------------------------------------------------------
export function _getConnectionForMigration() {
  return getConnection();
}
