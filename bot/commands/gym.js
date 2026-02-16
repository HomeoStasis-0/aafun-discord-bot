const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');
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
    let deferred = false;
    try { await interaction.deferReply({ ephemeral: true }); deferred = true; } catch (_) { deferred = false; }
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
    if (!msg) {
      try { if (deferred) return interaction.editReply({ content: 'Unable to create registration message.' }); } catch (_) {}
      return interaction.reply({ content: 'Unable to create registration message.', ephemeral: true });
    }
    await gym.registerUser(userId, null, msg.id);
    try { if (deferred) return interaction.editReply({ content: `Registration message posted: ${msg.url}` }); } catch (_) {}
    return interaction.reply({ content: `Registration message posted: ${msg.url}`, ephemeral: true });
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
    const target = interaction.options.getUser('user');
    const value = interaction.options.getInteger('streak');
    if (typeof value !== 'number') return interaction.reply({ content: 'Usage: /gym set_streak [user:@User] streak:<number>', ephemeral: true });
    // allow users to set their own streak; only allow setting others if caller has ManageGuild
    const targetId = target ? target.id : userId;
    if (target && target.id !== userId && !caller.permissions.has('ManageGuild')) {
      return interaction.reply({ content: 'You do not have permission to set other users\' streaks.', ephemeral: true });
    }
    if (value < 0) return interaction.reply({ content: 'Streak must be >= 0.', ephemeral: true });
    try {
      await gym.setStreak(targetId, value);
      if (targetId === userId) return interaction.reply({ content: `Your streak has been set to ${value}`, ephemeral: true });
      return interaction.reply({ content: `Set streak for <@${targetId}> to ${value}`, ephemeral: true });
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
  
  if (sub === 'live') {
    // Avoid "Unknown interaction" by acknowledging quickly before network calls.
    try { if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: false }); } catch (_) {}

    const facilityArg = interaction.options.getString('facility');
    // fetch facilities from API (fallback to static list if unavailable)
    let facilities = await gym.fetchFacilities().catch(() => []);
    if (!facilities || !facilities.length) {
      facilities = [
        { id: 'student-rec-center', name: 'Student Rec Center' },
        { id: 'penberthy-rec-tennis', name: 'Penberthy Rec Sports Complex-Tennis' },
        { id: 'peap', name: 'PEAP' },
        { id: 'southside-rec-center', name: 'Southside Rec Center' },
        { id: 'outdoor-adventures', name: 'Outdoor Adventures' },
        { id: 'aquatics', name: 'Aquatics' },
        { id: 'polo-road-rec-center', name: 'Polo Road Rec Center' }
      ];
    }

    // If a facility argument was provided, try to match and show live immediately
    if (facilityArg) {
      const lower = facilityArg.toLowerCase();
      const match = facilities.find(f => String(f.id).toLowerCase() === lower || String(f.name||'').toLowerCase() === lower || String(f.name||'').toLowerCase().includes(lower));
      const facilityIdToUse = match ? match.id : facilityArg;
      try {
        await interaction.deferReply({ ephemeral: false }).catch(() => {});
        const live = await gym.getFacilityLive(facilityIdToUse);
        if (!live || (live.count === null && !live.raw)) return interaction.editReply({ content: 'Unable to fetch live data for that facility. Check `GYM_API_URL`/`GYM_API_KEY`.' });
        const title = match ? match.name : facilityIdToUse;
        const description = `Live count: **${live.count !== null ? live.count : 'N/A'}**\nUpdated: ${live.updated || 'unknown'}`;
        const embed = new EmbedBuilder().setTitle(`Live — ${title}`).setDescription(description);
        const refreshBtn = new ButtonBuilder().setCustomId(`gym_refresh__${encodeURIComponent(title)}`).setLabel('Refresh').setStyle(ButtonStyle.Secondary);
        const rowRefresh = new ActionRowBuilder().addComponents(refreshBtn);
        return interaction.editReply({ embeds: [embed], components: [rowRefresh] });
      } catch (err) {
        console.error('gym live error', err);
        try { return interaction.editReply({ content: 'Failed to fetch facility live data.' }); } catch (_) { return interaction.reply({ content: 'Failed to fetch facility live data.', ephemeral: false }); }
      }
    }

    // No arg: present a paginated select menu (25 options/page)
    try {
      const pageSize = 25;
      let page = 0;
      const pages = Math.max(1, Math.ceil(facilities.length / pageSize));

      const makeComponents = (p) => {
        const start = p * pageSize;
        const slice = facilities.slice(start, start + pageSize);
        const options = slice.map(f => ({ label: f.name || f.id, value: f.id }));
        const menu = new StringSelectMenuBuilder()
          .setCustomId('gym_select_facility')
          .setPlaceholder(`Page ${p+1}/${pages} — Select a facility`)
          .addOptions(options)
          .setMinValues(1)
          .setMaxValues(1);
        const rows = [new ActionRowBuilder().addComponents(menu)];
        if (pages > 1) {
          const prev = new ButtonBuilder().setCustomId('gym_page_prev').setLabel('Prev').setStyle(ButtonStyle.Primary).setDisabled(p === 0);
          const next = new ButtonBuilder().setCustomId('gym_page_next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(p === pages - 1);
          rows.push(new ActionRowBuilder().addComponents(prev, next));
        }
        return rows;
      };

      await interaction.editReply({ content: 'Select a facility to view live counts:', components: makeComponents(page) });
      const replyMsg = await interaction.fetchReply();

      while (true) {
        let comp;
        try {
          comp = await replyMsg.awaitMessageComponent({ filter: i => i.user.id === interaction.user.id, time: 30000 });
        } catch (e) {
          // timeout
          try { await interaction.editReply({ content: 'No selection received (timed out).', components: [] }); } catch (_) {}
          break;
        }

        // handle page buttons
        if (comp.customId === 'gym_page_prev') {
          await comp.deferUpdate();
          page = Math.max(0, page - 1);
          await interaction.editReply({ components: makeComponents(page) });
          continue;
        }
        if (comp.customId === 'gym_page_next') {
          await comp.deferUpdate();
          page = Math.min(pages - 1, page + 1);
          await interaction.editReply({ components: makeComponents(page) });
          continue;
        }

        // selection made
        if (comp.customId === 'gym_select_facility') {
          const selected = comp.values && comp.values[0];
          await comp.deferUpdate();
          const live = await gym.getFacilityLive(selected);
          if (!live || (live.count === null && !live.raw)) {
            await interaction.editReply({ content: 'Unable to fetch live data for that facility. Check `GYM_API_URL`/`GYM_API_KEY`.', components: [] });
            break;
          }
          const found = facilities.find(f => f.id === selected);
          const title = found ? found.name : selected;
          const description = `Live count: **${live.count !== null ? live.count : 'N/A'}**\nUpdated: ${live.updated || 'unknown'}`;
          const embed = new EmbedBuilder().setTitle(`Live — ${title}`).setDescription(description);
          const refreshBtn = new ButtonBuilder().setCustomId(`gym_refresh__${encodeURIComponent(title)}`).setLabel('Refresh').setStyle(ButtonStyle.Secondary);
          const rowRefresh = new ActionRowBuilder().addComponents(refreshBtn);
          await interaction.editReply({ embeds: [embed], components: [rowRefresh] });
          break;
        }
      }
    } catch (err) {
      console.error('gym live select error', err);
      try {
        if (interaction.deferred || interaction.replied) return interaction.editReply({ content: 'Failed to create facility selector.', components: [] });
        return interaction.reply({ content: 'Failed to create facility selector.', ephemeral: false });
      } catch (_) {
        return;
      }
    }
  }
};
