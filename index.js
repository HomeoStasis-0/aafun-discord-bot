require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const Groq = require('groq-sdk');
const fetch = require('node-fetch');
const querystring = require('querystring');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const userTokens = {};        // Store Spotify tokens per user
const chatMemory = {};        // Store chat history per user

const app = express();
const PORT = process.env.PORT || 3000;
// Function to exchange the authorization code for tokens
async function exchangeSpotifyCodeForTokens(code) {
  const response = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    client_id: process.env.SPOTIFY_CLIENT_ID,
    client_secret: process.env.SPOTIFY_CLIENT_SECRET,
  }), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return {
    access_token: response.data.access_token,
    refresh_token: response.data.refresh_token,
  };
}
const interactionToUserMap = {}; // Temporary mapping of interaction IDs to user IDs

app.get('/callback', async (req, res) => {
  const { code, state: interactionId } = req.query; // Use 'state' as the interaction ID

  console.log('Callback received:', { code, interactionId }); // Debugging log

  if (!code || !interactionId) {
    console.error('Missing code or interactionId in the callback URL.');
    return res.status(400).json({ error: 'Missing code or interactionId in the callback URL.' });
  }

  // Retrieve the user ID from the interaction-to-user mapping
  const userId = interactionToUserMap[interactionId];
  if (!userId) {
    console.error('No user ID found for interaction ID:', interactionId);
    return res.status(400).json({ error: 'Invalid interaction ID.' });
  }

  try {
    const tokens = await exchangeSpotifyCodeForTokens(code);
    userTokens[userId] = tokens; // Save tokens for the correct user ID

    console.log(`Tokens stored for userId: ${userId}`, tokens); // Debugging log

    // Clean up the mapping to avoid memory leaks
    delete interactionToUserMap[interactionId];

    res.status(200).send('Spotify login successful! You can now use the bot commands.');
  } catch (error) {
    console.error('Error during Spotify callback:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to authenticate with Spotify.' });
  }
});



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
    const userId = interaction.user.id;
  
    if (interaction.commandName === 'spotify') {
      const sub = interaction.options.getSubcommand();
  
      if (sub === 'login') {
        console.log('User ID:', userId);
        const scopes = 'user-top-read';
        const authUrl = `https://accounts.spotify.com/authorize?${querystring.stringify({
          response_type: 'code',
          client_id: process.env.SPOTIFY_CLIENT_ID,
          scope: scopes,
          redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
          state: interaction.id, // Pass interaction ID as state
        })}`;
  
        // Map the interaction ID to the user ID
        interactionToUserMap[interaction.id] = userId;
  
        console.log('Generated Spotify auth URL:', authUrl); // Log the URL for debugging
        console.log('State (interactionId):', interaction.id); // Log the interaction ID being passed as state
  
        try {
          // Acknowledge the interaction immediately
          await interaction.reply({
            content: `Click [here](${authUrl}) to log in to Spotify.`,
            flags: 64, // Use flags instead of ephemeral
          });
        } catch (err) {
          console.error('Error sending interaction reply:', err);
        }
      }
            if (sub === 'toptracks') {
        console.log('User ID:', userId);
        console.log('Stored tokens:', userTokens);
      
        const tokens = userTokens[userId];
        if (!tokens) {
          console.log('Token not found for userId:', userId);
          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: '⚠️ Please log in with `/spotify login` first.',
                flags: 64, // Use flags instead of ephemeral
              });
            }
          } catch (err) {
            console.error('Error sending interaction reply:', err);
          }
          return;
        }
      
        try {
          if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply(); // Acknowledge the interaction
          }
        } catch (e) {
          console.error('Error deferring reply:', e);
          return; // Stop further processing if deferReply fails
        }
      
        try {
          const res = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
            params: { time_range: 'long_term', limit: 5 },
          });
          const items = res.data.items || [];
      
          if (items.length === 0) {
            return interaction.editReply('🎶 No top tracks found.');
          }
      
          const list = items.map((t, i) => `${i + 1}. **${t.name}** by ${t.artists.map(a => a.name).join(', ')}`).join('\n');
          return interaction.editReply(`🎵 Your Top 5 Tracks:\n${list}`);
        } catch (e) {
          console.error('Fetch top tracks error:', e.response?.data || e.message);
          try {
            return interaction.editReply('❌ Failed to fetch top tracks. Try again later.');
          } catch (editError) {
            console.error('Error editing reply:', editError);
          }
        }
      }
    }
    if (interaction.commandName === 'chat') {
      const userMessage = interaction.options.getString('message');
      await interaction.deferReply();

      try {
        if (!chatMemory[userId]) chatMemory[userId] = [];
        const lowerMessage = userMessage.toLowerCase();

        if (lowerMessage.includes("what's your name") || lowerMessage.includes("your name") || lowerMessage.includes("who are you")) {
          return interaction.editReply(`My name is ${client.user.username}!`);
        }

        const userNickname = interaction.member?.nickname || interaction.user.username;
        if (lowerMessage.includes("what's my name") || lowerMessage.includes("who am i")) {
          return interaction.editReply(`Your name is ${userNickname}!`);
        }

        if (lowerMessage.includes("who is your father") || lowerMessage.includes("who's your dad")) {
          return interaction.editReply("My father is Javi, also known as 𝓯𝓻𝓮𝓪𝓴𝔂.");
        }

        chatMemory[userId].push({ role: "user", content: userMessage });
        if (chatMemory[userId].length > 10) chatMemory[userId].shift();

        const response = await groq.chat.completions.create({
          model: "llama3-70b-8192",
          messages: chatMemory[userId],
        });

        const reply = response.choices[0]?.message?.content || "Sorry, I couldn't process that request.";
        const maxLength = 2000;
        for (let i = 0; i < reply.length; i += maxLength) {
          await interaction.followUp(reply.substring(i, i + maxLength));
        }
        chatMemory[userId].push({ role: "assistant", content: reply });
      } catch (err) {
        console.error('Error:', err);
        await interaction.editReply("Sorry, something went wrong.");
      }
    } else if (interaction.commandName === 'clear') {
      chatMemory[userId] = [];
      await interaction.reply("Your chat memory has been cleared.");
    }
  });

  client.on('messageCreate', message => {
    if (message.author.bot) return;
    const content_lower = message.content.toLowerCase();
    const matchers = [
      [/\berm+\b/, 'https://tenor.com/view/omori-erm-uuuh-uhh-huh-gif-15238876008948972055'],
      [/\bguh+\b/, 'https://tenor.com/view/guh-gif-25116077'],
      [/\bglorpshit\b/, 'https://tenor.com/view/glorp-glorpshit-mad-gif-12826934952903770254'],
      [/\bmeow\b/, message.author.username === 'lyxchee'
        ? 'https://tenor.com/view/larry-larry-cat-chat-larry-meme-chat-meme-cat-gif-10061556685042597078'
        : 'https://tenor.com/view/big-poo-big-poo-cat-big-poo-cat-gif-8095478642247689280'],
      [/\bfemboy\b/, message.author.username === 'homeo_stasis' ? 'https://tenor.com/view/anime-gif-1742373052751281532' : null],
      [/\b15\b.*\bgirl\b|\bgirl\b.*\b15\b/, 'minecraft movie incident'],
      [/\bcommunism\b/, 'https://tenor.com/view/cat-asian-chinese-silly-ccp-gif-17771773925036748435'],
      [/\bkys\b|\bkms\b/, 'https://tenor.com/view/high-tier-human-low-tier-god-ltg-love-yourself-lowtiergod-gif-4914755758940822771'],
      [/\bkhanh\b/, 'https://cdn.discordapp.com/attachments/1277012851352932516/1346031380013781043/khan.gif']
    ];

    for (const [regex, url] of matchers) {
      if (regex.test(content_lower) && url) {
        message.channel.send(url).then(msg => setTimeout(() => msg.delete().catch(console.error), 5000));
        return;
      }
    }
  });
}

function loginBot() {
  createClient();
  client.login(process.env.DISCORD_TOKEN)
    .then(() => console.log('Logged in successfully'))
    .catch(console.error);
}

// Default route for non-matching paths
app.get('/', (req, res) => {
  res.send('Bot is running\n');
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

loginBot();
