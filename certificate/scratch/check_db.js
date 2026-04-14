const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const Certificate = require('../backend/models/Certificate');
const User = require('../backend/models/User');

const checkDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const certs = await Certificate.find({});
    console.log(`Total Certificates: ${certs.length}`);
    
    if (certs.length > 0) {
      console.log('Sample Certificate:', JSON.stringify(certs[0], null, 2));
    }

    const users = await User.find({});
    console.log(`Total Users: ${users.length}`);
    if (users.length > 0) {
        console.log('Sample User:', JSON.stringify(users[0], null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkDB();
