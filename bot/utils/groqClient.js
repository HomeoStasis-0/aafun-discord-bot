const Groq = require('groq-sdk');
const { GROQ_API_KEY } = require('../../config');

const groq = new Groq({ apiKey: GROQ_API_KEY });

module.exports = groq;
