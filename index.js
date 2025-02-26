require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const RE2 = require('re2');
const http = require('http');
const axios = require('axios');

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

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'chat') {
      const userMessage = interaction.options.getString('message');
      await interaction.deferReply();

      try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: "gpt-4",
          messages: [{ role: "user", content: userMessage }]
        }, {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        const reply = response.data.choices[0].message.content;
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

    const regexResponses = [
      { regex: new RE2('\\berm+\\b'), response: 'https://tenor.com/view/omori-erm-uuuh-uhh-huh-gif-15238876008948972055' },
      { regex: new RE2('\\bguh+\\b'), response: 'https://tenor.com/view/guh-gif-25116077' },
      { regex: new RE2('\\bglorpshit\\b'), response: 'https://tenor.com/view/glorp-glorpshit-mad-gif-12826934952903770254' },
      { regex: new RE2('\\bmeow\\b'), response: message.author.username === "lyxchee" 
          ? 'https://tenor.com/view/larry-larry-cat-chat-larry-meme-chat-meme-cat-gif-10061556685042597078'
          : 'https://tenor.com/view/big-poo-big-poo-cat-big-poo-cat-gif-8095478642247689280'
      },
      { regex: new RE2('\\bfemboy\\b'), response: message.author.username === "homeo_stasis"
          ? 'https://tenor.com/view/anime-gif-1742373052751281532'
          : null
      }
    ];

    for (const { regex, response } of regexResponses) {
      if (regex.test(content_lower) && response) {
        bot_active = true;
        await sendTemporaryMessage(message, response);
        return;
      }
    }

    bot_active = false;
  });
}

// Helper function to send temporary messages
async function sendTemporaryMessage(message, response) {
  try {
    const msg = await message.channel.send(response);

    // Check if the bot has permission to delete messages before attempting to do so
    if (message.guild.me.permissions.has("MANAGE_MESSAGES")) {
      setTimeout(() => {
        msg.delete().catch(error => console.error('Error deleting response:', error));
      }, 5000);
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Log in the bot
function loginBot() {
  createClient();
  client.login(process.env.DISCORD_TOKEN)
    .then(() => console.log('Logged in successfully'))
    .catch(error => console.error('Error logging in:', error));
}

// Create a simple HTTP server to prevent boot timeout
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running\n');
}).listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

// Initial login attempt
loginBot();
