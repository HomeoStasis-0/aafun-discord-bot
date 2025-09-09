const { Client, GatewayIntentBits } = require('discord.js');
const registerEvents = require('./events');

function createClient() {
  if (global.__AAFUN_DISCORD_CLIENT) {
    console.log('[client] Reusing existing client singleton');
    return global.__AAFUN_DISCORD_CLIENT;
  }
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent
    ]
    ,
    partials: ['MESSAGE','CHANNEL','REACTION']
  });
  // Added instance metadata
  client.__instanceInfo = {
    pid: process.pid,
    startedAt: new Date(),
    id: `${process.pid}-${Math.random().toString(36).slice(2, 8)}`
  };
  console.log(`[client] Created instance id=${client.__instanceInfo.id} pid=${client.__instanceInfo.pid}`);
  registerEvents(client);
  global.__AAFUN_DISCORD_CLIENT = client;
  return client;
}

module.exports = createClient;
