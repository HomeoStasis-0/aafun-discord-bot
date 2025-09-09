const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const { GYM_CHANNEL_ID, GYM_ROLE_ID } = require('../../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const JSON_FILE = path.resolve(__dirname, '../../gym_db.json');
const DB_FILE = path.resolve(__dirname, '../../gym_db.sqlite');

let dbPromise = null;

async function ensureDb() {
  if (dbPromise) return dbPromise;
  dbPromise = open({ filename: DB_FILE, driver: sqlite3.Database });
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      userId TEXT PRIMARY KEY,
      schedule TEXT,
      streak INTEGER DEFAULT 0,
      lastCheck TEXT,
      checks TEXT
    );
    CREATE TABLE IF NOT EXISTS pending (
      messageId TEXT PRIMARY KEY,
      userId TEXT,
      createdAt TEXT
    );
  `);
  // migrate from JSON if present and DB empty
  const row = await db.get("SELECT COUNT(1) as c FROM users");
  if (row && row.c === 0 && fs.existsSync(JSON_FILE)) {
    try {
      const j = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8') || '{}');
      if (j.users) {
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
    } catch (e) {
      console.error('[gym] migration error', e.message);
    }
  }
  return db;
}

function weekDayLetter(n) {
  const letters = ['SU','M','T','W','TH','F','SA'];
  return letters[n];
}

async function registerUser(userId, days, messageId) {
  const db = await ensureDb();
  if (Array.isArray(days) && days.length) {
    await db.run('INSERT OR REPLACE INTO users (userId, schedule, streak, lastCheck, checks) VALUES (?, ?, COALESCE((SELECT streak FROM users WHERE userId = ?), 0), COALESCE((SELECT lastCheck FROM users WHERE userId = ?), NULL), COALESCE((SELECT checks FROM users WHERE userId = ?), ?))',
      userId, JSON.stringify(days), userId, userId, userId, JSON.stringify({}));
    return;
  }
  if (messageId) {
    // ensure only one pending per user
    // remove any existing pending for this user
    await db.run('DELETE FROM pending WHERE userId = ?', userId);
    await db.run('INSERT OR REPLACE INTO pending (messageId, userId, createdAt) VALUES (?, ?, ?)', messageId, userId, new Date().toISOString());
  }
}

async function finalizeRegistrationFromMessage(messageId, userId, selectedLetters) {
  const db = await ensureDb();
  const pending = await db.get('SELECT * FROM pending WHERE messageId = ?', messageId);
  if (!pending) return null;
  if (pending.userId !== userId) return null;
  await db.run('INSERT OR REPLACE INTO users (userId, schedule, streak, lastCheck, checks) VALUES (?, ?, COALESCE((SELECT streak FROM users WHERE userId = ?), 0), COALESCE((SELECT lastCheck FROM users WHERE userId = ?), NULL), COALESCE((SELECT checks FROM users WHERE userId = ?), ?))',
    userId, JSON.stringify(selectedLetters), userId, userId, userId, JSON.stringify({}));
  await db.run('DELETE FROM pending WHERE messageId = ?', messageId);
  const u = await getUser(userId);
  return u;
}

async function getPendingByMessage(messageId) {
  const db = await ensureDb();
  return db.get('SELECT * FROM pending WHERE messageId = ?', messageId);
}

async function getUser(userId) {
  const db = await ensureDb();
  const row = await db.get('SELECT * FROM users WHERE userId = ?', userId);
  if (!row) return null;
  return {
    schedule: JSON.parse(row.schedule || '[]'),
    streak: row.streak || 0,
    lastCheck: row.lastCheck || null,
    checks: JSON.parse(row.checks || '{}')
  };
}

async function getAllUsers() {
  const db = await ensureDb();
  const rows = await db.all('SELECT userId, schedule, streak, lastCheck, checks FROM users');
  const out = {};
  for (const r of rows) {
    out[r.userId] = { schedule: JSON.parse(r.schedule || '[]'), streak: r.streak || 0, lastCheck: r.lastCheck, checks: JSON.parse(r.checks || '{}') };
  }
  return out;
}

async function recordCheck(userId, dateStr, success) {
  const db = await ensureDb();
  const d = (new Date(dateStr)).toISOString().slice(0,10);
  const day = new Date(dateStr).getDay();
  const letter = weekDayLetter(day);
  const userRow = await db.get('SELECT * FROM users WHERE userId = ?', userId);
  if (!userRow) return null;
  const u = {
    schedule: JSON.parse(userRow.schedule || '[]'),
    checks: JSON.parse(userRow.checks || '{}'),
    streak: userRow.streak || 0,
    lastCheck: userRow.lastCheck || null
  };
  const isScheduled = Array.isArray(u.schedule) && u.schedule.includes(letter);
  // if already recorded today, do nothing
  if (u.checks[d] !== undefined) return u.streak;
  // mark the day's check
  u.checks[d] = !!success;

  if (success) {
    const lastSuccess = u.lastCheck ? (new Date(u.lastCheck)).toISOString().slice(0,10) : null;
    if (lastSuccess) {
      const lastDate = new Date(lastSuccess);
      const curDate = new Date(d);
      const diff = Math.round((curDate - lastDate) / (1000 * 60 * 60 * 24));
      if (diff === 1) u.streak = (u.streak || 0) + 1;
      else if (diff === 0) { /* same day nothing */ }
      else u.streak = 1;
    } else {
      u.streak = 1;
    }
    // no extra scheduled-day bonus — only one increment per success
    u.lastCheck = d;
  } else {
    if (isScheduled) {
      u.streak = 0;
      u.lastCheck = d;
    } else {
      // record a missed non-scheduled day — do not change streak except to update lastCheck
      u.lastCheck = d;
    }
  }

  await db.run('UPDATE users SET checks = ?, streak = ?, lastCheck = ? WHERE userId = ?', JSON.stringify(u.checks), u.streak, u.lastCheck, userId);
  return u.streak;
}

async function resetWeekly() {
  const db = await ensureDb();
  await db.run('UPDATE users SET checks = ? ', JSON.stringify({}));
}

async function checkMissedForDate(date) {
  const db = await ensureDb();
  const d = (date instanceof Date) ? date.toISOString().slice(0,10) : (new Date(date)).toISOString().slice(0,10);
  const day = (new Date(d)).getDay();
  const letter = weekDayLetter(day);
  const rows = await db.all('SELECT userId, schedule, checks FROM users');
  for (const r of rows) {
    const sched = JSON.parse(r.schedule || '[]');
    if (!sched.includes(letter)) continue;
    const checks = JSON.parse(r.checks || '{}');
    if (checks[d]) continue;
    // missed scheduled day -> reset streak and set lastCheck
    await db.run('UPDATE users SET streak = 0, lastCheck = ? WHERE userId = ?', d, r.userId);
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
  const db = await ensureDb();
  await db.run('INSERT OR IGNORE INTO users (userId, schedule, streak, lastCheck, checks) VALUES (?, ?, ?, ?, ?) ', userId, JSON.stringify([]), 0, null, JSON.stringify({}));
  await db.run('UPDATE users SET streak = ? WHERE userId = ?', streak, userId);
}

module.exports = { registerUser, getUser, recordCheck, scheduleDaily, finalizeRegistrationFromMessage, getPendingByMessage, sendCheckinNow, getAllUsers, setStreak };
