const spotifyCommand = require('./commands/spotify');
const chatCommand = require('./commands/chat');
const gifsCommand = require('./commands/gifs');
const restartCommand = require('./commands/restart');
const clearCommand = require('./commands/clear');
const summarizeCommand = require('./commands/summarize'); // new
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

  client.on('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag} (pid=${process.pid}, inst=${instanceId})`);
    console.log('[events] messageCreate listeners:', client.listenerCount('messageCreate'));
  scheduleBirthdayChecks(client);
  // start gym daily posts
  gymUtil.scheduleDaily(client);
  });

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
        const letter = parts[2];
        const userId = interaction.user.id;
        const today = new Date().toISOString();

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
            new ButtonBuilder().setCustomId(`gym_confirmyes_${letter}_${Date.now()}`).setLabel('Yes, confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`gym_cancelyes_${letter}_${Date.now()}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
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
            new ButtonBuilder().setCustomId(`gym_confirmno_${letter}_${Date.now()}`).setLabel('Yes, confirm').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`gym_cancelno_${letter}_${Date.now()}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary)
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
          const streak = await gymUtil.recordCheck(userId, today, false);
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
          const streak = await gymUtil.recordCheck(userId, today, true);
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
