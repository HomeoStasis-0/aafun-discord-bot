require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const RE2 = require('re2');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

let bot_active = false;  // Global variable to track bot's active state

client.on('ready', () => {
  console.log(`We have logged in as ${client.user.tag}`);
});

client.on('messageCreate', message => {
  if (message.author.id === client.user.id) {
    return;
  }

  const content_lower = message.content.toLowerCase();
  const fatRegex = new RE2('\\bfat\\b');
  const fatassRegex = new RE2('\\bfatass\\b');
  const fattyRegex = new RE2('\\bfatty\\b');

  if (fatRegex.test(content_lower) || fatassRegex.test(content_lower) || fattyRegex.test(content_lower)) {
    bot_active = true;
    message.channel.send('https://tenor.com/view/berserk-skeleton-damn-bro-you-gif-25852196');
  } else {
    bot_active = false;
  }

  if (bot_active) {
    // Add any additional functionality here when the bot is active
  }
});

// Use environment variable for the token
client.login(process.env.DISCORD_TOKEN);