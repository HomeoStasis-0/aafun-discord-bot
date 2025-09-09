const groq = require('../utils/groqClient');
const { PermissionsBitField } = require('discord.js');

async function ensureDeferred(interaction) {
  if (interaction.deferred || interaction.replied) return true;

  // If this object doesn't support deferReply, treat it as a plain Message (message-based command)
  if (typeof interaction.deferReply !== 'function') {
    try {
      // Send a placeholder message and expose editReply/followUp that the rest of the code expects.
      const placeholder = await interaction.channel.send('Working on your request...');
      // adapter: editReply -> edit the placeholder
      interaction.editReply = async (contentOrOpts) => {
        if (typeof contentOrOpts === 'string') return placeholder.edit(contentOrOpts);
        if (contentOrOpts && typeof contentOrOpts.content === 'string') return placeholder.edit(contentOrOpts.content);
        // minimal fallback
        return placeholder.edit(String(contentOrOpts));
      };
      // adapter: followUp -> send a new message in the same channel
      interaction.followUp = async (opts) => {
        const text = (typeof opts === 'string') ? opts : (opts && opts.content) ? opts.content : '';
        return interaction.channel.send(text);
      };
      interaction.replied = true;
      return true;
    } catch (err) {
      console.error('[ensureDeferred] failed to send placeholder message for message-based invocation:', err?.code ?? err?.message ?? err);
      return false;
    }
  }

  try {
    await interaction.deferReply();
    return true;
  } catch (err) {
    console.warn('[ensureDeferred] deferReply failed:', err?.code ?? err?.message ?? err);
    try {
      // Try ephemeral fallback using flags (modern API) if supported, else fallback to plain reply
      const fallbackOpts = { content: 'Working on your request...' };
      // If reply accepts flags (discord.js v13+), using flags numeric for ephemeral (64)
      try {
        await interaction.reply({ ...fallbackOpts, flags: 64 });
      } catch (e) {
        // fallback to non-ephemeral if ephemeral fails
        await interaction.reply(fallbackOpts);
      }
      return true;
    } catch (err2) {
      console.error('[ensureDeferred] fallback reply also failed:', err2?.code ?? err2?.message ?? err2);

      // Final fallback: try sending a visible placeholder message to the channel and adapt methods.
      try {
        if (interaction.channel && typeof interaction.channel.send === 'function') {
          const placeholder2 = await interaction.channel.send('Working on your request...');
          // adapter: editReply -> edit the placeholder
          interaction.editReply = async (contentOrOpts) => {
            if (typeof contentOrOpts === 'string') return placeholder2.edit(contentOrOpts);
            if (contentOrOpts && typeof contentOrOpts.content === 'string') return placeholder2.edit(contentOrOpts.content);
            return placeholder2.edit(String(contentOrOpts));
          };
          // adapter: followUp -> send a new message in the same channel
          interaction.followUp = async (opts) => {
            const text = (typeof opts === 'string') ? opts : (opts && opts.content) ? opts.content : '';
            return interaction.channel.send(text);
          };
          interaction.replied = true;
          console.warn('[ensureDeferred] used channel.send fallback placeholder after interaction reply failed.');
          return true;
        }
      } catch (err3) {
        console.error('[ensureDeferred] channel.send fallback also failed:', err3?.code ?? err3?.message ?? err3);
      }

      return false; // no way to acknowledge
    }
  }
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
<<<<<<< HEAD
    // stop early if the oldest message in batch is older than cutoff
    if (msgs[msgs.length - 1].createdTimestamp < cutoff) break;
    // safety break if Discord returns less than requested
    if (msgs.length < 100) break;
  }
  // Keep only messages newer than cutoff and not from bots, in chronological order
=======
    if (msgs[msgs.length - 1].createdTimestamp < cutoff) break;
    if (msgs.length < 100) break;
  }
