const axios = require('axios');

const AI_API_URL = process.env.AI_API_URL || `http://localhost:${process.env.PORT || 3000}/api/ai`;
// conservative default token limit (matches current Groq TPM error example)
const DEFAULT_TOKEN_LIMIT = parseInt(process.env.AI_TOKEN_LIMIT || '8000', 10);

// Try to load an accurate tokenizer (optional dependency). If unavailable, we'll fall back to the conservative estimator.
let tokenizer = null;
let encodingForModel = null;
try {
  // @dqbd/tiktoken exports encoding_for_model in recent versions
  const tiktoken = require('@dqbd/tiktoken');
  if (typeof tiktoken.encoding_for_model === 'function') {
    encodingForModel = tiktoken.encoding_for_model;
  } else if (tiktoken.Tiktoken) {
    // older API surface
    tokenizer = tiktoken;
  }
} catch (e) {
  // optional dependency not installed; fall back to estimator
}

function estimateTokensFromMessages(messages = []) {
  // Very small, conservative estimator: assumes ~4 characters per token.
  // Adds a small per-message overhead.
  let chars = 0;
  for (const m of messages) {
    if (!m) continue;
    const content = (m.content || m.message || '') + '';
    chars += content.length;
    // include role/metadata cost
    chars += (m.role || '').length;
  }
  const approxTokens = Math.ceil(chars / 4) + messages.length * 3;
  return approxTokens;
}

function countTokensFromMessages(messages = [], model = 'gpt-3.5-turbo') {
  // If tiktoken is available, use it for an accurate count.
  try {
    if (encodingForModel) {
      const enc = encodingForModel(model);
      let total = 0;
      for (const m of messages) {
        const text = `${m.role || ''}\n${m.content || m.message || ''}`;
        total += enc.encode(text).length;
      }
      try { enc.free(); } catch (e) {}
      return total;
    }
    if (tokenizer && tokenizer.Tiktoken) {
      const enc = new tokenizer.Tiktoken({ model });
      let total = 0;
      for (const m of messages) {
        const text = `${m.role || ''}\n${m.content || m.message || ''}`;
        total += enc.encode(text).length;
      }
      try { enc.free(); } catch (e) {}
      return total;
    }
  } catch (err) {
    // fall back to estimator below
    console.warn('Accurate tokenizer failed, falling back to conservative estimator:', err?.message || err);
  }
  return estimateTokensFromMessages(messages);
}

function trimMessagesToTokenLimit(messages = [], tokenLimit = DEFAULT_TOKEN_LIMIT, maxTokensForResponse = 0) {
  // Work on a shallow copy
  const msgs = messages.slice();
  let estimated = countTokensFromMessages(msgs) + (maxTokensForResponse || 0);
  if (estimated <= tokenLimit) return { messages: msgs, trimmed: false };

  // Iteratively drop oldest non-system messages until under the limit.
  while (estimated > tokenLimit && msgs.length > 1) {
    // prefer removing earliest user/assistant messages, keep the system message if present
    const first = msgs[0];
    if (first && first.role === 'system') {
      // remove the next message instead of the system message
      msgs.splice(1, 1);
    } else {
      msgs.shift();
    }
    estimated = estimateTokensFromMessages(msgs) + (maxTokensForResponse || 0);
  }

  return { messages: msgs, trimmed: estimated <= tokenLimit };
}

async function createChatCompletion({ model, messages, max_tokens } = {}) {
  try {
    const tokenLimit = parseInt(process.env.AI_TOKEN_LIMIT || DEFAULT_TOKEN_LIMIT, 10);
    const { messages: safeMessages, trimmed } = trimMessagesToTokenLimit(messages || [], tokenLimit, max_tokens || 0);
    if (trimmed) {
      console.warn(`AI request trimmed to fit token limit (${tokenLimit}). Original messages: ${messages.length}, sent: ${safeMessages.length}`);
    }

    const res = await axios.post(AI_API_URL, {
      model,
      messages: safeMessages,
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

module.exports = { createChatCompletion, estimateTokensFromMessages, trimMessagesToTokenLimit };
