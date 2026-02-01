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

// Top-level safety: log and continue on uncaught async errors to avoid process exit
process.on('unhandledRejection', (reason) => {
  console.error('[process] UnhandledRejection:', reason && reason.stack ? reason.stack : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[process] UncaughtException:', err && err.stack ? err.stack : err);
});
