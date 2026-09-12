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

// Middleware — allow localhost dev, production frontend, and dynamic origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
}));

app.options('*', cors());

app.use(express.json());
// Serve uploads folder as static with explicit CORS for canvas usage
app.use('/uploads', express.static('uploads', {
  setHeaders: (res) => {
    res.set('Access-Control-Allow-Origin', '*');
  }
}));

// Health check endpoints for uptime monitoring (Render, UptimeRobot, etc.)
app.get('/health', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));
app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));

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

// Start listening IMMEDIATELY so Render / UptimeRobot health check monitors pass instantly
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Connect DB → seed admin → start background jobs asynchronously
connectDB().then(async () => {
  await createDefaultAdmin();
  startFormPoller();
}).catch((err) => {
  console.error('Failed background initialization:', err.message);
});
