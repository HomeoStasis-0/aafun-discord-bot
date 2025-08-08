const { EmbedBuilder } = require('discord.js');
const { getRandomGif } = require('../utils/giphy');

const FALLBACKS = {
  rick: 'https://tenor.com/view/rickroll-roll-rick-never-gonna-give-you-up-gif-22113173',
  rickroll: 'https://tenor.com/view/rickroll-roll-rick-never-gonna-give-you-up-gif-22113173',
  sus: 'https://tenor.com/view/among-us-sus-suspicious-gif-19443613',
  amogus: 'https://tenor.com/view/among-us-sus-suspicious-gif-19443613',
  skeleton: 'https://tenor.com/view/berserk-skeleton-damn-bro-you-gif-25852196',
  skull: '💀',
  based: 'https://tenor.com/view/gigachad-chad-gif-20773266',
  chad: 'https://tenor.com/view/gigachad-chad-gif-20773266',
  cringe: 'https://tenor.com/view/cringe-gif-21464576',
  nah: 'https://tenor.com/view/nah-id-win-jjk-gif-8888717316917975261',
  bruh: 'https://tenor.com/view/bruh-gif-21934518'
};

async function ensureDeferred(interaction) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
}

module.exports = async function gifs(interaction) {
  await ensureDeferred(interaction);
  const term = interaction.options.getString('search') || '';
  try {
    const gif = await getRandomGif(term);
    if (gif) {
      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle(term ? `Random GIF: ${term}` : 'Random GIF')
        .setImage(gif)
        .setFooter({ text: 'Powered by Giphy' });
      return interaction.editReply({ embeds: [embed] });
    }
    const lower = term.toLowerCase();
    if (FALLBACKS[lower]) {
      const content = FALLBACKS[lower];
      if (!content.startsWith('http')) return interaction.editReply(content);
      const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle(`${term} GIF`)
        .setImage(content)
        .setFooter({ text: 'Fallback (Giphy empty)' });
      return interaction.editReply({ embeds: [embed] });
    }
    interaction.editReply(
      term
        ? `❌ No GIFs found for "${term}". Try a different search term!`
        : '❌ Failed to fetch a random GIF'
    );
  } catch (err) {
    console.error('GIF error:', err.message);
    interaction.editReply('❌ Error fetching GIF.');
  }
};
