const User = require('./models/User');

async function testLoginFallback() {
  console.log('Testing User.findOne fallback...');
  const user = await User.findOne({ email: 'kirranvijay@gmail.com' });
  console.log('Result for kirranvijay@gmail.com:', user);

  const allUsers = await User.find({});
  console.log(`Total users returned: ${allUsers.length}`);
  process.exit(0);
}

testLoginFallback();
