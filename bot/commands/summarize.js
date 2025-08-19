const groq = require('../utils/groqClient');

async function ensureDeferred(interaction) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
}

async function fetchRecentMessages(channel, minutes, maxMessages = 1000) {
  const cutoff = Date.now() - minutes * 60 * 1000;
  const collected = [];
  let lastId;
  while (collected.length < maxMessages) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const batch = await channel.messages.fetch(options);
    if (!batch.size) break;
    const msgs = Array.from(batch.values());
    collected.push(...msgs);
    lastId = msgs[msgs.length - 1].id;
    // stop early if the oldest message in batch is older than cutoff
    if (msgs[msgs.length - 1].createdTimestamp < cutoff) break;
    // safety break if Discord returns less than requested
    if (msgs.length < 100) break;
  }
  // Keep only messages newer than cutoff and not from bots, in chronological order
  return collected
    .filter(m => m.createdTimestamp >= cutoff && !m.author?.bot)
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function buildChatText(messages) {
  // Format into simple lines: "Author: content"
  return messages.map(m => {
    const name = m.member?.nickname || m.author.username || 'Unknown';
    let content = (m.content || '').replace(/\n+/g, ' ');
    if (!content && m.attachments?.size) content = `[attachment: ${m.attachments.map(a => a.name || a.url).join(', ')}]`;
    return `${name}: ${content}`;
  }).join('\n');
}

async function summarizeText(text, minutes) {
  // system prompt instructs summarization
  const system = {
    role: 'system',
    content: 'You are a concise summarizer for Discord chat logs. Produce a short paragraph summary followed by 3-8 bullet points that capture key points, decisions, and action items. Keep it brief and readable.'
  };
  const userMsg = {
    role: 'user',
    content: `Summarize the following chat history (last ${minutes} minutes). Provide a short summary paragraph and bullet points:\n\n${text}`
  };
  const resp = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [system, userMsg],
    max_tokens: 800
  });
  return resp.choices?.[0]?.message?.content || 'No summary generated.';
}

module.exports = async function summarize(interaction) {
  await ensureDeferred(interaction);
  try {
    const minutes = Math.max(1, Math.min(60 * 24, interaction.options.getInteger('minutes') || 60)); // clamp 1..1440
    const channel = interaction.channel;
    if (!channel || !channel.messages) {
      return interaction.editReply('Unable to access this channel\'s messages.');
    }

    await interaction.editReply(`Fetching messages from the last ${minutes} minute(s)...`);

    const messages = await fetchRecentMessages(channel, minutes);
    if (!messages.length) return interaction.editReply(`No messages found in the last ${minutes} minutes.`);

    const chatText = buildChatText(messages);
    // If the chatText is huge, you may want to truncate or chunk; try once and fallback on failure
    let summary;
    try {
      summary = await summarizeText(chatText, minutes);
    } catch (err) {
      console.error('Summarize attempt failed, trying truncated input:', err.message);
      const truncated = chatText.slice(Math.max(0, chatText.length - 100_000)); // keep last ~100k chars
      summary = await summarizeText(truncated, minutes);
    }

    // Send the summary (if long, send as follow-ups)
    const MAX_CHARS = 1900;
    if (summary.length <= MAX_CHARS) {
      return interaction.editReply(summary);
    } else {
      // break into chunks
      const chunks = [];
      for (let i = 0; i < summary.length; i += MAX_CHARS) chunks.push(summary.slice(i, i + MAX_CHARS));
      await interaction.editReply(chunks[0]);
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({ content: chunks[i] });
      }
      return;
    }
  } catch (err) {
    console.error('Summarize error:', err);
    try { await interaction.editReply('Error while summarizing chat.'); } catch (e) {}
  }
};
