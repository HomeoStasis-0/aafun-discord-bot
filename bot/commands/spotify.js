const querystring = require('querystring');
const axios = require('axios');
const { EmbedBuilder } = require('discord.js');
const {
  mapInteractionToUser,
  getUserTokens,
  refreshTokensIfNeeded
} = require('../utils/spotify');
const { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI } = require('../../config');

// Helper to ensure reply deferral
async function ensureDeferred(interaction) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply();
  }
}

// Build auth URL
function buildAuthUrl(interactionId) {
  return 'https://accounts.spotify.com/authorize?' + querystring.stringify({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: 'user-top-read',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state: interactionId
  });
}

// Main command handler
module.exports = async function spotifyCommand(interaction) {
  const sub = interaction.options.getSubcommand();
  const userId = interaction.user.id;

  if (sub === 'login') {
    mapInteractionToUser(interaction.id, userId);
    return interaction.reply({
      content: `Click [here](${buildAuthUrl(interaction.id)}) to log in to Spotify.`,
      ephemeral: true
    });
  }

  if (sub === 'toptracks') {
    await ensureDeferred(interaction);

    let tokens = getUserTokens(userId);
    if (!tokens) {
      return interaction.editReply('⚠️ Please log in with `/spotify login` first.');
    }

    try {
      tokens = await refreshTokensIfNeeded(userId);
    } catch {
      return interaction.editReply('⚠️ Token refresh failed. Please login again.');
    }

    try {
      const { data } = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        params: { time_range: 'short_term', limit: 5 }
      });

      const items = data.items || [];
      if (!items.length) {
        return interaction.editReply('🎶 No top tracks found.');
      }

      const embeds = items.map((t, i) =>
        new EmbedBuilder()
          .setColor('#1DB954')
          .setTitle(`${i + 1}. ${t.name}`)
          .setDescription(`By ${t.artists.map(a => a.name).join(', ')}\nAlbum: ${t.album.name}`)
          .setThumbnail(t.album.images[0]?.url || null)
      );

      return interaction.editReply({ content: 'Your Top 5 Tracks 👾:', embeds });
    } catch (err) {
      console.error('Spotify toptracks fetch error:', err.message);
      return interaction.editReply('⚠️ Failed to fetch your top tracks.');
    }
  }
};
