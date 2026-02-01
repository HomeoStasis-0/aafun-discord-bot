const { Pool } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('No DATABASE_URL in environment.');
    process.exit(2);
  }
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    const res = await pool.query('SELECT name, birthday FROM birthdays ORDER BY name LIMIT 50');
    console.log(`Found ${res.rowCount} rows:`);
    for (const r of res.rows) {
      console.log(r);
    }
  } catch (err) {
    console.error('Query error:', err && err.stack ? err.stack : err);
    process.exit(1);
  } finally {
    await pool.end().catch(() => {});
  }
}

main();
