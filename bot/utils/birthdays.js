const fs = require('fs');
const { BIRTHDAY_CHANNEL_ID } = require('../../config'); // fixed path

const FILE = './birthdays.txt';

function todayMMDD() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function sendBirthdayGif(client, userId) {
  try {
    const channel = await client.channels.fetch(BIRTHDAY_CHANNEL_ID);
    if (!channel) return;
    await channel.send({
      content: `<@${userId}> 🎉 Happy Birthday!`,
      embeds: [
        { image: { url: 'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExMXBueGU3cnN1ZWUzeWpwYm5mb3kwaTYxdnplc3I1ajd1OTR6eGZiYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Ca0pp3NF1B1jbp0a1A/giphy.gif' } }
      ]
    });
  } catch (err) {
    console.error('Birthday send error:', err.message);
  }
}

function scheduleBirthdayChecks(client) {
  const run = async () => {
    if (!fs.existsSync(FILE)) return;
    const today = todayMMDD();
    const lines = fs.readFileSync(FILE, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const [userId, date] = line.split(':');
      if (!date) continue;
      const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) continue;
      const [, , mm, dd] = m;
      if (`${mm}-${dd}` === today) await sendBirthdayGif(client, userId);
    }
  };
  run();
  setInterval(run, 12 * 60 * 60 * 1000);
}

module.exports = { scheduleBirthdayChecks };
