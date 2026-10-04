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
      lifetimeMessageCoachUses INTEGER NOT NULL DEFAULT 0, -- unused since the Message Coach feature was removed; left in place (rather than migrated away) since it's harmless dead data and dropping a column is needless migration risk
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
      practiceDebriefAt TEXT,
      practiceDebriefFeedback TEXT,
      pinned INTEGER NOT NULL DEFAULT 0
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

    CREATE TABLE IF NOT EXISTS coupleLinks (
      id TEXT PRIMARY KEY,
      userA TEXT NOT NULL,
      userB TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      inviteToken TEXT UNIQUE,
      createdAt TEXT,
      acceptedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_coupleLinks_userA ON coupleLinks(userA);
    CREATE INDEX IF NOT EXISTS idx_coupleLinks_userB ON coupleLinks(userB);
    CREATE INDEX IF NOT EXISTS idx_coupleLinks_inviteToken ON coupleLinks(inviteToken);

    CREATE TABLE IF NOT EXISTS coupleAnswers (
      id TEXT PRIMARY KEY,
      coupleLinkId TEXT NOT NULL,
      date TEXT NOT NULL,
      question TEXT,
      answerA TEXT,
      answerAAt TEXT,
      answerB TEXT,
      answerBAt TEXT,
      UNIQUE(coupleLinkId, date)
    );
    CREATE INDEX IF NOT EXISTS idx_coupleAnswers_coupleLinkId ON coupleAnswers(coupleLinkId);

    -- One user's own private daily-question stream (task #98 follow-up) —
    -- lets someone answer the daily relationship question before (or
    -- without ever) linking a partner. Deliberately a separate table from
    -- coupleAnswers rather than a coupleLinkId-nullable row on it: a solo
    -- answer has exactly one answer/timestamp (not answerA/answerB), and
    -- keeping the two tables distinct is what keeps a user's pre-link solo
    -- history from ever being confused with, or merged into, a couple's
    -- shared stream once they do link up (Jonas: solo history stays
    -- separate; the couple stream always starts fresh from day one).
    CREATE TABLE IF NOT EXISTS soloAnswers (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      date TEXT NOT NULL,
      question TEXT,
      answer TEXT,
      answeredAt TEXT,
      UNIQUE(userId, date)
    );
    CREATE INDEX IF NOT EXISTS idx_soloAnswers_userId ON soloAnswers(userId);

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
  // Practice Mode: how hard the roleplay pushes back ("realistic" is the
  // original, unchanged behavior — a supportive/calmer option is additive),
  // and whether the user is rehearsing their OWN side of the conversation or
  // deliberately swapped to rehearse their partner's side instead (a
  // perspective-taking exercise, not a bug in whose "character" is playing).
  ensureColumn(db, "conversations", "intensity", "TEXT");
  ensureColumn(db, "conversations", "practiceRoleSwap", "INTEGER NOT NULL DEFAULT 0");
  // A standing, evolving summary of the user's relationship carried across
  // ALL of their Coach Chat conversations — not scoped to one conversation
  // the way therapistSummary/practiceDebrief are. Same shape as insights
  // (a text blob + a timestamp) for the same reason: cheap to keep fresh,
  // easy to regenerate from scratch rather than trying to diff/merge it.
  ensureColumn(db, "users", "relationshipMemory", "TEXT");
  ensureColumn(db, "users", "relationshipMemoryAt", "TEXT");
  // Thumbs up/down on a Partner Practice debrief (task #93) — "up" | "down" |
  // NULL, same shape as per-message feedback on Coach Chat replies. Scoped to
  // the conversation, not a message id: see the PATCH
  // /api/conversations/:id/debrief/feedback comment in server.js for why.
  ensureColumn(db, "conversations", "practiceDebriefFeedback", "TEXT");
  // Sidebar-history pin (kebab menu, task #97) — keeps a conversation at the
  // top of the history list regardless of its updatedAt, same 0/1-as-boolean
  // shape as practiceRoleSwap above.
  ensureColumn(db, "conversations", "pinned", "INTEGER NOT NULL DEFAULT 0");

  // Terms of Service consent (ISO timestamp the user ticked the box at
  // registration; NULL for accounts created before consent was collected).
  ensureColumn(db, "users", "termsAcceptedAt", "TEXT");
  // Email verification. Every account that already exists the moment this
  // column is first added is GRANDFATHERED as verified (stamped with its
  // createdAt) — otherwise the first deploy would lock every current user
  // out of the AI until they clicked a link in an email.
  const hadVerifiedCol = db.prepare("PRAGMA table_info(users)").all().some((c) => c.name === "emailVerifiedAt");
  ensureColumn(db, "users", "emailVerifiedAt", "TEXT");
  if (!hadVerifiedCol) {
    db.exec("UPDATE users SET emailVerifiedAt = COALESCE(createdAt, strftime('%Y-%m-%dT%H:%M:%fZ','now'))");
  }
  // Monthly AI-message counter for Pro/Premium fair-use caps ("YYYY-MM" +
  // count, same reset-or-increment shape as the Free plan's daily counter).
  ensureColumn(db, "users", "usageMonth", "TEXT");
  ensureColumn(db, "users", "usageMonthCount", "INTEGER NOT NULL DEFAULT 0");

  // The Attachment Style Quiz and its "Compare with your partner" companion
  // feature were removed at Jonas's request — not just hidden, permanently
  // deleted, data included. `compares` was its own dedicated table, so it's
  // simply dropped (IF EXISTS makes this safe to run on every boot, e.g. a
  // brand-new database that never had it). The quiz's own result, though,
  // lived as two columns directly on `users` (attachmentStyle,
  // attachmentQuizAt) — dropping columns from a live SQLite table is needless
  // migration risk for little benefit, so instead every existing value is
  // wiped here (also safe to run every boot — a no-op once already NULL).
  // Both columns stay in the schema and in the mappers below: nothing ever
  // writes to them again (the only route that did was the quiz route, now
  // gone), so they'll simply stay NULL forever — existing code that reads
  // user.attachmentStyle (e.g. Coach Chat's tone calibration) already treats
  // a missing style as "not known" and degrades gracefully.
  db.exec("DROP TABLE IF EXISTS compares");
  db.exec("UPDATE users SET attachmentStyle = NULL, attachmentQuizAt = NULL WHERE attachmentStyle IS NOT NULL OR attachmentQuizAt IS NOT NULL");
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
    relationshipMemory: row.relationshipMemory ?? undefined,
    relationshipMemoryAt: row.relationshipMemoryAt ?? undefined,
    termsAcceptedAt: row.termsAcceptedAt ?? undefined,
    emailVerifiedAt: row.emailVerifiedAt ?? undefined,
    usageMonthly: row.usageMonth != null ? { month: row.usageMonth, count: row.usageMonthCount || 0 } : undefined,
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
    relationshipMemory: u.relationshipMemory ?? null,
    relationshipMemoryAt: u.relationshipMemoryAt ?? null,
    termsAcceptedAt: u.termsAcceptedAt ?? null,
    emailVerifiedAt: u.emailVerifiedAt ?? null,
    usageMonth: u.usageMonthly?.month ?? null,
    usageMonthCount: u.usageMonthly?.count ?? 0,
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
    practiceDebriefFeedback: row.practiceDebriefFeedback ?? null,
    intensity: row.intensity ?? null,
    practiceRoleSwap: !!row.practiceRoleSwap,
    pinned: !!row.pinned,
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
    practiceDebriefFeedback: c.practiceDebriefFeedback ?? null,
    intensity: c.intensity ?? null,
    practiceRoleSwap: c.practiceRoleSwap ? 1 : 0,
    pinned: c.pinned ? 1 : 0,
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

function rowToCoupleLink(row) {
  if (!row) return null;
  return {
    id: row.id,
    userA: row.userA,
    userB: row.userB ?? null,
    status: row.status || "pending",
    inviteToken: row.inviteToken ?? null,
    createdAt: row.createdAt ?? undefined,
    acceptedAt: row.acceptedAt ?? undefined,
  };
}

function coupleLinkToRow(l) {
  return {
    id: l.id,
    userA: l.userA,
    userB: l.userB ?? null,
    status: l.status || "pending",
    inviteToken: l.inviteToken ?? null,
    createdAt: l.createdAt ?? null,
    acceptedAt: l.acceptedAt ?? null,
  };
}

function rowToCoupleAnswer(row) {
  if (!row) return null;
  return {
    id: row.id,
    coupleLinkId: row.coupleLinkId,
    date: row.date,
    question: row.question ?? "",
    answerA: row.answerA ?? null,
    answerAAt: row.answerAAt ?? undefined,
    answerB: row.answerB ?? null,
    answerBAt: row.answerBAt ?? undefined,
  };
}

function coupleAnswerToRow(a) {
  return {
    id: a.id,
    coupleLinkId: a.coupleLinkId,
    date: a.date,
    question: a.question ?? "",
    answerA: a.answerA ?? null,
    answerAAt: a.answerAAt ?? null,
    answerB: a.answerB ?? null,
    answerBAt: a.answerBAt ?? null,
  };
}

function rowToSoloAnswer(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    date: row.date,
    question: row.question ?? "",
    answer: row.answer ?? null,
    answeredAt: row.answeredAt ?? undefined,
  };
}

