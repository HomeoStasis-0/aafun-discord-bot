require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const RE2 = require('re2');
const http = require('http');
const axios = require('axios');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

let client;
let bot_active = false;

function createClient() {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
  });

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'chat') {
      const userMessage = interaction.options.getString('message');
      await interaction.deferReply();
      try {
        const response = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: userMessage }],
        });
        const reply = response.choices[0]?.message?.content || "Sorry, I couldn't process that request.";
        await interaction.editReply(reply);
      } catch (error) {
        console.error('Error fetching AI response:', error.response?.data || error.message);
        await interaction.editReply("Sorry, I couldn't process that request.");
      }
    }
  });

  client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content_lower = message.content.toLowerCase();
    console.log(`Received message: ${content_lower}`);

    const regexResponses = [
      { regex: new RE2('\berm+\b'), url: 'https://tenor.com/view/omori-erm-uuuh-uhh-huh-gif-15238876008948972055' },
      { regex: new RE2('\bguh+\b'), url: 'https://tenor.com/view/guh-gif-25116077' },
      { regex: new RE2('\bglorpshit\b'), url: 'https://tenor.com/view/glorp-glorpshit-mad-gif-12826934952903770254' },
      { regex: new RE2('\bmeow\b'), url: 'https://tenor.com/view/big-poo-big-poo-cat-big-poo-cat-gif-8095478642247689280' },
      { regex: new RE2('\bmeow\b'), url: 'https://tenor.com/view/larry-larry-cat-chat-larry-meme-chat-meme-cat-gif-10061556685042597078', condition: user => user === "lyxchee" },
      { regex: new RE2('\bfemboy\b'), url: 'https://tenor.com/view/anime-gif-1742373052751281532', condition: user => user === "homeo_stasis" }
    ];

    for (let { regex, url, condition } of regexResponses) {
      if (regex.test(content_lower) && (!condition || condition(message.author.username))) {
        bot_active = true;
        console.log('Matched a keyword, sending response');
        try {
          const msg = await message.channel.send(url);
          setTimeout(async () => {
            try {
              await msg.delete();
              console.log('Response deleted');
            } catch (error) {
              console.error('Error deleting response:', error);
            }
          }, 5000);
        } catch (error) {
          console.error('Error sending response:', error);
        }
        return;
      }
    }

    bot_active = false;
    console.log('No keyword matched');
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
