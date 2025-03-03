const { REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
  {
    name: 'chat',
    description: 'Chat with the bot',
    options: [
      {
        type: 3, // STRING type
        name: 'message',
        description: 'The message to send to the bot',
        required: true,
      },
    ],
  },
  {
    name: 'clear',
    description: 'Clear your chat memory',
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();