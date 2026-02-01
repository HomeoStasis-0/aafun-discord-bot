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
        description: 'The channel to summarize (default: current channel)',
        required: false,
      },
    ]
  },
  {
    name: 'gym',
    description: 'Gym streak commands',
    options: [
      {
        type: 1, // SUB_COMMAND
        name: 'register',
        description: 'Register your gym schedule (comma-separated days: Mon,Tue,Wed...)',
        options: [
          {
            name: 'days',
            type: 3, // STRING
            description: 'Comma separated weekdays (e.g. Mon,Wed,Fri)',
            required: true
          }
        ]
      },
      {
        type: 1,
        name: 'status',
        description: 'Show your gym schedule and streak'
      },
      {
        type: 1,
        name: 'dump',
        description: 'Dump stored gym data (your own or a user if permitted)',
        options: [
          {
            name: 'user',
            type: 6, // USER
            description: 'User to dump (requires Manage Guild permission)',
            required: false
          }
        ]
      },
      {
        type: 1,
        name: 'send_streak',
        description: 'Send current streaks for all registered users (requires Manage Guild)'
      },
      {
        type: 1,
        name: 'set_streak',
        description: 'Set a user\'s streak (admin only)',
        options: [
          { name: 'user', type: 6, description: 'User to modify', required: true },
          { name: 'streak', type: 4, description: 'Streak value (integer)', required: true }
        ]
      },
      {
        type: 1,
        name: 'send',
        description: 'Manually send today\'s gym check-in message to the gym channel (requires Manage Guild)'
      },
      {
        type: 1,
        name: 'schedule',
        description: 'Show the gym schedule and who registered for each day'
      }
      ,
      {
        type: 1,
        name: 'live',
        description: 'Show live counts for a facility',
        options: [
          { name: 'facility', type: 3, description: 'Facility id or name (optional)', required: false }
        ]
      }
    ]
  }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    // Use Routes.applicationCommands for global commands
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands globally.');
  } catch (error) {
    console.error(error);
  }
})();
