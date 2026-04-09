// scripts/validate_birthdays.js
// Validate the birthdays table in the Heroku Postgres database.
// Use with: heroku run node scripts/validate_birthdays.js --app aafun-discord-app

const { Client } = require('pg');

function isDiscordUserId(value) {
  return /^\d{15,25}$/.test(String(value || ''));
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('No DATABASE_URL in env');
    process.exit(2);
  }

  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to Postgres; checking birthdays...');

    const result = await client.query('SELECT id, name, birthday FROM birthdays ORDER BY name');
    const rows = result.rows || [];
    const invalid = rows.filter(row => !isDiscordUserId(row.name));

    console.log(`Found ${rows.length} birthday rows.`);
    if (!rows.length) {
      console.log('No birthday rows found.');
      await client.end();
      process.exit(0);
    }

    if (!invalid.length) {
      console.log('All birthday names look like valid Discord user IDs.');
      await client.end();
      process.exit(0);
    }

    console.log('Invalid birthday rows:');
    for (const row of invalid) {
      console.log(JSON.stringify({ id: row.id, name: row.name, birthday: row.birthday }));
    }

    await client.end();
    process.exit(1);
  } catch (err) {
    console.error('PG error:', err && err.message ? err.message : err);
    try { await client.end(); } catch (_) {}
    process.exit(1);
  }
}

main();