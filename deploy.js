const { REST, Routes } = require('discord.js');
require('dotenv').config();

// instantiate REST client
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

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
<<<<<<< HEAD
    description: 'Spotify integration commands',
    options: [
      {
        name: 'login',
        type: 1, // SUB_COMMAND type
        description: 'Log in to your Spotify account',
=======
    description: 'Spotify commands',
    options: [
      {
        type: 1,           // SUB_COMMAND
        name: 'login',
        description: 'Authorize with Spotify',
>>>>>>> 36f4080 (spotify)
      },
      {
        name: 'toptracks',
        type: 1, // SUB_COMMAND type
        description: 'Get your top Spotify tracks',
      },
    ],
  },
];

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
<<<<<<< HEAD
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), // Use Guild Commands for faster updates
=======
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
>>>>>>> 36f4080 (spotify)
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
