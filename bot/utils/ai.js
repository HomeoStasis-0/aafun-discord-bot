const axios = require('axios');

const AI_API_URL = process.env.AI_API_URL || `http://localhost:${process.env.PORT || 3000}/api/ai`;

async function createChatCompletion({ model, messages, max_tokens } = {}) {
  try {
    const res = await axios.post(AI_API_URL, {
      model,
      messages,
      max_tokens
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000
    });
    return res.data;
  } catch (err) {
    // bubble up a helpful error message
    const msg = err.response?.data || err.message || String(err);
    throw new Error(`AI API request failed: ${msg}`);
  }
}

module.exports = { createChatCompletion };
