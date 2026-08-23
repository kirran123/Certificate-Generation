const { initFirebase, getDb } = require('./config/firebase');
const User = require('./models/User');
initFirebase();

async function testUsers() {
  const users = await User.find({});
  console.log(`Total Users in Firestore: ${users.length}`);
  console.log('Users:', users);
  process.exit(0);
}

testUsers();