function soloAnswerToRow(a) {
  return {
    id: a.id,
    userId: a.userId,
    date: a.date,
    question: a.question ?? "",
    answer: a.answer ?? null,
    answeredAt: a.answeredAt ?? null,
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
    coupleLinks: db.prepare("SELECT * FROM coupleLinks").all().map(rowToCoupleLink),
    coupleAnswers: db.prepare("SELECT * FROM coupleAnswers").all().map(rowToCoupleAnswer),
    soloAnswers: db.prepare("SELECT * FROM soloAnswers").all().map(rowToSoloAnswer),
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
        lifetimePracticeConversations, lifetimeMessageCoachUses, insights, insightsAt,
        relationshipMemory, relationshipMemoryAt, termsAcceptedAt, emailVerifiedAt,
        usageMonth, usageMonthCount
      ) VALUES (
        :id, :email, :name, :passwordHash, :plan, :createdAt, :usageDate, :usageCount,
        :attachmentStyle, :attachmentQuizAt, :stripeCustomerId, :stripeSubscriptionId,
        :subscriptionStatus, :referralCode, :referredBy, :referralRewardGranted,
        :emailCheckinReminders, :emailWeeklyDigest, :lifetimeAttachmentCount,
        :lifetimePracticeConversations, :lifetimeMessageCoachUses, :insights, :insightsAt,
        :relationshipMemory, :relationshipMemoryAt, :termsAcceptedAt, :emailVerifiedAt,
        :usageMonth, :usageMonthCount
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
        insights=excluded.insights, insightsAt=excluded.insightsAt,
        relationshipMemory=excluded.relationshipMemory, relationshipMemoryAt=excluded.relationshipMemoryAt,
        termsAcceptedAt=excluded.termsAcceptedAt, emailVerifiedAt=excluded.emailVerifiedAt,
        usageMonth=excluded.usageMonth, usageMonthCount=excluded.usageMonthCount`
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

// Atomic monthly counter for Pro/Premium fair-use caps — month is "YYYY-MM".
export function incrementUserMonthlyUsage(userId, month) {
  getConnection()
    .prepare(
      `UPDATE users
       SET usageMonthCount = CASE WHEN usageMonth = :month THEN usageMonthCount + 1 ELSE 1 END,
           usageMonth = :month
       WHERE id = :userId`
    )
    .run({ userId, month });
}

// Consistent point-in-time copy of the whole database into `destPath`
// (VACUUM INTO is safe while the server is live and writing, unlike copying
// the .sqlite file by hand while WAL is active).
export function backupDatabaseTo(destPath) {
  const escaped = String(destPath).replace(/'/g, "''");
  getConnection().exec(`VACUUM INTO '${escaped}'`);
}

export function getDatabaseFilePath() {
  return getDbPath();
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

// Self-service account deletion (GDPR erasure) — removes the user row and
// every row in every other table that references it. Wrapped in a
// transaction (the one place this module uses one — every other function
// here is a single-row upsert/delete, but this one has to succeed or fail
// as a whole, or a half-deleted account could be left in a confusing state:
// e.g. conversations gone but the user row still there and loggable-into).
// Files on disk (public/uploads/<userId>/) are NOT touched here — store.js
// only knows about the database — the caller in server.js removes that
// directory itself after this returns.
export function deleteUserCascade(userId) {
  const db = getConnection();
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM conversations WHERE userId = ?").run(userId);
    db.prepare("DELETE FROM partnerProfiles WHERE userId = ?").run(userId);
    db.prepare("DELETE FROM checkins WHERE userId = ?").run(userId);
    db.prepare("DELETE FROM shares WHERE userId = ?").run(userId);
    // Any couple link this user is part of (either side) goes too, along
    // with every daily answer stored under it — deleting the account is a
    // stronger privacy guarantee than a normal unlink, so it can't leave
    // the other partner's account still holding this user's past answers.
    db.prepare(
      "DELETE FROM coupleAnswers WHERE coupleLinkId IN (SELECT id FROM coupleLinks WHERE userA = ? OR userB = ?)"
    ).run(userId, userId);
    db.prepare("DELETE FROM coupleLinks WHERE userA = ? OR userB = ?").run(userId, userId);
    db.prepare("DELETE FROM soloAnswers WHERE userId = ?").run(userId);
    db.prepare("DELETE FROM pushSubscriptions WHERE userId = ?").run(userId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
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
        practiceDebrief, practiceDebriefAt, practiceDebriefFeedback, intensity, practiceRoleSwap, pinned
      ) VALUES (
        :id, :userId, :mode, :partnerProfileId, :partnerName, :partnerTraits, :partnerContext,
        :partnerAttachmentStyle, :partnerLearnedProfile, :partnerLearnedVoice, :scenario,
        :aboutPartnerId, :title, :messages, :createdAt, :updatedAt, :therapistSummary, :therapistSummaryAt,
        :practiceDebrief, :practiceDebriefAt, :practiceDebriefFeedback, :intensity, :practiceRoleSwap, :pinned
      )
      ON CONFLICT(id) DO UPDATE SET
        mode=excluded.mode, partnerProfileId=excluded.partnerProfileId, partnerName=excluded.partnerName,
        partnerTraits=excluded.partnerTraits, partnerContext=excluded.partnerContext,
        partnerAttachmentStyle=excluded.partnerAttachmentStyle, partnerLearnedProfile=excluded.partnerLearnedProfile,
        partnerLearnedVoice=excluded.partnerLearnedVoice, scenario=excluded.scenario,
        aboutPartnerId=excluded.aboutPartnerId, title=excluded.title, messages=excluded.messages,
        updatedAt=excluded.updatedAt, therapistSummary=excluded.therapistSummary,
        therapistSummaryAt=excluded.therapistSummaryAt, practiceDebrief=excluded.practiceDebrief,
        practiceDebriefAt=excluded.practiceDebriefAt, practiceDebriefFeedback=excluded.practiceDebriefFeedback,
        intensity=excluded.intensity, practiceRoleSwap=excluded.practiceRoleSwap, pinned=excluded.pinned`
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

// Same race-safe pattern as appendConversationMessages above — re-reads the
// CURRENTLY persisted messages at write time rather than trusting a
// request's possibly-stale snapshot, so a thumbs up/down submitted while
// another request is also writing to this conversation can't clobber or get
// clobbered. Returns the updated conversation, or null if the conversation
// or the specific message id doesn't exist (e.g. a stale/tampered id).
export function setMessageFeedback(convId, messageId, feedback) {
  const db = getConnection();
  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(convId);
  if (!row) return null;
  const messages = row.messages ? JSON.parse(row.messages) : [];
  const idx = messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return null;
  messages[idx] = { ...messages[idx], feedback };
  const next = { messages: JSON.stringify(messages) };
  db.prepare("UPDATE conversations SET messages = :messages WHERE id = :id").run({ ...next, id: convId });
  return rowToConversation({ ...row, ...next });
}

// Used when editing & resending the LAST user message in a Coach Chat
// conversation (see the editMessageId handling on POST
// /api/conversations/:id/messages in server.js): removes the trailing
// user+assistant pair so the edited text can replace it and get a fresh
// reply, instead of leaving the stale original exchange sitting in the
// transcript above it. Same race-safe pattern as the functions above —
// re-reads the CURRENTLY persisted messages at write time. Only truncates
// when the tail still actually looks like what the client thinks it's
// editing (last message is an assistant reply, the one right before it is
// a user message with the given id) — if anything else was appended to
// this conversation in between (e.g. another tab), it's a no-op, so the
// caller can safely fall back to a normal append instead of risking
// removing the wrong messages. Returns true if it truncated, false if not.
export function truncateLastMessagePairIfMatch(convId, expectedUserMessageId) {
  const db = getConnection();
  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(convId);
  if (!row) return false;
  const messages = row.messages ? JSON.parse(row.messages) : [];
  const n = messages.length;
  if (n < 2) return false;
  const last = messages[n - 1];
  const secondLast = messages[n - 2];
  if (last.role !== "assistant" || secondLast.role !== "user" || secondLast.id !== expectedUserMessageId) {
    return false;
  }
  const trimmed = messages.slice(0, n - 2);
  db.prepare("UPDATE conversations SET messages = :messages WHERE id = :id").run({
    messages: JSON.stringify(trimmed),
    id: convId,
  });
  return true;
}

// Cleans up a user message that was durably saved (see
// appendConversationMessages above) but then never got its AI reply
// because the OpenAI call itself failed right after — used by the
// coach/practice message route's catch block so a failed send truly leaves
// nothing behind server-side, matching what chat.js's UI already tells the
// person (their typed text was restored to the composer, nothing sent).
// Race-safe like the functions above, and a no-op if anything doesn't
// match (e.g. a retry already landed and got its reply first), so it can
// never remove the wrong message.
export function removeLastMessageIfMatch(convId, expectedMessageId) {
  const db = getConnection();
  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(convId);
  if (!row) return false;
  const messages = row.messages ? JSON.parse(row.messages) : [];
  const n = messages.length;
  if (n < 1) return false;
  const last = messages[n - 1];
  if (last.role !== "user" || last.id !== expectedMessageId) return false;
  const trimmed = messages.slice(0, n - 1);
  db.prepare("UPDATE conversations SET messages = :messages WHERE id = :id").run({
    messages: JSON.stringify(trimmed),
    id: convId,
  });
  return true;
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
// coupleLinks + coupleAnswers — real account-to-account linking for the
// daily shared relationship question (task #98). A couple link is a
// standing relationship between two real accounts that persists across days
// until either side unlinks it (see soloAnswers further below for the
// same daily question answered solo, before or without ever linking).
// ---------------------------------------------------------------------------

export function saveCoupleLink(l) {
  const r = coupleLinkToRow(l);
  getConnection()
    .prepare(
      `INSERT INTO coupleLinks (id, userA, userB, status, inviteToken, createdAt, acceptedAt)
       VALUES (:id, :userA, :userB, :status, :inviteToken, :createdAt, :acceptedAt)
       ON CONFLICT(id) DO UPDATE SET
         userB=excluded.userB, status=excluded.status, acceptedAt=excluded.acceptedAt`
    )
    .run(r);
  return l;
}

// Deletes the link AND every daily answer stored under it, in one
// transaction — an unlink is meant to be a clean break, not a link that
// silently keeps its answer history around for whoever still has the id.
export function deleteCoupleLink(id) {
  const db = getConnection();
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM coupleAnswers WHERE coupleLinkId = ?").run(id);
    db.prepare("DELETE FROM coupleLinks WHERE id = ?").run(id);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function getCoupleLinkByToken(token) {
  return rowToCoupleLink(getConnection().prepare("SELECT * FROM coupleLinks WHERE inviteToken = ?").get(token));
}

export function saveCoupleAnswer(a) {
  const r = coupleAnswerToRow(a);
  getConnection()
    .prepare(
      `INSERT INTO coupleAnswers (id, coupleLinkId, date, question, answerA, answerAAt, answerB, answerBAt)
       VALUES (:id, :coupleLinkId, :date, :question, :answerA, :answerAAt, :answerB, :answerBAt)
       ON CONFLICT(id) DO UPDATE SET
         answerA=excluded.answerA, answerAAt=excluded.answerAAt,
         answerB=excluded.answerB, answerBAt=excluded.answerBAt`
    )
    .run(r);
  return a;
}

// Atomic get-or-create for a couple's daily question row. Picking which
// question to ask (static bank vs. freshly AI-generated once the bank is
// exhausted — see ensureTodaysCoupleQuestion in server.js) can itself
// involve an OpenAI call, so by the time the caller is ready to persist,
// another request for the SAME couple (the other partner opening "today"
// at nearly the same moment) may have already created the row — possibly
// with a different (independently AI-generated) question text. ON
// CONFLICT(coupleLinkId, date) DO NOTHING means only the first writer's
// question actually gets stored; the SELECT right after always returns
// whichever one that was, so both partners are guaranteed to see the exact
// same persisted question even if they raced to create it.
export function saveCoupleAnswerIfAbsent(coupleLinkId, date, question) {
  const db = getConnection();
  db.prepare(
    `INSERT INTO coupleAnswers (id, coupleLinkId, date, question, answerA, answerAAt, answerB, answerBAt)
     VALUES (:id, :coupleLinkId, :date, :question, NULL, NULL, NULL, NULL)
     ON CONFLICT(coupleLinkId, date) DO NOTHING`
  ).run({ id: generateId("cqa"), coupleLinkId, date, question });
  return rowToCoupleAnswer(
    db.prepare("SELECT * FROM coupleAnswers WHERE coupleLinkId = ? AND date = ?").get(coupleLinkId, date)
  );
}

// ---------------------------------------------------------------------------
// soloAnswers — the same daily-question mechanic as coupleAnswers above, but
// for one user answering on their own (not yet linked to a partner, or
// never linked at all). A separate table rather than a coupleLinkId-nullable
// row on coupleAnswers on purpose: only one person's answer to shape, and it
// keeps a user's solo history from ever being reachable through a couple
// link later (see the CREATE TABLE comment in runMigrations).
// ---------------------------------------------------------------------------

export function saveSoloAnswer(a) {
  const r = soloAnswerToRow(a);
  getConnection()
    .prepare(
      `INSERT INTO soloAnswers (id, userId, date, question, answer, answeredAt)
       VALUES (:id, :userId, :date, :question, :answer, :answeredAt)
       ON CONFLICT(id) DO UPDATE SET
         answer=excluded.answer, answeredAt=excluded.answeredAt`
    )
    .run(r);
  return a;
}

// Atomic get-or-create for a user's solo daily question row — same race-safe
// shape as saveCoupleAnswerIfAbsent above (ON CONFLICT(userId, date) DO
// NOTHING + re-select), even though a solo stream has only one reader/writer
// in practice: cheap to keep it consistent with the couple version, and it
// protects against a genuine double-fire (e.g. a doubled network request).
export function saveSoloAnswerIfAbsent(userId, date, question) {
  const db = getConnection();
  db.prepare(
    `INSERT INTO soloAnswers (id, userId, date, question, answer, answeredAt)
     VALUES (:id, :userId, :date, :question, NULL, NULL)
     ON CONFLICT(userId, date) DO NOTHING`
  ).run({ id: generateId("sqa"), userId, date, question });
  return rowToSoloAnswer(db.prepare("SELECT * FROM soloAnswers WHERE userId = ? AND date = ?").get(userId, date));
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
