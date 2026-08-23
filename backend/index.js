const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

// Load env vars FIRST before any other requires
dotenv.config();

const { initFirebase } = require('./config/firebase');
const { initCloudinary } = require('./config/cloudinary');
const { startFormPoller } = require('./jobs/formPoller');
const { getBrevoKeysCount } = require('./utils/brevoPool');

// Initialize Firebase + Cloudinary
initFirebase();
initCloudinary();

// Import Firestore models (after Firebase init)
const User = require('./models/User');
const Certificate = require('./models/Certificate');
const EmailLog = require('./models/EmailLog');

const app = express();

// CORS
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

// Health route for Render keep-alive
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'DigiCertify Firebase Backend', time: new Date().toISOString() });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/user', require('./routes/user'));
app.use('/api/template', require('./routes/template'));
app.use('/api/certificate', require('./routes/certificate'));
app.use('/api/verify', require('./routes/verify'));
app.use('/api/user-feedback', require('./routes/feedback'));

// Enforce single admin account on startup
const createDefaultAdmin = async () => {
  try {
    const adminEmail = 'kirranvijay@gmail.com';
    const adminPassword = 'Kirranst@14';

    // Demote any other admins to user
    await User.updateMany(
      { email: { $ne: adminEmail }, role: 'admin' },
      { $set: { role: 'user' } }
    );

    const admin = await User.findOne({ email: adminEmail });
    if (admin) {
      // Update password and ensure admin role
      const bcrypt = require('bcrypt');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(adminPassword, salt);
      await User.save({ ...admin, passwordHash, role: 'admin' });
      console.log('Primary admin credentials verified and updated.');
    } else {
      await User.create({ name: 'Super Admin', email: adminEmail, password: adminPassword, role: 'admin' });
      console.log('Primary admin created successfully.');
    }
  } catch (err) {
    console.error('Error enforcing admin credentials:', err.message);
  }
};

const PORT = process.env.PORT || 5000;

// Start server: init admin → diagnostics → poller → listen
(async () => {
  try {
    await createDefaultAdmin();

    // Diagnostic counts
    try {
      const usersCount = await User.countDocuments();
      const certsSnap = await Certificate.find({});
      const certsCount = certsSnap.length;
      const logsSnap = await EmailLog.find({});
      const logsCount = logsSnap.length;
      const brevoKeys = getBrevoKeysCount();
      console.log(`\n==================================================`);
      console.log(`[Database Diagnosis — Firestore]`);
      console.log(`  - Total Users in Firestore: ${usersCount}`);
      console.log(`  - Total Certificates in Firestore: ${certsCount}`);
      console.log(`  - Total Email Logs in Firestore: ${logsCount}`);
      console.log(`[Brevo Pool]`);
      console.log(`  - Active Brevo API Keys: ${brevoKeys} key(s) loaded`);
      console.log(`  - Daily email capacity: ~${brevoKeys * 300} emails/day`);
      console.log(`==================================================\n`);
    } catch (err) {
      console.error('Error fetching diagnostic counts:', err.message);
    }

    startFormPoller();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
})();
