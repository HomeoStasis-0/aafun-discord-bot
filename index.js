const createClient = require('./bot/client');
const { DISCORD_TOKEN } = require('./config');
require('./server');

console.log(`[startup] PID=${process.pid} starting index.js`);
const client = createClient();
if (client.isReady?.()) {
  console.log('[startup] Client already ready (singleton reuse)');
}

client.login(DISCORD_TOKEN).then(() => {
  console.log('✅ Discord login OK');
}).catch(err => {
  console.error('Discord login failed:', err);
});
