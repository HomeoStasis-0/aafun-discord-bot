const { clearMemory } = require('./chat');

module.exports = async function clear(interaction) {
  clearMemory(interaction.user.id);
  return interaction.reply({ content: 'Your chat memory has been cleared.', ephemeral: true });
};
