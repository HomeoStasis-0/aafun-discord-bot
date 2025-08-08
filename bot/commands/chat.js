const Groq = require('groq-sdk');
const { GROQ_API_KEY } = require('../../config');
const groq = new Groq({ apiKey: GROQ_API_KEY });

const memory = {};
const MAX_MEMORY = 10;

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
    const resp = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: memory[userId]
    });
    const reply = resp.choices[0]?.message?.content || 'Sorry, I could not process that.';
    await chunk(interaction, reply);
    memory[userId].push({ role: 'assistant', content: reply });
  } catch (err) {
    console.error('Chat error:', err.message);
    interaction.editReply('Sorry, something went wrong.');
  }
};

module.exports.clearMemory = userId => { memory[userId] = []; };
