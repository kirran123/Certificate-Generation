const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const connectDB = require('./config/db');
const User = require('./models/User');
const { startFormPoller } = require('./jobs/formPoller');

// Load env vars
dotenv.config();

const app = express();

// Middleware — allow both localhost dev and production frontend
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

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

// Enforce single admin account on startup
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

const PORT = process.env.PORT || 5000;

// Connect DB → seed admin → start background jobs → listen
connectDB().then(async () => {
  await createDefaultAdmin();
  startFormPoller();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
