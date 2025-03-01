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
    console.log(`We have logged in as ${client.user.tag}`);
  });

  const chatMemory = {}; 

  client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
  
    if (interaction.commandName === 'chat') {
      const userMessage = interaction.options.getString('message');
      await interaction.deferReply();
  
      try {
        const userId = interaction.user.id;
  
        if (!chatMemory[userId]) {
          chatMemory[userId] = [];
        }
  
        // Convert message to lowercase for case-insensitive comparison
        const lowerMessage = userMessage.toLowerCase();
  
        // Predefined responses
        if (
          lowerMessage.includes("what's your name") ||
          lowerMessage.includes("what is your name") ||
          lowerMessage.includes("who are you") ||
          lowerMessage.includes("your name") ||
          lowerMessage.includes("who you are")
        ) {
          await interaction.editReply(`My name is ${client.user.username}!`);
          return;
        }
  
        const userNickname = interaction.member?.nickname || interaction.user.username;
        if (
          lowerMessage.includes("what's my name") ||
          lowerMessage.includes("what is my name") ||
          lowerMessage.includes("who am i")
        ) {
          await interaction.editReply(`Your name is ${userNickname}!`);
          return;
        }
  
        // Custom response for "who is your father"
        if (
          lowerMessage.includes("who is your father") ||
          lowerMessage.includes("who's your father") ||
          lowerMessage.includes("who is your dad") ||
          lowerMessage.includes("who's your dad")
        ) {
          await interaction.editReply("My father is Javi, also known as 𝓯𝓻𝓮𝓪𝓴𝔂.");
          return;
        }
  
        // Store message in user memory
        chatMemory[userId].push({ role: "user", content: userMessage });
  
        if (chatMemory[userId].length > 10) {
          chatMemory[userId].shift();
        }
  
        // Get AI response with memory
        const response = await groq.chat.completions.create({
          model: "mixtral-8x7b-32768",
          messages: chatMemory[userId],
        });
  
        const reply = response.choices[0]?.message?.content || "Sorry, I couldn't process that request.";
        const maxLength = 2000;
        const replyChunks = [];
        
        // Split the reply into chunks if it exceeds 2000 characters
        for (let i = 0; i < reply.length; i += maxLength) {
          replyChunks.push(reply.substring(i, i + maxLength));
        }
        
        // Store bot's response in memory
        chatMemory[userId].push({ role: "assistant", content: reply });
        
        // Send the reply chunks one by one
        // for (const chunk of replyChunks) {
        //   await interaction.followUp(chunk);
        // }
        
        // Remove the final call to editReply
        // await interaction.editReply(reply);
      } catch (error) {
        console.error('Error fetching AI response:', error.response?.data || error.message);
        await interaction.editReply("Sorry, I couldn't process that request.");
      }
    }
  });

  client.on('messageCreate', message => {
    console.log(`Received message: ${message.content}`);  // Log received messages

    if (message.author.id === client.user.id) {
      console.log('Ignoring message from the bot itself');
      return;
    }

    const content_lower = message.content.toLowerCase();
    console.log(`Message content in lowercase: ${content_lower}`);

    const ermRegex = new RE2('\\berm+\\b');
    const guhRegex = new RE2('\\bguh+\\b');
    const glorpshitRegex = new RE2('\\bglorpshit\\b');
    const meowRegex = new RE2('\\bmeow\\b');
    const femboyRegex = new RE2('\\bfemboy\\b');

    console.log(`Testing regex patterns against message content...`);

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
    else if (meowRegex.test(content_lower)) {
      bot_active = true
      console.log('Matched a keyword, sending response');
      message.channel.send('https://tenor.com/view/big-poo-big-poo-cat-big-poo-cat-gif-8095478642247689280')
      .then(msg => {
        console.log('Response sent successfully');
        setTimeout(() => {
          msg.delete()
            .then(() => console.log('Response deleted'))
            .catch(error => console.error('Error deleting response:', error));
        }, 5000);
      })
    }
    else if (femboyRegex.test(content_lower) && message.author.username == "homeo_stasis") {
      bot_active = true
      console.log('Matched a keyword, sending response');
      message.channel.send('https://tenor.com/view/anime-gif-1742373052751281532')
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