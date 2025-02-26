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

    // const fatRegex = new RE2('\\bfat\\b');
    // const fatassRegex = new RE2('\\bfatass\\b');
    // const fattyRegex = new RE2('\\bfatty\\b');
    // const yourMomRegex = new RE2('\\byour mom\\b');
    // const urMomRegex = new RE2('\\bur mom\\b');
    const ermRegex = new RE2('\\berm+\\b');
    const guhRegex = new RE2('\\bguh+\\b');
    // const cumRegex = new RE2('\\b(cum|cums|cumming|bust|busting|busted|cream|creams|creaming|creamed)\\b', 'i');
    const glorpshitRegex = new RE2('\\bglorpshit\\b');
    const meowRegex = new RE2('\\bmeow\\b');


    console.log(`Testing regex patterns against message content...`);
    // if (urMomRegex.test(content_lower) || yourMomRegex.test(content_lower) || fatRegex.test(content_lower) || fatassRegex.test(content_lower) || fattyRegex.test(content_lower)) {
    //   bot_active = true;
    //   console.log('Matched a keyword, sending response');
    //   message.channel.send('https://tenor.com/view/berserk-skeleton-damn-bro-you-gif-25852196')
    //     .then(() => console.log('Response sent successfully'))
    //     .catch(error => console.error('Error sending response:', error));
    // }
    if (ermRegex.test(content_lower)) {
      bot_active = true;
      console.log('Matched a keyword, sending response');
      message.channel.send('https://tenor.com/view/omori-erm-uuuh-uhh-huh-gif-15238876008948972055')
      .then(msg => {
        console.log('Response sent successfully');
        setTimeout(() => {
          msg.delete()
            .then(() => console.log('Response deleted'))
            .catch(error => console.error('Error deleting response:', error));
        }, 5000);
      })
    }
    else if (guhRegex.test(content_lower)) {
      bot_active = true;
      console.log('Matched a keyword, sending response');
      message.channel.send('https://tenor.com/view/guh-gif-25116077')
      .then(msg => {
        console.log('Response sent successfully');
        setTimeout(() => {
          msg.delete()
            .then(() => console.log('Response deleted'))
            .catch(error => console.error('Error deleting response:', error));
        }, 5000);
      })
    }
    // else if (cumRegex.test(content_lower)) {
    //   bot_active = true;
    //   console.log('Matched a keyword, sending a random response');
    
    //   // Array of GIF URLs
    //   const cumGifs = [
    //     'https://tenor.com/view/anime-magic-senpai-magic-sempai-tejina-senpai-jizz-hands-gif-15061965',
    //     'https://tenor.com/view/todo-clap-orgasm-daddy-yes-boogie-woogie-gif-21117228',
    //     'https://tenor.com/view/nut-orgasm-catgirl-anime-nyanners-gif-24080350',
    //     'https://tenor.com/view/hehehe-creepy-lovely-excited-orgasm-gif-15541428',
    //     'https://tenor.com/view/anime-watamote-orgasm-twitch-gif-23286923',
    //     'https://tenor.com/view/catgirl-nekomimi-sexy-anime-gif-20620042',
    //     'https://tenor.com/view/kiss-anime-gif-25489406'
    //   ];
    
    //   const randomGif = cumGifs[Math.floor(Math.random() * cumGifs.length)];
    
    //   message.channel.send(randomGif)
    //     .then(() => console.log('Response sent successfully'))
    //     .catch(error => console.error('Error sending response:', error));
    // }
    
    else if (glorpshitRegex.test(content_lower)) {
      bot_active = true
      console.log('Matched a keyword, sending response');
      message.channel.send('https://tenor.com/view/glorp-glorpshit-mad-gif-12826934952903770254')
      .then(msg => {
        console.log('Response sent successfully');
        setTimeout(() => {
          msg.delete()
            .then(() => console.log('Response deleted'))
            .catch(error => console.error('Error deleting response:', error));
        }, 5000);
      })
    }
    else if (meowRegex.test(content_lower) && message.author.username == "lyxchee") {
      bot_active = true
      console.log('Matched a keyword, sending response');
      message.channel.send('https://tenor.com/view/larry-larry-cat-chat-larry-meme-chat-meme-cat-gif-10061556685042597078')
      .then(msg => {
        console.log('Response sent successfully');
        setTimeout(() => {
          msg.delete()
            .then(() => console.log('Response deleted'))
            .catch(error => console.error('Error deleting response:', error));
        }, 5000);
      })
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