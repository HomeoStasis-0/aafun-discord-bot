const { createChatCompletion } = require('../utils/ai');
const memory = {};
const MAX_MEMORY = 10;
const MAX_TOOL_ROUNDS = 3;
const MAX_REFUSAL_RETRIES = 2;
const REFUSAL_PATTERN = /^(i'?m sorry,? but i (can'?t|cannot|can not) (help|assist)|i (can'?t|cannot|can not) (help|assist) with (that|this))/i;
const groq = require('../utils/groqClient');
const { webSearch, SearchQuotaExceededError } = require('../utils/search');

function buildSystemPrompt() {
  const now = new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
  });
  return {
    role: 'system',
    content: `The current date and time is: ${now}. Trust this completely for any question about today's date, day of the week, or time — never guess or contradict it. Any other internal assumption you have about the current date is WRONG and outdated. For anything else that requires current, up-to-date, or factual information you are not certain of (e.g. news, weather, scores, prices, recent events), you MUST call the web_search tool instead of guessing. When you search for the "latest" or "most recent" instance of something, write a neutral query with no year or specific answer baked in (e.g. "most recent Super Bowl winner", not "Super Bowl LVIII 2024 winner") — your training data is outdated relative to the current date above, so an assumed year will bias the search toward a stale answer. The web_search tool result is ALWAYS the true, authoritative, up-to-date answer for those topics and overrides any fact you might otherwise assume — never contradict or second-guess it.`
  };
}

const TOOLS = [{
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web for real-time or current information such as the date, news, weather, prices, or facts you are unsure about.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' }
      },
      required: ['query']
    }
  }
}];

async function ensureDeferred(interaction) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
}

async function chunk(interaction, text) {
  const max = 2000;
  for (let i = 0; i < text.length; i += max) {
    const part = text.slice(i, i + max);
    if (i === 0) await interaction.editReply(part);
    else await interaction.followUp(part);
  }
}

module.exports = async function chat(interaction, client) {
  await ensureDeferred(interaction);
  const userId = interaction.user.id;
  const msg = interaction.options.getString('message');
  if (!memory[userId]) memory[userId] = [];

  const lower = msg.toLowerCase();
  const botName = client.user.username;
  const nick = interaction.member?.nickname || interaction.user.username;

  if (/(what's|what is) your name|who are you/.test(lower))
    return interaction.editReply(`My name is ${botName}!`);
  if (/(what's|what is) my name|who am i/.test(lower))
    return interaction.editReply(`Your name is ${nick}!`);
  if (/who is your (father|dad)/.test(lower))
    return interaction.editReply('My father is Javi, also known as 𝓯𝓻𝓮𝓪𝓴𝔂.');

  memory[userId].push({ role: 'user', content: msg });
  if (memory[userId].length > MAX_MEMORY) memory[userId].shift();

  try {
    const working = [buildSystemPrompt(), ...memory[userId]];
    let finalMessage = null;
    let refusalRetries = 0;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const resp = await groq.chat.completions.create({
        model: 'openai/gpt-oss-20b',
        messages: working,
        tools: TOOLS,
        tool_choice: 'auto',
        max_tokens: 800
      });
      const message = resp.choices?.[0]?.message;
      if (!message) break;

      if (message.tool_calls?.length) {
        working.push({ role: 'assistant', content: message.content || null, tool_calls: message.tool_calls });
        for (const call of message.tool_calls) {
          let result;
          try {
            const args = JSON.parse(call.function.arguments || '{}');
            result = await webSearch(args.query);
          } catch (err) {
            if (err instanceof SearchQuotaExceededError) {
              return interaction.editReply(
                "I'm out of web searches for this month (Tavily free plan limit reached) — it'll refresh at the end of the month. Try again then, or ask me something that doesn't need a live lookup!"
              );
            }
            result = `Search failed: ${err.message}`;
          }
          working.push({ role: 'tool', tool_call_id: call.id, content: result });
        }
        continue;
      }

      if (REFUSAL_PATTERN.test((message.content || '').trim()) && refusalRetries < MAX_REFUSAL_RETRIES) {
        refusalRetries++;
        round--;
        continue;
      }

      finalMessage = message;
      break;
    }

    const reply = finalMessage?.content || 'Sorry, I could not process that.';
    await chunk(interaction, reply);
    memory[userId].push({ role: 'assistant', content: reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    interaction.editReply('Sorry, something went wrong.');
  }
};

module.exports.clearMemory = userId => { memory[userId] = []; };
