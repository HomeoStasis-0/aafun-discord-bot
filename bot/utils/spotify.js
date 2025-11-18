const axios = require('axios');
const querystring = require('querystring');
const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  TOKEN_EXPIRY_FUZZ
} = require('../../config'); // fixed relative path

const userTokens = {};
const interactionMap = {};

function mapInteractionToUser(interactionId, userId) { interactionMap[interactionId] = userId; }
function resolveInteractionUser(interactionId) { return interactionMap[interactionId]; }
function clearInteractionMapping(interactionId) { delete interactionMap[interactionId]; }

function setUserTokens(userId, tokens) { userTokens[userId] = tokens; }
function getUserTokens(userId) { return userTokens[userId]; }

async function exchangeCodeForTokens(code) {
  const payload = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    client_id: SPOTIFY_CLIENT_ID,
    client_secret: SPOTIFY_CLIENT_SECRET
  };
  const res = await axios.post(
    'https://accounts.spotify.com/api/token',
    querystring.stringify(payload),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return {
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_in: res.data.expires_in
  };
}

async function refreshTokens(refresh_token) {
  const payload = {
    grant_type: 'refresh_token',
    refresh_token,
    client_id: SPOTIFY_CLIENT_ID,
    client_secret: SPOTIFY_CLIENT_SECRET
  };
  const res = await axios.post(
    'https://accounts.spotify.com/api/token',
    querystring.stringify(payload),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return {
    access_token: res.data.access_token,
    expires_in: res.data.expires_in
  };
}

async function refreshTokensIfNeeded(userId) {
  const tokens = getUserTokens(userId);
  if (!tokens) return null;
  if (Date.now() + TOKEN_EXPIRY_FUZZ < tokens.expires_at) return tokens;
  if (!tokens.refresh_token) return tokens;
  const fresh = await refreshTokens(tokens.refresh_token);
  const updated = {
    ...tokens,
    access_token: fresh.access_token,
    expires_at: Date.now() + fresh.expires_in * 1000
  };
  setUserTokens(userId, updated);
  return updated;
}

module.exports = {
  exchangeCodeForTokens,
  refreshTokensIfNeeded,
  mapInteractionToUser,
  resolveInteractionUser,
  clearInteractionMapping,
  getUserTokens,
  setUserTokens
};
