const express = require('express');
const { PORT } = require('./config');
const {
  exchangeCodeForTokens,
  setUserTokens,
  resolveInteractionUser,
  clearInteractionMapping
} = require('./bot/utils/spotify');

const app = express();

app.get('/', (_req, res) => res.send('Bot is running\n'));

app.get('/callback', async (req, res) => {
  const { code, state: interactionId } = req.query;
  if (!code || !interactionId) return res.status(400).json({ error: 'Missing code or state.' });

  const userId = resolveInteractionUser(interactionId);
  if (!userId) return res.status(400).json({ error: 'Invalid interaction ID.' });

  try {
    const tokens = await exchangeCodeForTokens(code);
    setUserTokens(userId, { ...tokens, expires_at: Date.now() + tokens.expires_in * 1000 });
    clearInteractionMapping(interactionId);
    res.send('Spotify login successful! You can now use bot commands.');
  } catch (err) {
    console.error('Spotify callback error:', err.message);
    res.status(500).json({ error: 'Failed to authenticate with Spotify.' });
  }
});

app.listen(PORT, () => console.log(`🌐 Server listening on ${PORT}`));

module.exports = app;
