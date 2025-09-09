// scripts/inspect_pg.js
// Simple DB inspector: prints `users` and `pending` rows using DATABASE_URL

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
    console.log('Connected to Postgres; fetching users...');
    const ures = await client.query('SELECT userId, schedule, streak, lastcheck as lastCheck, checks FROM users ORDER BY userId LIMIT 100');
    console.log('users:', JSON.stringify(ures.rows, null, 2));
    const pres = await client.query('SELECT messageid as messageId, userid as userId, createdat as createdAt FROM pending ORDER BY messageid LIMIT 100');
    console.log('pending:', JSON.stringify(pres.rows, null, 2));
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error('PG error:', err.message || err);
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
}

main();
