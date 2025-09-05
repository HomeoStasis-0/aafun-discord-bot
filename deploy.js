const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
require('dotenv').config();

const commands = [
  {
    name: 'chat',
    description: 'Chat with the bot',
    options: [
      {
        name: 'message',
        type: 3, // STRING
        description: 'The message to send to the bot',
        required: true,
      },
    ],
  },
  {
    name: 'clear',
    description: 'Clear your chat memory',
  },
  {
    name: 'spotify',
    description: 'Spotify commands',
    options: [
      {
        type: 1, // SUB_COMMAND
        name: 'login',
        description: 'Authorize with Spotify',
      },
      {
        name: 'toptracks',
        type: 1, // SUB_COMMAND
        description: 'Get your top Spotify tracks',
      },
    ],
  },
  {
    name: 'restart',
    description: 'Restart the bot',
  },
  {
    name: 'randomgif',
    description: 'Get a random GIF from Giphy',
    options: [
      {
        name: 'search',
        type: 3, // STRING
        description: 'Search term for the GIF (optional)',
        required: false,
      },
    ],
  },
  {
    name: 'summarize',
    description: 'Summarize recent chat in this channel',
    options: [
      {
        name: 'minutes',
        type: 4, // INTEGER
        description: 'Number of minutes to look back (default 60)',
        required: false,
      },
      {
        name: 'channel',
        type: 7, // CHANNEL
        description: 'Channel to summarize (optional). Use the channel picker to choose another channel.',
        required: false,
        // 👇 Restrict to text channels & threads
        channel_types: [0, 5, 10, 11, 12], 
        /*
          0 = GUILD_TEXT
          5 = GUILD_NEWS
          10 = GUILD_NEWS_THREAD
          11 = GUILD_PUBLIC_THREAD
          12 = GUILD_PRIVATE_THREAD
        */
      }
    ]
  },
  {
    name: 'purge',
    description: 'Delete messages containing a given word from a channel',
    options: [
      {
        name: 'word',
        type: 3, // STRING
        description: 'Word to match (whole-word, case-insensitive)',
        required: true,
      },
      {
        name: 'channel',
        type: 7, // CHANNEL
        description: 'Channel to purge (optional - defaults to the current channel)',
        required: false,
        channel_types: [0, 5, 10, 11, 12],
      },
      {
        name: 'limit',
        type: 4, // INTEGER
        description: 'Max number of recent messages to scan (default 1000, max 5000)',
        required: false,
      },
    ],
  }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    // ⚡ use Guild commands for instant updates during testing
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) guild commands.');
  } catch (error) {
    console.error(error);
  }
})();
