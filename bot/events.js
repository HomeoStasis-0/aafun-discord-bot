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
        const value = parts[2];
        const userId = interaction.user.id;

        // Handle gym registration day selection
        if (type === 'day') {
          // Add/remove the selected day for the user in a pending registration
          const pending = await gymUtil.getPendingByUser(userId);
          if (!pending) {
            await interaction.reply({ content: 'No pending registration found. Please use /gym register.', ephemeral: true });
            return;
          }
          let selected = pending.selected || [];
          if (selected.includes(value)) {
            selected = selected.filter(d => d !== value);
          } else {
            selected.push(value);
          }
          await gymUtil.updatePendingSelection(userId, selected);
          await interaction.reply({ content: `Selected days: ${selected.join(' ')}`, ephemeral: true });
          return;
        }

        // Handle gym registration finalization
        if (type === 'done') {
          const pending = await gymUtil.getPendingByUser(userId);
          if (!pending || !pending.selected || !pending.selected.length) {
            await interaction.reply({ content: 'Please select at least one day before finishing registration.', ephemeral: true });
            return;
          }
          const result = await gymUtil.finalizeRegistrationFromMessage(pending.messageId, userId, pending.selected);
          if (result) {
            await interaction.reply({ content: `Registration saved: ${result.schedule.join(' ')}`, ephemeral: true });
          } else {
            await interaction.reply({ content: 'Failed to save registration.', ephemeral: true });
          }
          return;
        }

        // ...existing check-in and streak logic...
        // ...existing code...
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
