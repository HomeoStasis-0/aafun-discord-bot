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
  name: 'birthday',
  description: 'Set or get your birthday',
  options: [
    {
      type: 1,
      name: 'set',
      description: 'Set your birthday',
      options: [
        {
          type: 3,
          name: 'date',
          description: 'Your birthday (YYYY-MM-DD)',
          required: true,
        },
      ],
    },
  ],
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