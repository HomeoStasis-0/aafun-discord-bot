const { PermissionsBitField } = require('discord.js');

const ALLOWED_USER_IDS = new Set([
  '655507517799006241',
  '1012375559667458148'
]);

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function ensureDeferred(interaction) {
  if (interaction.deferred || interaction.replied) return true;
  if (typeof interaction.deferReply === 'function') {
    try {
      await interaction.deferReply({ ephemeral: true });
      return true;
    } catch (err) {
      console.warn('[purge] deferReply failed:', err?.message ?? err);
    }
  }
  // best-effort: try reply
  try {
    if (typeof interaction.reply === 'function') {
      await interaction.reply({ content: 'Working...', ephemeral: true });
      return true;
    }
  } catch (err) {
    console.error('[purge] fallback reply failed:', err?.message ?? err);
  }
  return false;
}

async function fetchMessages(channel, maxMessages = 1000) {
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
    if (msgs.length < 100) break;
  }
  return collected.slice(0, maxMessages);
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

module.exports = async function purge(interaction, client) {
  const ok = await ensureDeferred(interaction);
  if (!ok) {
    console.warn('[purge] could not acknowledge interaction');
    return;
  }

  // Authorization: allow only specific user IDs
  if (!ALLOWED_USER_IDS.has(String(interaction.user.id))) {
    console.warn(`[purge] unauthorized attempt by ${interaction.user.id}`);
    try {
      return interaction.editReply({ content: 'You are not authorized to run this command.', ephemeral: true });
    } catch (e) {
      // fallback if editReply isn't available
      try { await interaction.followUp({ content: 'You are not authorized to run this command.', ephemeral: true }); } catch {}
      return;
    }
  }

  const word = interaction.options.getString('word', true).trim();
  const picked = interaction.options.getChannel('channel');
  const limit = Math.max(10, Math.min(5000, interaction.options.getInteger('limit') || 1000));

  // Resolve channel (try fetch for better object if possible)
  let channel = picked || interaction.channel;
  if (picked) {
    try {
      channel = await client.channels.fetch(picked.id, { force: true }).catch(() => picked);
    } catch (err) {
      channel = picked;
    }
  }

  if (!channel) return interaction.editReply('Unable to determine a channel to purge.');

  // Permission checks
  try {
    // check invoking user perms (if guild context)
    // Skip permission check for allowed users
    if (
      !ALLOWED_USER_IDS.has(String(interaction.user.id)) &&
      interaction.member &&
      !interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)
    ) {
      return interaction.editReply('You need the Manage Messages permission to run this command.');
    }
  } catch (e) {
    // ignore - continue to bot perms check
  }

  try {
    const botPerms = channel.permissionsFor ? channel.permissionsFor(client.user) : null;
    if (!botPerms || !botPerms.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.editReply('I need the Manage Messages permission in the target channel to delete messages.');
    }
  } catch (err) {
    console.warn('[purge] permission check failed, continuing:', err);
  }

  const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
  await interaction.editReply(`Scanning last ${limit} messages in <#${channel.id}> for "${word}"...`);

  let messages;
  try {
    messages = await fetchMessages(channel, limit);
  } catch (err) {
    console.error('[purge] fetch messages failed:', err);
    return interaction.editReply('Failed to fetch messages from that channel. Do I have permission?');
  }

  const matches = messages.filter(m => {
    if (!m || !m.content) return false;
    return pattern.test(m.content);
  });

  if (!matches.length) {
    return interaction.editReply(`No messages containing "${word}" found in the last ${limit} messages.`);
  }

  let deleted = 0;
  for (const msg of matches) {
    try {
      await msg.delete();
      deleted++;
      // small delay to reduce rate-limit pressure
      await sleep(200);
    } catch (err) {
      console.warn(`[purge] failed to delete message ${msg.id}:`, err?.message ?? err);
    }
  }

  return interaction.editReply(`Deleted ${deleted} message(s) containing "${word}" from <#${channel.id}> (scanned ${limit} messages).`);
};
