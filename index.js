require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const RE2 = require('re2');
const http = require('http');
const axios = require('axios');

let client;
let bot_active = false; // Global variable to track bot's active state

function createClient() {
  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
  });

  client.on('ready', async () => {
    console.log(`We have logged in as ${client.user.tag}`);

    // Register slash commands
    const commands = [
      new SlashCommandBuilder()
        .setName('chat')
        .setDescription('Chat with the bot')
        .addStringOption(option =>
          option.setName('message')
            .setDescription('Your message to the bot')
            .setRequired(true))
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log('Successfully registered slash commands.');
    } catch (error) {
      console.error('Error registering commands:', error);
    }
  });

  client.on('messageCreate', async message => {
    if (message.author.bot) return; // Ignore bot messages
    const content_lower = message.content.toLowerCase();

    // Regex-based responses
    const ermRegex = new RE2('\\berm+\\b');
    const guhRegex = new RE2('\\bguh+\\b');
    const glorpshitRegex = new RE2('\\bglorpshit\\b');
    const meowRegex = new RE2('\\bmeow\\b');
    const femboyRegex = new RE2('\\bfemboy\\b');

    if (ermRegex.test(content_lower)) {
      bot_active = true;
      await sendTemporaryMessage(message, 'https://tenor.com/view/omori-erm-uuuh-uhh-huh-gif-15238876008948972055');
    } else if (guhRegex.test(content_lower)) {
      bot_active = true;
      await sendTemporaryMessage(message, 'https://tenor.com/view/guh-gif-25116077');
    } else if (glorpshitRegex.test(content_lower)) {
      bot_active = true;
      await sendTemporaryMessage(message, 'https://tenor.com/view/glorp-glorpshit-mad-gif-12826934952903770254');
    } else if (meowRegex.test(content_lower) && message.author.username === "lyxchee") {
      bot_active = true;
      await sendTemporaryMessage(message, 'https://tenor.com/view/larry-larry-cat-chat-larry-meme-chat-meme-cat-gif-10061556685042597078');
    } else if (meowRegex.test(content_lower)) {
      bot_active = true;
      await sendTemporaryMessage(message, 'https://tenor.com/view/big-poo-big-poo-cat-big-poo-cat-gif-8095478642247689280');
    } else if (femboyRegex.test(content_lower) && message.author.username === "homeo_stasis") {
      bot_active = true;
      await sendTemporaryMessage(message, 'https://tenor.com/view/anime-gif-1742373052751281532');
    } else {
      bot_active = false;
    }
  });

  // Slash command for chatting with the bot
  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'chat') {
      const userMessage = interaction.options.getString('message');
      await interaction.deferReply();

      try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: "gpt-3.5-turbo",
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
        console.error('Error fetching AI response:', error);
        await interaction.editReply("Sorry, I couldn't process that request.");
      }
    }
  });
}

// Helper function to send temporary messages
async function sendTemporaryMessage(message, response) {
  try {
    const msg = await message.channel.send(response);
    setTimeout(() => {
      msg.delete().catch(error => console.error('Error deleting response:', error));
    }, 5000);
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
