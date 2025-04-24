require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const RE2 = require('re2');
const http = require('http');
const axios = require('axios');
const express = require('express');
const Groq = require('groq-sdk');
const fetch = require('node-fetch');
const querystring = require('querystring');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
let client;
let bot_active = false;
const userTokens = {}; // Store user tokens in memory
const app = express();

// Function to refresh the Spotify access token
async function refreshAccessToken(userId) {
  const refreshToken = userTokens[userId]?.refresh_token;

  if (!refreshToken) {
    console.error(`No refresh token found for user ${userId}`);
    throw new Error('Refresh token not found');
  }

  try {
    const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET,
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, expires_in } = tokenResponse.data;

    // Update the user's tokens
    userTokens[userId].access_token = access_token;
    userTokens[userId].expires_at = Date.now() + expires_in * 1000;

    console.log(`Access token refreshed for user ${userId}`);
    return access_token;
  } catch (err) {
    console.error(`Error refreshing access token for user ${userId}:`, err.response?.data || err.message);
    throw new Error('Failed to refresh access token');
  }
}

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state; // This is the userId

  if (!code || !state) {
    console.error('Missing code or state in the callback request.');
    return res.status(400).send('Missing code or state');
  }

  try {
    console.log('Exchanging code for token...');
    const tokenResponse = await axios.post('https://accounts.spotify.com/api/token', querystring.stringify({
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

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    console.log('Token exchange successful:', { access_token, refresh_token });

    // Store the tokens for the user
    userTokens[state] = {
      access_token,
      refresh_token,
      expires_at: Date.now() + expires_in * 1000, // Calculate expiration time
    };

    console.log('User tokens updated:', userTokens[state]);

    res.send('You have successfully logged in to Spotify! You can now use the /spotify toptracks command.');
  } catch (err) {
    console.error('Error exchanging code for token:', err.response?.data || err.message);
    res.status(500).send('Failed to log in to Spotify.');
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
        const scopes = 'user-top-read';
        const authUrl = `https://accounts.spotify.com/authorize?${querystring.stringify({
          response_type: 'code',
          client_id: process.env.SPOTIFY_CLIENT_ID,
          scope: scopes,
          redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
          state: userId,
        })}`;
      
        console.log('Generated Spotify auth URL:', authUrl); // Log the URL for debugging
      
        // Send the login link as an ephemeral message
        await interaction.reply({
          content: `Click [here](${authUrl}) to log in to Spotify.`,
          ephemeral: true, // Makes the message visible only to the user
        });
      }       if (sub === 'toptracks') {
        let token = userTokens[userId]?.access_token;
      
        // Check if the token is expired
        if (!token || Date.now() >= userTokens[userId]?.expires_at) {
          try {
            console.log(`Access token expired for user ${userId}. Refreshing...`);
            token = await refreshAccessToken(userId);
          } catch (err) {
            return interaction.reply("Failed to refresh your Spotify access token. Please log in again using `/spotify login`.");
          }
        }
      
        try {
          const topTracks = await getTopTracks();
      
          if (!topTracks || topTracks.length === 0) {
            return interaction.reply("No top tracks found. Please listen to more music on Spotify!");
          }
      
          const embeds = topTracks.map(track => ({
            title: track.name,
            url: track.external_urls.spotify,
            description: `By ${track.artists.map(artist => artist.name).join(', ')}`,
            thumbnail: { url: track.album.images[0]?.url },
            footer: { text: `Album: ${track.album.name}` },
          }));
      
          await interaction.reply({ embeds });
        } catch (err) {
          console.error('Spotify error:', err);
          await interaction.reply("Failed to fetch top tracks. Please ensure you are logged in to Spotify.");
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

const PORT = process.env.PORT || 3000;

// Default route for non-matching paths
app.get('/', (req, res) => {
  res.send('Bot is running\n');
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

loginBot();
