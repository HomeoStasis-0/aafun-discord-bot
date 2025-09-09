const gym = require('../bot/utils/gym');
const fs = require('fs');
const path = require('path');

async function run() {
  const file = path.resolve(__dirname, '..', 'gym_db.json');
  console.log('Resolved gym_db.json path:', file);
  console.log('Attempting to write directly to the file to verify permissions...');
  fs.writeFileSync(file, JSON.stringify({ testWrite: true }, null, 2));
  console.log('Direct write complete. Reading file:');
  console.log(fs.readFileSync(file, 'utf8'));

  console.log('Now calling gym.registerUser to write via util...');
  await gym.registerUser('000000000000000000', ['M','W','F']);
  console.log('After registerUser, file content:');
  console.log(fs.readFileSync(file, 'utf8'));
}
run().catch(err => console.error(err));
