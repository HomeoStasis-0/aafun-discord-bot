const spotifyCommand = require('./commands/spotify');
const chatCommand = require('./commands/chat');
const gifsCommand = require('./commands/gifs');
const restartCommand = require('./commands/restart');
const clearCommand = require('./commands/clear');
const summarizeCommand = require('./commands/summarize');
const gymCommand = require('./commands/gym');
const handleMessages = require('./utils/messages');
const gymUtil = require('./utils/gym');
const { scheduleBirthdayChecks } = require('./utils/birthdays');

function registerEvents(client) {
  if (client.__aafunEventsRegistered) {
    console.log('[events] Skipping duplicate registration');
    return;
  }
  client.__aafunEventsRegistered = true;
  const instanceId = `${process.pid}:${Date.now()}`;
  client.__aafunInstanceId = instanceId;
  console.log(`[events] Registering events (instance ${instanceId})`);

  // Handle client ready. Newer discord.js versions emit 'clientReady'.
  // Bind the same handler to both events for backwards compatibility
  // and guard to ensure it only runs once.
  let _readyHandled = false;
  const onClientReady = async () => {
    if (_readyHandled) return;
    _readyHandled = true;
    try {
      console.log(`✅ Logged in as ${client.user?.tag || '<unknown>'} (pid=${process.pid}, inst=${instanceId})`);
      console.log('[events] messageCreate listeners:', client.listenerCount('messageCreate'));
      // start birthday checks (only if DATABASE_URL present)
      if (process.env.DATABASE_URL) {
        try { scheduleBirthdayChecks(client); } catch (err) { console.error('[birthdays] schedule error:', err); }
      } else {
        console.warn('[birthdays] DATABASE_URL not set — skipping birthday scheduler');
      }
      // start gym daily posts
      try { gymUtil.scheduleDaily(client); } catch (err) { console.error('[gym] scheduleDaily error:', err); }
    } catch (err) {
      console.error('[events] ready handler error:', err);
    }
  };

  client.once('clientReady', onClientReady);

  client.on('interactionCreate', async interaction => {
    try {
      if (interaction.isChatInputCommand()) {
        const map = {
          spotify: spotifyCommand,
          chat: chatCommand,
          randomgif: gifsCommand,
          restart: restartCommand,
          clear: clearCommand,
          summarize: summarizeCommand, // new
          gym: gymCommand
        };
        const fn = map[interaction.commandName];
        if (!fn) return;
        await fn(interaction, client);
        return;
      }

      if (interaction.isButton()) {
        const id = interaction.customId || '';
        if (!id.startsWith('gym_')) return;
        const parts = id.split('_');
        const type = parts[1];
        const value = parts[2];
        const userId = interaction.user.id;

        // Handle gym registration day selection
        if (type === 'day') {
          // Add/remove the selected day for the user in a pending registration
          const pending = await gymUtil.getPendingByUser(userId);
          if (!pending) {
            try { if (!interaction.replied) await interaction.reply({ content: 'No pending registration found. Please use /gym register.', ephemeral: true }); } catch (_) {}
            return;
          }
          // ensure only the original user may select
          if (pending.userId !== userId) {
            try { if (!interaction.replied) await interaction.reply({ content: 'Only the registering user can select days.', ephemeral: true }); } catch (_) {}
            return;
          }
          let selected = pending.selected || [];
          if (selected.includes(value)) selected = selected.filter(d => d !== value);
          else selected.push(value);
          // persist selection in memory (or DB later)
          await gymUtil.updatePendingSelection(userId, selected);

          // reflect selection by editing the original message instead of sending a new reply
          try {
            await interaction.deferUpdate();
          } catch (_) {}
          // build updated components with selected styling
          const mapping = [ ['SU','🟥'], ['M','🟩'], ['T','🟦'], ['W','🟨'], ['TH','🟪'], ['F','🟫'], ['SA','⬜'] ];
          const dayButtons = mapping.map(([d, emoji]) => {
            const isSel = selected.includes(d);
            return new (require('discord.js').ButtonBuilder)()
              .setCustomId(`gym_day_${d}`)
              .setLabel(`${emoji} ${d}`)
              .setStyle(isSel ? require('discord.js').ButtonStyle.Primary : require('discord.js').ButtonStyle.Secondary);
          });
          const doneBtn = new (require('discord.js').ButtonBuilder)().setCustomId('gym_done').setLabel('Done').setStyle(require('discord.js').ButtonStyle.Success);
          const row1 = new (require('discord.js').ActionRowBuilder)().addComponents(dayButtons.slice(0,4));
          const row2 = new (require('discord.js').ActionRowBuilder)().addComponents(dayButtons.slice(4).concat([doneBtn]));
          const embed = interaction.message.embeds && interaction.message.embeds[0] ? interaction.message.embeds[0] : new (require('discord.js').EmbedBuilder)().setTitle('Gym Registration');
          embed.setDescription(`Selected days: ${selected.join(' ') || '_None_'}`);
          try {
            await interaction.message.edit({ embeds: [embed], components: [row1, row2] });
          } catch (err) {
            console.error('Failed to update registration message:', err.message || err);
          }
          return;
        }

        // Handle gym registration finalization
        if (type === 'done') {
          const pending = await gymUtil.getPendingByUser(userId);
          if (!pending || !pending.selected || !pending.selected.length) {
            try { if (!interaction.replied) await interaction.reply({ content: 'Please select at least one day before finishing registration.', ephemeral: true }); } catch (_) {}
            return;
          }
          // ensure only owner can finalize
          if (pending.userId !== userId) {
            try { if (!interaction.replied) await interaction.reply({ content: 'Only the registering user can finalize.', ephemeral: true }); } catch (_) {}
            return;
          }
          const result = await gymUtil.finalizeRegistrationFromMessage(pending.messageId, userId, pending.selected);
          if (result) {
            // update the original message to show saved and remove buttons
            try {
              await interaction.update({ content: `<@${userId}> Registration saved: ${result.schedule.join(' ')}`, embeds: [], components: [] });
            } catch (err) {
              try { if (!interaction.replied) await interaction.reply({ content: `Registration saved: ${result.schedule.join(' ')}`, ephemeral: true }); } catch (_) {}
            }
          } else {
            try { if (!interaction.replied) await interaction.reply({ content: 'Failed to save registration.', ephemeral: true }); } catch (_) {}
          }
          return;
        }

        // check-in and streak logic (yes/no flows and confirmations)
        if (type === 'yes') {
          // prevent duplicate same-day recording before showing confirmation
          try {
            const d = new Date().toISOString().slice(0,10);
            const u = await gymUtil.getUser(userId);
            if (u && u.checks && u.checks[d] !== undefined) {
              try { if (!interaction.replied) await interaction.reply({ content: 'You have already recorded a response for today.', ephemeral: true }); } catch (_) {}
              return;
            }
          } catch (_) {}
          // ask for confirmation before recording a positive check-in
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`gym_confirmyes_${value}_${Date.now()}`).setLabel('Yes, confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`gym_cancelyes_${value}_${Date.now()}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
          );
          await interaction.reply({ content: 'Are you sure you want to mark this as done?', components: [row], ephemeral: true });
          return;
        }

        if (type === 'no') {
          // prevent duplicate same-day recording before showing confirmation
          try {
            const d = new Date().toISOString().slice(0,10);
            const u = await gymUtil.getUser(userId);
            if (u && u.checks && u.checks[d] !== undefined) {
              try { if (!interaction.replied) await interaction.reply({ content: 'You have already recorded a response for today.', ephemeral: true }); } catch (_) {}
              return;
            }
          } catch (_) {}
          // show confirmation buttons
          const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`gym_confirmno_${value}_${Date.now()}`).setLabel('Yes, confirm').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`gym_cancelno_${value}_${Date.now()}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
          );
          await interaction.reply({ content: 'Are you sure you want to mark this as missed?', components: [row], ephemeral: true });
          return;
        }

        if (type === 'confirmno') {
          // prevent duplicate same-day recording
          const u = await gymUtil.getUser(userId);
          const d = new Date().toISOString().slice(0,10);
          if (!u) {
            try { if (!interaction.replied) await interaction.reply({ content: 'No schedule found for you — register first.', ephemeral: true }); } catch (_) {}
            return;
          }
          if (u.checks && u.checks[d] !== undefined) {
            try { if (!interaction.replied) await interaction.reply({ content: 'You have already recorded a response for today.', ephemeral: true }); } catch (_) {}
            return;
          }
          // record first
          const streak = await gymUtil.recordCheck(userId, new Date().toISOString(), false);
          const finalMsg = `Marked as missed. Streak reset to ${streak}`;
          // try update -> reply
          try {
            await interaction.update({ content: finalMsg, components: [] });
            return;
          } catch (e) {
            try { if (!interaction.replied) await interaction.reply({ content: finalMsg, ephemeral: true }); } catch (_) {}
            return;
          }
        }

        if (type === 'confirmyes') {
          // prevent duplicate same-day recording for yes
          const u = await gymUtil.getUser(userId);
          const d = new Date().toISOString().slice(0,10);
          if (!u) {
            try { if (!interaction.replied) await interaction.reply({ content: 'No schedule found for you — register first.', ephemeral: true }); } catch (_) {}
            return;
          }
          if (u.checks && u.checks[d] !== undefined) {
            try { if (!interaction.replied) await interaction.reply({ content: 'You have already recorded a response for today.', ephemeral: true }); } catch (_) {}
            return;
          }
          // record first
          const streak = await gymUtil.recordCheck(userId, new Date().toISOString(), true);
          const finalMsg = `Checked in. Streak is now ${streak}`;
          try {
            await interaction.update({ content: finalMsg, components: [] });
            return;
          } catch (e) {
            try { if (!interaction.replied) await interaction.reply({ content: finalMsg, ephemeral: true }); } catch (_) {}
            return;
          }
        }

        if (type === 'cancelyes') {
          // remove the ephemeral confirmation message from the user's screen
          try {
            // acknowledge the interaction then delete the previous reply
            await interaction.deferUpdate();
            await interaction.deleteReply();
          } catch (err) {
            // fallback: send a short ephemeral acknowledgement
            try { await interaction.reply({ content: 'Cancel received — no change.', ephemeral: true }); } catch (_) {}
          }
          return;
        }

        if (type === 'cancelno') {
          try {
            await interaction.deferUpdate();
            await interaction.deleteReply();
          } catch (err) {
            try { await interaction.reply({ content: 'Cancel received — no change.', ephemeral: true }); } catch (_) {}
          }
          return;
        }
      }
    } catch (err) {
      console.error('Interaction error:', err);
      if (!interaction.replied) {
        interaction.reply({ content: 'Unexpected error.', ephemeral: true }).catch(() => {});
      }
    }
  });

  client.on('messageCreate', msg => {
    // debug duplication trace
    if (!client.__firstMessageLogged) {
      client.__firstMessageLogged = true;
      console.log(`[events] messageCreate active (inst=${instanceId}) listeners=${client.listenerCount('messageCreate')}`);
    }
    if (!msg.author.bot) handleMessages(msg, client);
  });

  // Handle reaction-based registration flow
  client.on('messageReactionAdd', async (reaction, user) => {
    try {
      if (user.bot) return;
      // fetch partials
      if (reaction.partial) await reaction.fetch().catch(() => {});
  const msg = reaction.message;
  const pending = await gymUtil.getPendingByMessage(msg.id);
      if (!pending) return;
      // Only allow the original user to finalize
      if (pending.userId !== user.id) return;
  // finalize only when the user has reacted with ✅ on the message
  const finalizeReaction = msg.reactions.cache.get('✅');
  if (!finalizeReaction) return;
  const finalizeUsers = await finalizeReaction.users.fetch();
  if (!finalizeUsers.has(user.id)) return;

  // gather all emojis the user reacted with on this message
      const emojiMap = { '🟥': 'SU', '🟩': 'M', '🟦': 'T', '🟨': 'W', '🟪': 'TH', '🟫': 'F', '⬜': 'SA' };
      const selected = [];
      for (const [k,v] of Object.entries(emojiMap)) {
        const r = msg.reactions.cache.get(k);
        if (r) {
          // fetch users for the reaction
          const users = await r.users.fetch();
          if (users.has(user.id)) selected.push(v);
        }
      }
      if (!selected.length) return;
      const result = await gymUtil.finalizeRegistrationFromMessage(msg.id, user.id, selected);
      if (result) {
        try { await msg.channel.send(`<@${user.id}> Registration saved: ${result.schedule.join(' ')}`); } catch (_) {}
      }
    } catch (err) {
      console.error('Reaction add handle error:', err.message);
    }
  });

  client.on('messageReactionRemove', async (reaction, user) => {
    try {
      if (user.bot) return;
      if (reaction.partial) await reaction.fetch().catch(() => {});
  const msg = reaction.message;
  const pending = await gymUtil.getPendingByMessage(msg.id);
      if (!pending) return;
      // allow user to update their selection; we'll not auto-finalize here — user can re-react when ready
    } catch (err) {
      console.error('Reaction remove handle error:', err.message);
    }
  });
}

module.exports = registerEvents;
