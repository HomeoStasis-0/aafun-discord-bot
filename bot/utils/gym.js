const fs = require('fs');
const path = require('path');
const { GYM_CHANNEL_ID, GYM_ROLE_ID } = require('../../config');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// file should live at the project root (two levels up from bot/utils)
const FILE = path.resolve(__dirname, '../../gym_db.json');
// older incorrect location (three levels up) may exist; migrate it if found
const OLD_FILE = path.resolve(__dirname, '../../../gym_db.json');

function load() {
  // migrate old file if present
  try {
    if (fs.existsSync(OLD_FILE) && !fs.existsSync(FILE)) {
      console.log('[gym] migrating old DB from', OLD_FILE, 'to', FILE);
      fs.renameSync(OLD_FILE, FILE);
    }
  } catch (e) { console.error('[gym] migrate error', e.message); }

  if (!fs.existsSync(FILE)) {
    // create initial db
    const init = { users: {}, pending: {} };
    fs.writeFileSync(FILE, JSON.stringify(init, null, 2));
    return init;
  }
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8') || '{}'); } catch (e) { return { users: {}, pending: {} }; }
}

function save(db) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
    console.log('[gym] saved DB to', FILE);
  } catch (e) {
    console.error('[gym] save error', e.message);
  }
}

function weekDayLetter(n) {
  // Sunday=0 -> SU, Monday=1 -> M, ...
  const letters = ['SU','M','T','W','TH','F','SA'];
  return letters[n];
}

// If days is provided (array), register immediately. If messageId provided, add to pending map.
async function registerUser(userId, days, messageId) {
  const db = load();
  if (!db.users) db.users = {};
  if (Array.isArray(days) && days.length) {
    db.users[userId] = db.users[userId] || { schedule: [], streak: 0, lastCheck: null, checks: {} };
    db.users[userId].schedule = days; // store letters like M,T,W
    db.users[userId].checks = db.users[userId].checks || {};
    db.users[userId].streak = db.users[userId].streak || 0;
    save(db);
    return;
  }
  // else create pending registration entry tied to messageId
  if (!db.pending) db.pending = {};
  if (messageId) {
    // ensure only one pending entry exists per user
    let existingMid = null;
    for (const [mid, pending] of Object.entries(db.pending || {})) {
      if (pending && pending.userId === userId) {
        existingMid = mid;
        break;
      }
    }
    if (existingMid) {
      if (existingMid === messageId) {
        // same pending already recorded; nothing to do
      } else {
        // replace old pending with the new message id
        delete db.pending[existingMid];
        db.pending[messageId] = { userId, createdAt: new Date().toISOString() };
      }
    } else {
      db.pending[messageId] = { userId, createdAt: new Date().toISOString() };
    }
  }
  save(db);
}

async function finalizeRegistrationFromMessage(messageId, userId, selectedLetters) {
  const db = load();
  if (!db.pending || !db.pending[messageId]) return null;
  const pending = db.pending[messageId];
  // Only allow the user who initiated the pending to finalize
  if (pending.userId !== userId) return null;
  // write schedule
  db.users = db.users || {};
  db.users[userId] = db.users[userId] || { schedule: [], streak: 0, lastCheck: null, checks: {} };
  db.users[userId].schedule = selectedLetters;
  db.users[userId].checks = db.users[userId].checks || {};
  db.users[userId].streak = db.users[userId].streak || 0;
  delete db.pending[messageId];
  save(db);
  return db.users[userId];
}

function getPendingByMessage(messageId) {
  const db = load();
  if (!db.pending) return null;
  return db.pending[messageId] || null;
}

async function getUser(userId) { const db = load(); return db.users && db.users[userId] ? db.users[userId] : null; }

