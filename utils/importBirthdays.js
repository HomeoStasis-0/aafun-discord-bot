const { Client } = require('pg');

async function createTableIfNotExists() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS birthdays (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      birthday DATE NOT NULL
    );
  `);
  // Try to add unique constraint if not present
  try {
    await client.query('ALTER TABLE birthdays ADD CONSTRAINT unique_name UNIQUE (name);');
  } catch (err) {
    // Ignore error if constraint already exists
    if (err.code !== '42P07' && !String(err.message).includes('already exists')) {
      throw err;
    }
  }
  await client.end();
}

createTableIfNotExists()
  .then(() => {
    console.log('Table created or already exists.');
    importBirthdays().catch(err => {
      console.error('Error importing birthdays:', err);
    });
  })
  .catch(err => {
    console.error('Error creating table:', err);
  });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function importBirthdays() {
  const filePath = path.join(__dirname, '..', 'birthdays.txt');
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);

  for (const line of lines) {
    const [name, birthday] = line.split(':');
    if (name && birthday) {
      // Normalize date format (YYYY-MM-DD)
      const date = birthday.replace(
        /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/,
        (m, y, mo, d) => `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
      );
      await pool.query(
        'INSERT INTO birthdays (name, birthday) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET birthday = $2',
        [name, date]
      );
      console.log(`Imported: ${name} -> ${date}`);
    }
  }
  await pool.end();
  console.log('Import complete.');
}

// importBirthdays is now called after table creation above
