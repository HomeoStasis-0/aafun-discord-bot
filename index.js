require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const RE2 = require('re2');
const http = require('http');

let client;
let bot_active = false;  // Global variable to track bot's active state

function createClient() {
  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
  });

  client.on('ready', () => {
    console.log(`We have logged in as ${client.user.tag}`);
  });

  client.on('messageCreate', message => {
    console.log(`Received message: ${message.content}`);  // Log received messages

    if (message.author.id === client.user.id) {
      console.log('Ignoring message from the bot itself');
      return;
    }

    const content_lower = message.content.toLowerCase();
    console.log(`Message content in lowercase: ${content_lower}`);

    const fatRegex = new RE2('\\bfat\\b');
    const fatassRegex = new RE2('\\bfatass\\b');
    const fattyRegex = new RE2('\\bfatty\\b');

    console.log(`Testing regex patterns against message content...`);
    if (fatRegex.test(content_lower) || fatassRegex.test(content_lower) || fattyRegex.test(content_lower)) {
      bot_active = true;
      console.log('Matched a keyword, sending response');
      message.channel.send('https://tenor.com/view/berserk-skeleton-damn-bro-you-gif-25852196')
        .then(() => console.log('Response sent successfully'))
        .catch(error => console.error('Error sending response:', error));
    } else {
      bot_active = false;
      console.log('No keyword matched');
    }

    if (bot_active) {
      // Add any additional functionality here when the bot is active
      console.log('Bot is active');
    } else {
      console.log('Bot is inactive');
      client.destroy();
    }
  });
}

// Function to log in the bot
function loginBot() {
  createClient();
  client.login(process.env.DISCORD_TOKEN)
    .then(() => console.log('Logged in successfully'))
    .catch(error => console.error('Error logging in:', error));
}

// Function to check messages and log in the bot if keywords are detected
function checkMessagesAndLogin() {
  const tempClient = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
  });

  tempClient.on('messageCreate', message => {
    if (message.author.id === tempClient.user.id) {
      return;
    }

    const content_lower = message.content.toLowerCase();
    const fatRegex = new RE2('\\bfat\\b');
    const fatassRegex = new RE2('\\bfatass\\b');
    const fattyRegex = new RE2('\\bfatty\\b');

    if (fatRegex.test(content_lower) || fatassRegex.test(content_lower) || fattyRegex.test(content_lower)) {
      tempClient.destroy();
      loginBot();
    }
  });

  tempClient.login(process.env.DISCORD_TOKEN)
    .catch(error => console.error('Error logging in temp client:', error));
}

// Create a simple HTTP server to prevent Heroku boot timeout
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running\n');
}).listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// Initial check for messages
checkMessagesAndLogin();