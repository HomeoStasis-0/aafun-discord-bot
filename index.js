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
    const yourMomRegex = new RE2('\\byour mom\\b');
    const urMomRegex = new RE2('\\bur mom\\b');
    const ermRegex = new RE2('\\berm+\\b');
    const guhRegex = new RE2('\\bguh+\\b');
    const cumRegex = new RE2('\\b(cum|cums|cumming|bust|busting|busted|cream|creams|creaming|creamed)\\b', 'i');


    console.log(`Testing regex patterns against message content...`);
    if (urMomRegex.test(content_lower) || yourMomRegex.test(content_lower) || fatRegex.test(content_lower) || fatassRegex.test(content_lower) || fattyRegex.test(content_lower)) {
      bot_active = true;
      console.log('Matched a keyword, sending response');
      message.channel.send('https://tenor.com/view/berserk-skeleton-damn-bro-you-gif-25852196')
        .then(() => console.log('Response sent successfully'))
        .catch(error => console.error('Error sending response:', error));
    }
    else if (ermRegex.test(content_lower)) {
      bot_active = true;
      console.log('Matched a keyword, sending response');
      message.channel.send('https://tenor.com/view/omori-erm-uuuh-uhh-huh-gif-15238876008948972055')
        .then(() => console.log('Response sent successfully'))
        .catch(error => console.error('Error sending response:', error));
    }
    else if (guhRegex.test(content_lower)) {
      bot_active = true;
      console.log('Matched a keyword, sending response');
      message.channel.send('https://tenor.com/view/guh-gif-25116077')
        .then(() => console.log('Response sent successfully'))
        .catch(error => console.error('Error sending response:', error));
    }
    else if (cumRegex.test(content_lower)) {
      bot_active = true;
      console.log('Matched a keyword, sending response');
      message.channel.send('https://tenor.com/view/anime-magic-senpai-magic-sempai-tejina-senpai-jizz-hands-gif-15061965')
        .then(() => console.log('Response sent successfully'))
        .catch(error => console.error('Error sending response:', error));
    }
    else {
      bot_active = false;
      console.log('No keyword matched');
    }

    if (bot_active) {
      // Add any additional functionality here when the bot is active
      console.log('Bot is active');
    } else {
      console.log('Bot is inactive');
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

// Create a simple HTTP server to prevent Heroku boot timeout
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running\n');
}).listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// Initial login attempt
loginBot();