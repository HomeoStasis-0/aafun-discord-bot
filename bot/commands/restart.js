const { exec } = require('child_process');

module.exports = async function restart(interaction) {
  await interaction.reply('🔄 Restarting the bot...');
  exec('heroku restart --app aafun-discord-app', (error, stdout, stderr) => {
    if (error) return console.error('Restart error:', error.message);
    if (stderr) console.error(stderr);
    console.log(stdout);
  });
};
