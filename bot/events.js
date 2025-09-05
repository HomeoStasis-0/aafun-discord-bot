const spotifyCommand = require('./commands/spotify');
const chatCommand = require('./commands/chat');
const gifsCommand = require('./commands/gifs');
const restartCommand = require('./commands/restart');
const clearCommand = require('./commands/clear');
const summarizeCommand = require('./commands/summarize'); // new
const purgeCommand = require('./commands/purge'); // new
const handleMessages = require('./utils/messages');
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
  });

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const map = {
      spotify: spotifyCommand,
      chat: chatCommand,
      randomgif: gifsCommand,
      restart: restartCommand,
      clear: clearCommand,
      summarize: summarizeCommand, // new
      purge: purgeCommand // new
    };
    const fn = map[interaction.commandName];
    if (!fn) return;
    try {
      await fn(interaction, client);
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
}

module.exports = registerEvents;
