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
        type: 1, // SUB_COMMAND type
        description: 'Get your top Spotify tracks',
      },
    ],
  },
  {
    name: 'restart',
    description: 'Restart the bot',
  },
];

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