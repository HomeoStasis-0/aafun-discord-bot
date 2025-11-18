const { Pool } = require('pg');
const { BIRTHDAY_CHANNEL_ID } = require('../../config'); // fixed path
const { EmbedBuilder } = require('discord.js');

// PostgreSQL pool setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Interval in ms: 1 minute (for testing)
const INTERVAL_MS = 6 * 60 * 60 * 1000;

// In-memory dedupe for this process so we don't spam the same user multiple times
const sentToday = new Set();


function formatMMDDFromDateObj(d) {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCentralTimeDate() {
  // Get current time in America/Chicago (Central Time)
  const now = new Date();
  // Convert to Central Time using toLocaleString
  const central = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  return central;
}

function parseDateToMMDD(raw) {
  if (!raw) return null;
  const s = raw.trim();
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[2]}-${m[3]}`;
  // MM-DD or MM/DD
  m = s.match(/^(\d{1,2})[-\/(\\)](\d{1,2})$/);
  if (m) return `${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
  // try JS Date parse (fallback)
  const dd = new Date(s);
  if (!isNaN(dd.getTime())) return formatMMDDFromDateObj(dd);
  return null;
}

async function sendBirthday(client, userId) {
  try {
    const channelId = BIRTHDAY_CHANNEL_ID;
    if (!channelId) {
      console.warn('[birthdays] No BIRTHDAY_CHANNEL_ID configured, skipping send');
      return false;
    }
    const channel = await client.channels.fetch(channelId).catch(e => null);
    if (!channel) {
      console.warn('[birthdays] Could not fetch birthday channel', channelId);
      return false;
    }

    const embed = new EmbedBuilder()
      .setTitle('🎉 Happy Birthday!')
      .setDescription(`Happy Birthday <@${userId}>!`) 
      .setColor(0xffd700)
      .setImage('https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXBueGU3cnN1ZWUzeWpwYm5mb3kwaTYxdnplc3I1ajd1OTR6eGZiYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Ca0pp3NF1B1jbp0a1A/giphy.gif');

    await channel.send({ content: `<@${userId}>`, embeds: [embed] });
    console.log(`[birthdays] Sent birthday message for ${userId} to channel ${channelId}`);
    return true;
  } catch (err) {
    console.error('Birthday send error:', err && err.message ? err.message : err);
    return false;
  }
}


async function getBirthdaysFromDB() {
  try {
    const res = await pool.query('SELECT name AS userId, birthday FROM birthdays');
    return res.rows.map(row => `${row.userId}:${row.birthday.toISOString().slice(0, 10)}`);
  } catch (err) {
    console.error('[birthdays] Error fetching from DB:', err.message || err);
    return [];
  }
}


function resetSentIfNewDay() {
  // Clear sentToday at midnight Central Time to avoid duplicates across days for this process
  const now = getCentralTimeDate();
  const key = `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}`;
  if (module._lastSentDay !== key) {
    module._lastSentDay = key;
    sentToday.clear();
  }
}

function scheduleBirthdayChecks(client) {
  const run = async () => {
    resetSentIfNewDay();
    const today = formatMMDDFromDateObj(getCentralTimeDate());
    const lines = await getBirthdaysFromDB();
    if (!lines.length) return;
    for (const line of lines) {
      // allow lines like: userId:YYYY-MM-DD or userId:MM-DD or userId:MM/DD
      const parts = line.split(':').map(p => p.trim()).filter(Boolean);
      if (parts.length < 2) continue;
      const userId = parts[0];
      const dateRaw = parts[1];
      const mmdd = parseDateToMMDD(dateRaw);
      if (!mmdd) continue;
      if (mmdd === today) {
        if (sentToday.has(userId)) continue;
        const ok = await sendBirthday(client, userId);
        if (ok) sentToday.add(userId);
      }
    }
  };
  // run immediately then every INTERVAL_MS
  run().catch(err => console.error('[birthdays] initial run error:', err));
  setInterval(() => run().catch(err => console.error('[birthdays] scheduled run error:', err)), INTERVAL_MS);
}

module.exports = { scheduleBirthdayChecks };
