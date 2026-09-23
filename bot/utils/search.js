const axios = require('axios');
const { TAVILY_API_KEY } = require('../../config');

class SearchQuotaExceededError extends Error {}

async function webSearch(query) {
  if (!TAVILY_API_KEY) {
    throw new Error('Web search is not configured (missing TAVILY_API_KEY).');
  }

  let res;
  try {
    res = await axios.post('https://api.tavily.com/search', {
      api_key: TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: true
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
  } catch (err) {
    const status = err.response?.status;
    const detail = JSON.stringify(err.response?.data || '').toLowerCase();
    if (status === 429 || status === 432 || detail.includes('limit') || detail.includes('quota') || detail.includes('credit')) {
      throw new SearchQuotaExceededError('Tavily search quota exceeded for this month.');
    }
    throw err;
  }

  const { answer, results = [] } = res.data;

  const formatted = results
    .map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.content}`)
    .join('\n\n');

  return [answer ? `Quick answer: ${answer}` : null, formatted]
    .filter(Boolean)
    .join('\n\n') || 'No results found.';
}

module.exports = { webSearch, SearchQuotaExceededError };
