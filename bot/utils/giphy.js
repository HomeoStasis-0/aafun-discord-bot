const axios = require('axios');
const { GIPHY_API_KEY, GIPHY_LIMIT, GIPHY_RATING } = require('../../config'); // fixed path

async function getRandomGif(searchTerm = '') {
  try {
    const endpoint = searchTerm
      ? 'https://api.giphy.com/v1/gifs/search'
      : 'https://api.giphy.com/v1/gifs/trending';
    const params = { api_key: GIPHY_API_KEY, limit: GIPHY_LIMIT, rating: GIPHY_RATING };
    if (searchTerm) params.q = searchTerm;
    const { data } = await axios.get(endpoint, { params });
    const gifs = data.data;
    if (!gifs?.length) return null;
    return gifs[Math.floor(Math.random() * gifs.length)]?.images?.original?.url || null;
  } catch (err) {
    console.error('Giphy error:', err.message);
    return null;
  }
}

module.exports = { getRandomGif };