>>>>>>> 6af8b2c6555f0fadd7236312db8a22b09a781298
  return collected
    .filter(m => m.createdTimestamp >= cutoff && !m.author?.bot)
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function buildChatText(messages) {
<<<<<<< HEAD
  // Format into simple lines: "Author: content"
  return messages.map(m => {
    const name = m.member?.nickname || m.author.username || 'Unknown';
    let content = (m.content || '').replace(/\n+/g, ' ');
    if (!content && m.attachments?.size) content = `[attachment: ${m.attachments.map(a => a.name || a.url).join(', ')}]`;
=======
  return messages.map(m => {
    const name = m.member?.nickname || m.author.username || 'Unknown';
    let content = (m.content || '').replace(/\n+/g, ' ');
    if (!content && m.attachments?.size) {
      content = `[attachment: ${m.attachments.map(a => a.name || a.url).join(', ')}]`;
    }
>>>>>>> 6af8b2c6555f0fadd7236312db8a22b09a781298
    return `${name}: ${content}`;
  }).join('\n');
}

async function summarizeText(text, minutes) {
<<<<<<< HEAD
  // system prompt instructs summarization
=======
>>>>>>> 6af8b2c6555f0fadd7236312db8a22b09a781298
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

<<<<<<< HEAD
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
=======
module.exports = async function summarize(interaction, client) {
  const ok = await ensureDeferred(interaction);
  if (!ok) {
    console.warn('[summarize] Could not acknowledge interaction, aborting.');
    return; // stop early if we failed to ack
  }

  try {
    const minutes = Math.max(
      1,
      Math.min(60 * 24, interaction.options.getInteger('minutes') || 60)
    );

    let channel = interaction.channel;
    const picked = interaction.options.getChannel('channel');
    if (picked) {
      try {
        channel = await client.channels.fetch(picked.id, { force: true }).catch(() => picked);
      } catch (err) {
        console.error('Failed to fetch selected channel via client.channels.fetch, falling back to provided channel object:', err);
        channel = picked;
      }
    } else {
      channel = interaction.channel;
    }

    if (!channel) return interaction.editReply('Unable to determine a channel to summarize.');

    // Basic permission check so we fail early with a helpful message if the bot can't read the channel
    try {
      if (channel.permissionsFor) {
        const perms = channel.permissionsFor(client.user);
        if (
          perms &&
          (
            !perms.has(PermissionsBitField.Flags.VIEW_CHANNEL) ||
            !perms.has(PermissionsBitField.Flags.READ_MESSAGE_HISTORY)
          )
        ) {
          return interaction.editReply('I lack permission to view or read message history in that channel. Please give me View Channel and Read Message History permissions.');
        }
      }
    } catch (permErr) {
      console.warn('Permission check failed, continuing and letting fetch handle errors:', permErr);
    }

    if (!channel.messages || typeof channel.messages.fetch !== 'function') {
      return interaction.editReply('I cannot read messages from that channel type. Please pick a text channel or thread.');
    }

    const channelMention = `<#${channel.id}>`;
    console.log(`[summarize] Summarizing channel id=${channel.id} name=${channel.name} type=${channel.type} requestedBy=${interaction.user.id}`);
    // Remove this line to avoid sending the "Fetching messages..." message:
    // await interaction.editReply(`Fetching messages from ${channelMention} (last ${minutes} minute(s))...`);

    let messages;
    try {
      messages = await fetchRecentMessages(channel, minutes);
    } catch (err) {
      console.error('Failed to fetch messages from target channel:', err);
      return interaction.editReply('I do not have permission to read messages in that channel or an error occurred.');
    }

    if (!messages.length) {
      // Only send "No messages found" if summarizing the current channel or if a channel was picked (but only for the picked one)
      if (picked) {
        // If a channel was picked, only reply in the invocation channel about the picked channel
        return interaction.editReply(`No messages found in the last ${minutes} minutes.`);
      } else {
        // If no channel was picked, reply as usual
        return interaction.editReply(`No messages found in the last ${minutes} minutes.`);
      }
    }

    const chatText = buildChatText(messages);

>>>>>>> 6af8b2c6555f0fadd7236312db8a22b09a781298
    let summary;
    try {
      summary = await summarizeText(chatText, minutes);
    } catch (err) {
      console.error('Summarize attempt failed, trying truncated input:', err.message);
<<<<<<< HEAD
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
=======
      const truncated = chatText.slice(Math.max(0, chatText.length - 100_000));
      summary = await summarizeText(truncated, minutes);
    }

    const MAX_CHARS = 1900;
    const chunks = [];
    if (summary.length <= MAX_CHARS) {
      chunks.push(summary);
    } else {
      for (let i = 0; i < summary.length; i += MAX_CHARS) {
        chunks.push(summary.slice(i, i + MAX_CHARS));
      }
    }

    // Only send the summary for the channel that was actually summarized
    try {
      // Only send summary if:
      // - No channel was picked (summarizing current channel)
      // - OR a channel was picked (summarize only that channel)
      if (chunks.length === 1) {
        return interaction.editReply(
          `Summary (last ${minutes} minute(s)) for ${channelMention}:\n\n${chunks[0]}`
        );
      } else {
        await interaction.editReply(
          `Summary (last ${minutes} minute(s)) for ${channelMention}:\n\n${chunks[0]}`
        );
        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp({ content: chunks[i] });
        }
        return;
      }
    } catch (errPublic) {
      console.error('Failed to post summary in invocation channel:', errPublic);
      try {
        await interaction.editReply('Error while posting the summary.');
      } catch (e) {
        console.error('Failed to send error message:', e);
>>>>>>> 6af8b2c6555f0fadd7236312db8a22b09a781298
      }
      return;
    }
  } catch (err) {
    console.error('Summarize error:', err);
<<<<<<< HEAD
    try { await interaction.editReply('Error while summarizing chat.'); } catch (e) {}
  }
};
=======
    try {
      await interaction.editReply('Error while summarizing chat.');
    } catch (e) {
      console.error('Failed to send error message:', e);
    }
  }
};
>>>>>>> 6af8b2c6555f0fadd7236312db8a22b09a781298