async function recordCheck(userId, dateStr, success) {
  const db = load();
  if (!db.users || !db.users[userId]) return null;
  const u = db.users[userId];
  u.checks = u.checks || {};
  const d = (new Date(dateStr)).toISOString().slice(0,10); // YYYY-MM-DD
  // determine weekday letter
  const day = new Date(dateStr).getDay();
  const letter = weekDayLetter(day);
  // count checks on scheduled days; if not scheduled, still record and
  // increment streak for a 'yes' using the same consecutive-day logic
  // as scheduled days (but without the scheduled-day bonus).
  const isScheduled = Array.isArray(u.schedule) && u.schedule.includes(letter);
  if (!isScheduled) {
    u.checks[d] = !!success;
    if (success) {
      // determine if we should increment streak (consecutive days rules)
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
      u.lastCheck = d;
    }
    save(db);
    return u.streak || 0;
  }

  // mark the day's check
  u.checks[d] = !!success;

  // If success, determine if we should increment streak
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
    // scheduled-day bonus: add an extra point when they check in on a scheduled day
    u.streak = (u.streak || 0) + 1;
    u.lastCheck = d;
  } else {
    // missed on a scheduled day -> reset streak
    u.streak = 0;
    u.lastCheck = d;
  }
  save(db);
  return u.streak;
}

async function resetWeekly() {
  const db = load();
  if (!db.users) return;
  for (const userId of Object.keys(db.users)) {
    db.users[userId].checks = {};
  }
  save(db);
}

// Called on each daily run to check for users who missed their scheduled day (date is Date object or ISO string)
async function checkMissedForDate(date) {
  const db = load();
  if (!db.users) return;
  const d = (date instanceof Date) ? date.toISOString().slice(0,10) : (new Date(date)).toISOString().slice(0,10);
  const day = (new Date(d)).getDay();
  const letter = weekDayLetter(day);
  for (const userId of Object.keys(db.users)) {
    const u = db.users[userId];
    if (!u.schedule || !u.schedule.includes(letter)) continue;
    u.checks = u.checks || {};
    if (u.checks[d]) continue; // they recorded something
    // missed scheduled day -> reset streak
    u.streak = 0;
    u.lastCheck = d;
  }
  save(db);
}

function scheduleDaily(client) {
  // Schedule a daily post at 08:00 Central Time (America/Chicago).
  function ctNow() {
    // convert current time to America/Chicago
    const s = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
    return new Date(s);
  }

  async function runForDate(dateCT) {
    try {
      const channel = await client.channels.fetch(GYM_CHANNEL_ID).catch(() => null);
      if (!channel) return;
      // mark missed for yesterday (CT)
      const yesterday = new Date(dateCT);
      yesterday.setDate(yesterday.getDate() - 1);
      await checkMissedForDate(yesterday);
      const day = dateCT.getDay(); // CT weekday
      // if it's Monday (1) in CT, reset weekly visual checks
      if (day === 1) {
        await resetWeekly();
      }
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
    // compute next 08:00 CT occurrence
    const nowCT = ctNow();
    const next = new Date(nowCT);
    next.setHours(8, 0, 0, 0); // 08:00:00
    if (nowCT >= next) {
      next.setDate(next.getDate() + 1);
    }
    const delay = next - nowCT;
    setTimeout(async () => {
      const dateCT = ctNow();
      await runForDate(dateCT);
      // schedule subsequent runs every 24h using scheduleNext
      scheduleNext();
    }, delay);
  }

  // start scheduler
  scheduleNext();
}

// send checkin now (manual trigger)
async function sendCheckinNow(client) {
  const nowCTStr = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const dateCT = new Date(nowCTStr);
  try {
    const channel = await client.channels.fetch(GYM_CHANNEL_ID).catch(() => null);
    if (!channel) throw new Error('No channel');
    // mark missed for yesterday (CT)
    const yesterday = new Date(dateCT);
    yesterday.setDate(yesterday.getDate() - 1);
    await checkMissedForDate(yesterday);
    const day = dateCT.getDay(); // CT weekday
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

async function getAllUsers() {
  const db = load();
  return db.users || {};
}

module.exports = { registerUser, getUser, recordCheck, scheduleDaily, finalizeRegistrationFromMessage, getPendingByMessage, sendCheckinNow, getAllUsers };
