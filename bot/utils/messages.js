const MATCHERS = [
  [/\berm+\b/, 'https://tenor.com/view/omori-erm-uuuh-uhh-huh-gif-15238876008948972055'],
  [/\bguh+\b/, 'https://tenor.com/view/guh-gif-25116077'],
  [/\bglorpshit\b/, 'https://tenor.com/view/glorp-glorpshit-mad-gif-12826934952903770254'],
  [/\bmeow\b/, m =>
    m.author.username === 'lyxchee'
      ? 'https://tenor.com/view/larry-larry-cat-chat-larry-meme-chat-meme-cat-gif-10061556685042597078'
      : 'https://tenor.com/view/big-poo-big-poo-cat-big-poo-cat-gif-8095478642247689280'],
  [/\bfemboy\b/, m =>
    m.author.username === 'homeo_stasis'
      ? 'https://tenor.com/view/anime-gif-1742373052751281532'
      : null],
  [/\b15\b.*\bgirl\b|\bgirl\b.*\b15\b/, 'minecraft movie incident'],
  [/\bcommunism\b/, 'https://tenor.com/view/cat-asian-chinese-silly-ccp-gif-17771773925036748435'],
  [/\bkys\b|\bkms\b/, 'https://tenor.com/view/high-tier-human-low-tier-god-ltg-love-yourself-lowtiergod-gif-4914755758940822771'],
];

// Per-message ID guard
const processed = new Set();
const MESSAGE_EXPIRY_MS = 5000;

// Content+author cooldown (guards multi-process echo)
const recent = new Map();
const CONTENT_COOLDOWN_MS = 2500;
function contentKey(msg) {
  return `${msg.author.id}|${msg.content.toLowerCase().trim()}`;
}
function seenRecently(msg) {
  const k = contentKey(msg);
  const now = Date.now();
  const last = recent.get(k);
  if (last && now - last < CONTENT_COOLDOWN_MS) return true;
  recent.set(k, now);
  // light cleanup
  if (recent.size > 500) {
    const cutoff = now - CONTENT_COOLDOWN_MS;
    for (const [rk, ts] of recent) if (ts < cutoff) recent.delete(rk);
  }
  return false;
}

async function handleMessages(message) {
  if (processed.has(message.id)) return;
  if (seenRecently(message)) {
    console.log(`[messages] Suppressed duplicate content "${message.content}"`);
    return;
  }
  processed.add(message.id);
  setTimeout(() => processed.delete(message.id), MESSAGE_EXPIRY_MS);

  const lower = message.content.toLowerCase();
  let responded = false;
  for (const [regex, value] of MATCHERS) {
    if (!regex.test(lower)) continue;
    if (responded) break;
    const out = typeof value === 'function' ? value(message) : value;
    if (!out) {
      responded = true;
      break;
    }
    try {
      console.log(`[messages] MessageID=${message.id} "${message.content}" -> regex ${regex}`);
      const sent = await message.channel.send(out);
      setTimeout(() => sent.delete().catch(() => {}), 5000);
    } catch (err) {
      console.error('Auto-response error:', err.message);
    }
    responded = true;
    break; // enforce single response
  }
}

module.exports = handleMessages;
