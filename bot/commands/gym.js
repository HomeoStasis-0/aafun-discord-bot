const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const gym = require('../utils/gym');

function parseDays(input) {
  if (!input || typeof input !== 'string') return [];
  const map = {
    mon: 'M', tue: 'T', wed: 'W', thu: 'TH', fri: 'F', sat: 'SA', sun: 'SU',
    m: 'M', t: 'T', w: 'W', th: 'TH', f: 'F', sa: 'SA', su: 'SU'
  };
  return input.split(',')
    .map(s => s.trim().toLowerCase())
    .map(s => {
      if (!s) return null;
      const key3 = s.slice(0,3);
      return map[key3] || map[s] || null;
    })
    .filter(Boolean);
}

module.exports = async function gymCommand(interaction, client) {
  let sub;
  try { sub = interaction.options.getSubcommand(); } catch (e) { sub = null; }
  const userId = interaction.user.id;

  if (sub === 'register') {
    try { await interaction.deferReply({ ephemeral: true }); } catch (_) {}
    const channel = interaction.channel;
    const mapping = [ ['SU','🟥'], ['M','🟩'], ['T','🟦'], ['W','🟨'], ['TH','🟪'], ['F','🟫'], ['SA','⬜'] ];
    const buttons = mapping.map(([day, emoji]) =>
      new ButtonBuilder()
        .setCustomId(`gym_day_${day}`)
        .setLabel(`${emoji} ${day}`)
        .setStyle(ButtonStyle.Secondary)
    );
    const doneButton = new ButtonBuilder()
      .setCustomId('gym_done')
      .setLabel('Done')
      .setStyle(ButtonStyle.Success);
    const row1 = new ActionRowBuilder().addComponents(buttons.slice(0,4));
    const row2 = new ActionRowBuilder().addComponents(buttons.slice(4).concat([doneButton]));
    const embed = new EmbedBuilder()
      .setTitle('Gym Registration')
      .setDescription('Click the buttons below to select the days you plan to go to the gym. When finished, click "Done".');
    const msg = await channel.send({ content: `<@${userId}>`, embeds: [embed], components: [row1, row2] }).catch(() => null);
    if (!msg) return interaction.editReply({ content: 'Unable to create registration message.' });
    await gym.registerUser(userId, null, msg.id);
    return interaction.editReply({ content: `Registration message posted: ${msg.url}` });
  }

  if (sub === 'status') {
    const data = await gym.getUser(userId);
    if (!data) return interaction.reply({ content: 'You are not registered. Use /gym register', ephemeral: true });
    const todayKey = (new Date()).toISOString().slice(0,10);
    const emoji = { yes: '🟩', no: '🟥', none: '⚪' };
    const mapLetter = l => {
      // look up check for today if same letter, otherwise show scheduled marker
      const check = (data.checks || {})[todayKey];
      // if today matches letter, show check status
      if (data.schedule.includes(l)) {
        // find if any check exists for day matching letter in recent week
        // For simplicity show current day's status only when letter === today's letter
        const todayLetter = (['SU','M','T','W','TH','F','SA'])[(new Date()).getDay()];
        if (l === todayLetter) {
          if (check === true) return `${emoji.yes} ${l}`;
          if (check === false) return `${emoji.no} ${l}`;
          return `${emoji.none} ${l}`;
        }
        return `⚪ ${l}`;
      }
      return `${l}`;
    };

    const sched = (data.schedule || []).map(mapLetter).join(' ');
    const embed = new EmbedBuilder()
      .setTitle('Gym Status')
      .setDescription(`Streak: **${data.streak || 0}**`)
      .addFields({ name: 'Schedule', value: sched || 'None' });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'dump') {
    // optional user argument
    const target = interaction.options.getUser('user');
    const caller = interaction.member;
    let userIdToDump = userId;
    if (target) {
      // check permission
      if (!caller.permissions.has('ManageGuild')) return interaction.reply({ content: 'You do not have permission to dump other users.', ephemeral: true });
      userIdToDump = target.id;
    }
    const data = await gym.getUser(userIdToDump);
    if (!data) return interaction.reply({ content: 'No data for that user.', ephemeral: true });
    return interaction.reply({ content: '```json\n' + JSON.stringify(data, null, 2) + '\n```', ephemeral: true });
  }

  if (sub === 'send') {
    const caller = interaction.member;
    if (!caller.permissions.has('ManageGuild')) return interaction.reply({ content: 'You do not have permission to send the check-in message.', ephemeral: true });
    try {
      await gym.sendCheckinNow(client);
      return interaction.reply({ content: 'Check-in message sent.', ephemeral: true });
    } catch (err) {
      console.error('sendCheckinNow error', err);
      return interaction.reply({ content: 'Failed to send check-in message.', ephemeral: true });
    }
  }

  if (sub === 'send_streak') {
    const caller = interaction.member;
    if (!caller.permissions.has('ManageGuild')) return interaction.reply({ content: 'You do not have permission to send streaks.', ephemeral: true });
    try {
      const all = await gym.getAllUsers();
      const entries = Object.entries(all || {});
      if (!entries.length) return interaction.reply({ content: 'No registered users to report.', ephemeral: true });
      // Build lines with mention and streak
      const lines = entries.map(([uid, data]) => {
        const s = data && data.streak ? data.streak : 0;
        return `<@${uid}> — ${s}`;
      });
      const embed = new EmbedBuilder().setTitle('Gym Streaks').setDescription(lines.join('\n'));
      await interaction.reply({ embeds: [embed], ephemeral: false });
    } catch (err) {
      console.error('send_streak error', err);
      return interaction.reply({ content: 'Failed to send streaks.', ephemeral: true });
    }
  }

  if (sub === 'set_streak') {
    // Admin command to set a user's streak manually
    const caller = interaction.member;
    if (!caller.permissions.has('ManageGuild')) return interaction.reply({ content: 'You do not have permission to set streaks.', ephemeral: true });
    const target = interaction.options.getUser('user');
    const value = interaction.options.getInteger('streak');
    if (!target || typeof value !== 'number') return interaction.reply({ content: 'Usage: /gym set_streak user:@User streak:<number>', ephemeral: true });
    try {
      await gym.setStreak(target.id, value);
      return interaction.reply({ content: `Set streak for <@${target.id}> to ${value}`, ephemeral: true });
    } catch (err) {
      console.error('set_streak error', err);
      return interaction.reply({ content: 'Failed to set streak.', ephemeral: true });
    }
  }

  if (sub === 'schedule') {
    // build map of letters to array of user mentions
    const all = await gym.getAllUsers();
    const days = { 'SU': [], 'M': [], 'T': [], 'W': [], 'TH': [], 'F': [], 'SA': [] };
    for (const [uid, data] of Object.entries(all)) {
      const name = `<@${uid}>`;
      const sched = data && data.schedule ? data.schedule : [];
      for (const s of sched) {
        if (days[s]) days[s].push(name);
      }
    }

    const order = ['SU','M','T','W','TH','F','SA'];
    const lines = order.map(l => `${l}: ${days[l].length ? days[l].join(' ') : '_None_'} `);
    const embed = new EmbedBuilder().setTitle('Gym Schedule').setDescription(lines.join('\n'));
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
