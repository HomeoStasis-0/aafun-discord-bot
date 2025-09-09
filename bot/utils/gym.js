const fs = require('fs');
const path = require('path');
const { GYM_CHANNEL_ID, GYM_ROLE_ID } = require('../../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const JSON_FILE = path.resolve(__dirname, '../../gym_db.json');

// Prefer DATABASE_URL (Postgres) when present, otherwise fall back to sqlite
const DATABASE_URL = process.env.DATABASE_URL || null;

// Postgres client
let pgClient = null;
let sqlite3, open, sqliteDb;

function weekDayLetter(n) {
  const letters = ['SU','M','T','W','TH','F','SA'];
  return letters[n];
}

async function ensurePostgres() {
  if (pgClient) return pgClient;
  const { Client } = require('pg');
  const c = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  pgClient = c;
  // create tables if not exists
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS users (
      userId TEXT PRIMARY KEY,
      schedule TEXT,
      streak INTEGER DEFAULT 0,
      lastCheck TEXT,
      checks TEXT
    );
  `);
  await pgClient.query(`
    CREATE TABLE IF NOT EXISTS pending (
      messageId TEXT PRIMARY KEY,
      userId TEXT,
      createdAt TEXT
    );
  `);
  return pgClient;
}

async function ensureSqlite() {
  if (sqliteDb) return sqliteDb;
  sqlite3 = require('sqlite3').verbose();
  open = require('sqlite').open;
  sqliteDb = await open({ filename: path.resolve(__dirname, '../../gym_db.sqlite'), driver: sqlite3.Database });
  await sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      userId TEXT PRIMARY KEY,
      schedule TEXT,
      streak INTEGER DEFAULT 0,
      lastCheck TEXT,
      checks TEXT
    );
  `);
  await sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS pending (
      messageId TEXT PRIMARY KEY,
      userId TEXT,
      createdAt TEXT
    );
  `);
  return sqliteDb;
}

async function ensureDb() {
  if (DATABASE_URL) return ensurePostgres();
  return ensureSqlite();
}

// Migration: read gym_db.json and insert into whichever DB is active
async function migrateFromJsonIfNeeded() {
  if (!fs.existsSync(JSON_FILE)) return;
  const raw = fs.readFileSync(JSON_FILE, 'utf8') || '{}';
  let j = {};
  try { j = JSON.parse(raw); } catch (e) { console.error('[gym] invalid JSON file', e.message); return; }

  if (DATABASE_URL) {
    const db = await ensurePostgres();
    const r = await db.query('SELECT COUNT(1) as c FROM users');
    const c = (r && r.rows && r.rows[0]) ? parseInt(r.rows[0].c,10) : 0;
    if (c === 0 && j.users) {
      for (const [uid, data] of Object.entries(j.users)) {
        await db.query('INSERT INTO users (userId, schedule, streak, lastCheck, checks) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (userId) DO UPDATE SET schedule=EXCLUDED.schedule, streak=EXCLUDED.streak, lastCheck=EXCLUDED.lastcheck, checks=EXCLUDED.checks', [uid, JSON.stringify(data.schedule||[]), data.streak||0, data.lastCheck||null, JSON.stringify(data.checks||{})]);
      }
      console.log('[gym] migrated users from gym_db.json to postgres');
    }
    if (j.pending) {
      for (const [mid, pending] of Object.entries(j.pending)) {
        await db.query('INSERT INTO pending (messageId, userId, createdAt) VALUES ($1,$2,$3) ON CONFLICT (messageId) DO NOTHING', [mid, pending.userId, pending.createdAt]);
      }
      console.log('[gym] migrated pending from gym_db.json to postgres');
    }
  } else {
    const db = await ensureSqlite();
    const row = await db.get('SELECT COUNT(1) as c FROM users');
    const c = row ? row.c : 0;
    if (c === 0 && j.users) {
      const insert = await db.prepare('INSERT OR REPLACE INTO users (userId, schedule, streak, lastCheck, checks) VALUES (?, ?, ?, ?, ?)');
      for (const [uid, data] of Object.entries(j.users)) {
        await insert.run(uid, JSON.stringify(data.schedule || []), data.streak || 0, data.lastCheck || null, JSON.stringify(data.checks || {}));
      }
      await insert.finalize();
      console.log('[gym] migrated users from gym_db.json to sqlite');
    }
    if (j.pending) {
      const pinsert = await db.prepare('INSERT OR REPLACE INTO pending (messageId, userId, createdAt) VALUES (?, ?, ?)');
      for (const [mid, pending] of Object.entries(j.pending)) {
        await pinsert.run(mid, pending.userId, pending.createdAt);
      }
      await pinsert.finalize();
      console.log('[gym] migrated pending from gym_db.json to sqlite');
    }
  }
}

// CRUD helpers abstracted for both DBs
async function runQuery(sql, params=[]) {
  if (DATABASE_URL) {
    const db = await ensurePostgres();
    return db.query(sql, params);
  } else {
    const db = await ensureSqlite();
    return db.run(sql, params);
  }
}

async function getQuery(sql, params=[]) {
  if (DATABASE_URL) {
    const db = await ensurePostgres();
    const r = await db.query(sql, params);
    return (r.rows && r.rows[0]) ? r.rows[0] : null;
  } else {
    const db = await ensureSqlite();
    return db.get(sql, params);
  }
}

async function allQuery(sql, params=[]) {
  if (DATABASE_URL) {
    const db = await ensurePostgres();
    const r = await db.query(sql, params);
    return r.rows || [];
  } else {
    const db = await ensureSqlite();
    return db.all(sql, params);
  }
}

async function registerUser(userId, days, messageId) {
  if (Array.isArray(days) && days.length) {
    const sched = JSON.stringify(days);
    if (DATABASE_URL) {
      await runQuery('INSERT INTO users (userId, schedule, streak, lastCheck, checks) VALUES ($1,$2,COALESCE((SELECT streak FROM users WHERE userId=$1),0),COALESCE((SELECT lastcheck FROM users WHERE userId=$1),NULL),COALESCE((SELECT checks FROM users WHERE userId=$1),$3)) ON CONFLICT (userId) DO UPDATE SET schedule=EXCLUDED.schedule', [userId, sched, JSON.stringify({})]);
    } else {
      await runQuery('INSERT OR REPLACE INTO users (userId, schedule, streak, lastCheck, checks) VALUES (?, ?, COALESCE((SELECT streak FROM users WHERE userId = ?), 0), COALESCE((SELECT lastCheck FROM users WHERE userId = ?), NULL), COALESCE((SELECT checks FROM users WHERE userId = ?), ?))', [userId, sched, userId, userId, userId, JSON.stringify({})]);
    }
    return;
  }
  if (messageId) {
    // ensure only one pending per user
    await runQuery(DATABASE_URL ? 'DELETE FROM pending WHERE userId = $1' : 'DELETE FROM pending WHERE userId = ?', [userId]);
    await runQuery(DATABASE_URL ? 'INSERT INTO pending (messageId, userId, createdAt) VALUES ($1,$2,$3) ON CONFLICT (messageId) DO NOTHING' : 'INSERT OR REPLACE INTO pending (messageId, userId, createdAt) VALUES (?,?,?)', [messageId, userId, new Date().toISOString()]);
  }
}

async function finalizeRegistrationFromMessage(messageId, userId, selectedLetters) {
  const pending = await getPendingByMessage(messageId);
  if (!pending) return null;
  if (pending.userId !== userId) return null;
  const sched = JSON.stringify(selectedLetters);
  if (DATABASE_URL) {
    await runQuery('INSERT INTO users (userId, schedule, streak, lastCheck, checks) VALUES ($1,$2,COALESCE((SELECT streak FROM users WHERE userId=$1),0),COALESCE((SELECT lastcheck FROM users WHERE userId=$1),NULL),COALESCE((SELECT checks FROM users WHERE userId=$1),$3)) ON CONFLICT (userId) DO UPDATE SET schedule=EXCLUDED.schedule', [userId, sched, JSON.stringify({})]);
    await runQuery('DELETE FROM pending WHERE messageId = $1', [messageId]);
  } else {
    await runQuery('INSERT OR REPLACE INTO users (userId, schedule, streak, lastCheck, checks) VALUES (?, ?, COALESCE((SELECT streak FROM users WHERE userId = ?), 0), COALESCE((SELECT lastCheck FROM users WHERE userId = ?), NULL), COALESCE((SELECT checks FROM users WHERE userId = ?), ?))', [userId, sched, userId, userId, userId, JSON.stringify({})]);
    await runQuery('DELETE FROM pending WHERE messageId = ?', [messageId]);
  }
  return getUser(userId);
}

async function getPendingByMessage(messageId) {
  const row = await getQuery(DATABASE_URL ? 'SELECT * FROM pending WHERE messageId = $1' : 'SELECT * FROM pending WHERE messageId = ?', [messageId]);
  if (!row) return null;
  // normalize column names (Postgres returns lowercase column names)
  return {
    messageId: row.messageid || row.messageId,
    userId: row.userid || row.userId,
    createdAt: row.createdat || row.createdAt
  };
}

async function getUser(userId) {
  const row = await getQuery(DATABASE_URL ? 'SELECT * FROM users WHERE userId = $1' : 'SELECT * FROM users WHERE userId = ?', [userId]);
  if (!row) return null;
  return {
    schedule: JSON.parse(row.schedule || '[]'),
    streak: row.streak || 0,
    lastCheck: row.lastcheck || row.lastCheck || null,
    checks: JSON.parse(row.checks || '{}')
  };
}

async function getAllUsers() {
  const rows = await allQuery(DATABASE_URL ? 'SELECT userId, schedule, streak, lastcheck as lastCheck, checks FROM users' : 'SELECT userId, schedule, streak, lastCheck, checks FROM users');
  const out = {};
  for (const r of rows) {
    out[r.userid || r.userId] = { schedule: JSON.parse(r.schedule || '[]'), streak: r.streak || 0, lastCheck: r.lastcheck || r.lastCheck, checks: JSON.parse(r.checks || '{}') };
  }
  return out;
}

async function recordCheck(userId, dateStr, success) {
  // compute date and weekday in America/Chicago to match scheduled posts
  const ct = new Date((new Date(dateStr)).toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const d = ct.toISOString().slice(0,10);
  const day = ct.getDay();
  const letter = weekDayLetter(day);
  const userRow = await getQuery(DATABASE_URL ? 'SELECT * FROM users WHERE userId = $1' : 'SELECT * FROM users WHERE userId = ?', [userId]);
  if (!userRow) return null;
  const u = {
    schedule: JSON.parse(userRow.schedule || '[]'),
    checks: JSON.parse(userRow.checks || '{}'),
    streak: userRow.streak || 0,
    lastCheck: userRow.lastcheck || userRow.lastCheck || null
  };
  const isScheduled = Array.isArray(u.schedule) && u.schedule.includes(letter);
  // prevent duplicate same-day responses
  if (u.checks[d] !== undefined) return u.streak;

  // record that the user responded for this date (true for yes, false for no)
  u.checks[d] = !!success;

  if (success) {
    // only update streak/lastCheck for scheduled days
    if (isScheduled) {
      u.streak = (u.streak || 0) + 1;
      u.lastCheck = d;
    } else {
      // non-scheduled positive responses are recorded but do not affect streak
    }
  } else {
    // missed responses: reset streak for scheduled days and mark lastCheck
    if (isScheduled) {
      u.streak = 0;
      u.lastCheck = d;
    } else {
      // non-scheduled negative response: record it but don't alter streak
    }
  }
  if (DATABASE_URL) {
    await runQuery('UPDATE users SET checks = $1, streak = $2, lastcheck = $3 WHERE userId = $4', [JSON.stringify(u.checks), u.streak, u.lastCheck, userId]);
  } else {
    await runQuery('UPDATE users SET checks = ?, streak = ?, lastCheck = ? WHERE userId = ?', [JSON.stringify(u.checks), u.streak, u.lastCheck, userId]);
  }
  return u.streak;
}

async function resetWeekly() {
  if (DATABASE_URL) await runQuery('UPDATE users SET checks = $1', [JSON.stringify({})]);
  else await runQuery('UPDATE users SET checks = ?', [JSON.stringify({})]);
}

async function checkMissedForDate(date) {
  // compute date/day in America/Chicago timezone to match scheduled posts
  const ct = (date instanceof Date)
    ? new Date(date.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
    : new Date((new Date(date)).toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const d = ct.toISOString().slice(0,10);
  const day = ct.getDay();
  const letter = weekDayLetter(day);
  const rows = await allQuery(DATABASE_URL ? 'SELECT userId, schedule, checks FROM users' : 'SELECT userId, schedule, checks FROM users');
  for (const r of rows) {
    const sched = JSON.parse(r.schedule || '[]');
    if (!sched.includes(letter)) continue;
    const checks = JSON.parse(r.checks || '{}');
    if (checks[d]) continue;
    if (DATABASE_URL) await runQuery('UPDATE users SET streak = 0, lastcheck = $1 WHERE userId = $2', [d, r.userid || r.userId]);
    else await runQuery('UPDATE users SET streak = 0, lastCheck = ? WHERE userId = ?', [d, r.userId]);
  }
}

function scheduleDaily(client) {
  function ctNow() {
    const s = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
    return new Date(s);
  }

  async function runForDate(dateCT) {
    try {
      const channel = await client.channels.fetch(GYM_CHANNEL_ID).catch(() => null);
      if (!channel) return;
      const yesterday = new Date(dateCT);
      yesterday.setDate(yesterday.getDate() - 1);
      await checkMissedForDate(yesterday);
      const day = dateCT.getDay();
      if (day === 1) await resetWeekly();
      const letter = weekDayLetter(day);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`gym_yes_${letter}_${Date.now()}`).setLabel('Yes').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`gym_no_${letter}_${Date.now()}`).setLabel('No').setStyle(ButtonStyle.Danger)
      );
      await channel.send({ content: `<@&${GYM_ROLE_ID}> Did you hit the gym today? (${letter})`, components: [row], allowedMentions: { roles: [GYM_ROLE_ID] } });
    } catch (err) {
      console.error('Gym schedule error:', err.message);
    }
  }

  function scheduleNext() {
    const nowCT = ctNow();
    const next = new Date(nowCT);
    next.setHours(8, 0, 0, 0);
    if (nowCT >= next) next.setDate(next.getDate() + 1);
    const delay = next - nowCT;
    setTimeout(async () => {
      const dateCT = ctNow();
      await runForDate(dateCT);
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

async function sendCheckinNow(client) {
  const nowCTStr = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const dateCT = new Date(nowCTStr);
  try {
    const channel = await client.channels.fetch(GYM_CHANNEL_ID).catch(() => null);
    if (!channel) throw new Error('No channel');
    const yesterday = new Date(dateCT);
    yesterday.setDate(yesterday.getDate() - 1);
    await checkMissedForDate(yesterday);
    const day = dateCT.getDay();
    if (day === 1) await resetWeekly();
    const letter = weekDayLetter(day);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`gym_yes_${letter}_${Date.now()}`).setLabel('Yes').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`gym_no_${letter}_${Date.now()}`).setLabel('No').setStyle(ButtonStyle.Danger)
    );
    await channel.send({ content: `<@&${GYM_ROLE_ID}> Did you hit the gym today? (${letter})`, components: [row], allowedMentions: { roles: [GYM_ROLE_ID] } });
  } catch (err) {
    console.error('sendCheckinNow error', err.message);
    throw err;
  }
}

// Admin helper: set a user's streak manually (useful for fixing mistakes)
async function setStreak(userId, streak) {
  if (DATABASE_URL) {
    await runQuery('INSERT INTO users (userId, schedule, streak, lastcheck, checks) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (userId) DO NOTHING', [userId, JSON.stringify([]), 0, null, JSON.stringify({})]);
    await runQuery('UPDATE users SET streak = $1 WHERE userId = $2', [streak, userId]);
  } else {
    const db = await ensureSqlite();
    await db.run('INSERT OR IGNORE INTO users (userId, schedule, streak, lastCheck, checks) VALUES (?, ?, ?, ?, ?) ', userId, JSON.stringify([]), 0, null, JSON.stringify({}));
    await db.run('UPDATE users SET streak = ? WHERE userId = ?', streak, userId);
  }
}

// run migration at module load
async function promotePendingIfAny() {
  try {
    const rows = await allQuery(DATABASE_URL ? 'SELECT messageid as messageId, userid as userId, createdat as createdAt FROM pending' : 'SELECT messageId, userId, createdAt FROM pending');
    if (!rows || !rows.length) return false;
    for (const p of rows) {
      const userId = p.userid || p.userId;
      console.log('[gym] promoting pending for user', userId, 'message', p.messageid || p.messageId);
      if (DATABASE_URL) {
        await runQuery('INSERT INTO users (userId, schedule, streak, lastcheck, checks) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (userId) DO NOTHING', [userId, JSON.stringify([]), 0, null, JSON.stringify({})]);
        await runQuery('DELETE FROM pending WHERE messageid = $1', [p.messageid || p.messageId]);
      } else {
        const db = await ensureSqlite();
        await db.run('INSERT OR IGNORE INTO users (userId, schedule, streak, lastCheck, checks) VALUES (?, ?, ?, ?, ?)', userId, JSON.stringify([]), 0, null, JSON.stringify({}));
        await db.run('DELETE FROM pending WHERE messageId = ?', p.messageId);
      }
    }
    console.log('[gym] promoted pending rows');
    return true;
  } catch (e) {
    console.error('[gym] promotePending error', e.message);
    return false;
  }
}

(async () => {
  try {
    await migrateFromJsonIfNeeded();
    await promotePendingIfAny();
  } catch (e) { console.error('[gym] migration startup error', e.message); }
})();

module.exports = { registerUser, getUser, recordCheck, scheduleDaily, finalizeRegistrationFromMessage, getPendingByMessage, sendCheckinNow, getAllUsers, setStreak };
