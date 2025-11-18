// scripts/finalize_pending.js
// Promote all pending rows into users table with empty schedule, then remove the pending rows.
// Use with: heroku run node scripts/finalize_pending.js --app aafun-discord-app

const { Client } = require('pg');

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('No DATABASE_URL in env');
    process.exit(2);
  }

  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to Postgres; fetching pending rows...');
    const pres = await client.query('SELECT messageid as messageId, userid as userId, createdat as createdAt FROM pending');
    if (!pres.rows.length) {
      console.log('No pending rows found.');
      await client.end();
      process.exit(0);
    }
    for (const p of pres.rows) {
      console.log('Promoting pending:', p);
      // Insert a user row with empty schedule/checks if not exists
      await client.query(
        `INSERT INTO users (userId, schedule, streak, lastcheck, checks)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (userId) DO NOTHING`,
        [p.userid || p.userId, JSON.stringify([]), 0, null, JSON.stringify({})]
      );
      // Delete the pending row
      await client.query('DELETE FROM pending WHERE messageid = $1', [p.messageid || p.messageId]);
    }
    console.log('Finished promoting pending rows.');
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('PG error:', err.message || err);
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
}

main();
