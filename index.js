require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const Groq = require('groq-sdk');
const { EmbedBuilder } = require('discord.js');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const userTokens = {};
const chatMemory = {};
const interactionToUserMap = {};

const app = express();
const PORT = process.env.PORT || 3000;

async function exchangeSpotifyCodeForTokens(code) {
  try {
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
  } catch (error) {
    console.error('Error exchanging Spotify code for tokens:', error.response?.data || error.message);
    throw new Error('Failed to exchange Spotify code for tokens.');
  }
}

app.get('/callback', async (req, res) => {
  const { code, state: interactionId } = req.query;
  console.log('Callback received:', { code, interactionId });

  if (!code || !interactionId) {
    console.error('Missing code or interactionId in the callback URL.');
    return res.status(400).json({ error: 'Missing code or interactionId in the callback URL.' });
  }

  const userId = interactionToUserMap[interactionId];
  if (!userId) {
    console.error('Invalid interaction ID:', interactionId);
    return res.status(400).json({ error: 'Invalid interaction ID.' });
  }

  try {
    const tokens = await exchangeSpotifyCodeForTokens(code);
    userTokens[userId] = tokens;
    delete interactionToUserMap[interactionId];
    console.log(`Tokens stored for userId: ${userId}`, tokens);
    res.status(200).send('Spotify login successful! You can now use the bot commands.');
  } catch (error) {
    console.error('Error during Spotify callback:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to authenticate with Spotify.' });
  }
});

function createClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.on('ready', () => {
    console.log(`We have logged in as ${client.user.tag}`);
  });

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
          state: interaction.id,
        })}`;

        interactionToUserMap[interaction.id] = userId;

        try {
          await interaction.reply({
            content: `Click [here](${authUrl}) to log in to Spotify.`,
            flags: 64,
          });
        } catch (err) {
          console.error('Error sending interaction reply:', err);
        }
      }

      if (sub === 'toptracks') {
        const tokens = userTokens[userId];
        if (!tokens) {
          try {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply({
                content: '⚠️ Please log in with `/spotify login` first.',
                flags: 64,
              });
            }
          } catch (err) {
            console.error('Error sending interaction reply:', err);
          }
          return;
        }

        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.deferReply();
          }
        } catch (e) {
          console.error('Error deferring reply:', e);
          return;
        }

          const res = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
            params: { time_range: 'short_term', limit: 5 },
          });

          const items = res.data.items || [];
          if (items.length === 0) {
            return interaction.editReply('🎶 No top tracks found.');
          }

          
          const embeds = items.map((t, i) => 
            new EmbedBuilder()
              .setColor('#1DB954') // Spotify green
              .setTitle(`${i + 1}. ${t.name}`)
              .setDescription(`By ${t.artists.map(a => a.name).join(', ')}\nAlbum: ${t.album.name}`)
              .setThumbnail(t.album.images[0]?.url || null) // Small album cover
          );
          
          await interaction.editReply({ content: 'Your Top 5 Tracks 👾:', embeds });
      }
    }

    if (interaction.commandName === 'chat') {
      await interaction.deferReply();
      const userMessage = interaction.options.getString('message');

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
    }

    if (interaction.commandName === 'clear') {
      chatMemory[userId] = [];
      await interaction.reply("Your chat memory has been cleared.");
    }
  });

  client.on('messageCreate', async message => {
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
        try {
          const sentMessage = await message.channel.send(url);
          setTimeout(() => {
            sentMessage.delete().catch(err => console.error('Error deleting message:', err));
          }, 5000);
        } catch (err) {
          console.error('Error sending message:', err);
        }
        return;
      }
    }
  });

  return client;
}

function loginBot() {
  const client = createClient();
  client.login(process.env.DISCORD_TOKEN)
    .then(() => console.log('Logged in successfully'))
    .catch(console.error);
}

app.get('/', (req, res) => {
  res.send('Bot is running\n');
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

loginBot();
