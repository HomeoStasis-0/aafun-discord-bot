const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
  {
    name: 'chat',
    description: 'Chat with the bot',
    options: [
      {
        name: 'message',
        type: 3, // STRING type
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
    description: 'Spotify integration commands',
    options: [
      {
        name: 'login',
        type: 1, // SUB_COMMAND type
        description: 'Log in to your Spotify account',
      },
      {
        name: 'toptracks',
        type: 1, // SUB_COMMAND type
        description: 'Get your top Spotify tracks',
      },
    ],
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), // Use Guild Commands for faster updates
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();