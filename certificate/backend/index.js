const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const User = require('./models/User');
const { startFormPoller } = require('./jobs/formPoller');

// Load env vars
dotenv.config();

// Connect DB then start background jobs
connectDB().then(() => {
  startFormPoller();
}).catch(() => {
  // If connectDB doesn't return a promise, start after a brief delay
  setTimeout(startFormPoller, 3000);
});

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
// Serve uploads folder as static
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/user', require('./routes/user'));
app.use('/api/template', require('./routes/template'));
app.use('/api/certificate', require('./routes/certificate'));
app.use('/api/verify', require('./routes/verify'));
app.use('/api/user-feedback', require('./routes/feedback'));

// Create default admin on server start
// Enforce single admin on server start
const createDefaultAdmin = async () => {
  try {
    const adminEmail = 'kirranvijay@gmail.com';
    const adminPassword = 'kirran14';

    // 1. Demote any other admins to user
    await User.updateMany(
      { email: { $ne: adminEmail }, role: 'admin' },
      { role: 'user' }
    );

    // 2. Ensure the primary admin exists and has the correct password
    let admin = await User.findOne({ email: adminEmail });
    
    if (admin) {
      admin.password = adminPassword;
      admin.role = 'admin';
      await admin.save();
      console.log('Primary admin credentials verified and updated.');
    } else {
      await User.create({
        name: 'Super Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin'
      });
      console.log('Primary admin created successfully.');
    }
  } catch (err) {
    console.error('Error enforcing admin credentials:', err);
  }
};
createDefaultAdmin();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
