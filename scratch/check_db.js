const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the backend folder
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

// Import models
const Certificate = require('../backend/models/Certificate');
const User = require('../backend/models/User');

const checkDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('MONGODB_URI not found in environment');
        process.exit(1);
    }
    console.log('Connecting to:', mongoUri.split('@')[1] || mongoUri); // Hide credentials
    
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const certs = await Certificate.find({}).limit(5).populate('createdBy');
    console.log(`Total Certificates: ${await Certificate.countDocuments({})}`);
    
    if (certs.length > 0) {
      console.log('Last 5 Certificates:');
      certs.forEach(c => {
        console.log({
            id: c.certificateId,
            name: c.name,
            email: c.email,
            batchId: c.batchId,
            createdById: c.createdBy?._id || c.createdBy,
            createdByEmail: c.createdBy?.email,
            createdAt: c.createdAt
        });
      });
    }

    const users = await User.find({}).limit(5);
    console.log(`Total Users: ${await User.countDocuments({})}`);
    users.forEach(u => {
        console.log({ id: u._id, email: u.email, name: u.name });
    });

    process.exit(0);
  } catch (err) {
    console.error('Error details:', err);
    process.exit(1);
  }
};

checkDB();
