const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ── Fast path: JWT contains name/email/role (new tokens) ──────────────
    // Avoids a DB read on every authenticated request.
    if (decoded.name && decoded.email && decoded.role) {
      req.user = {
        _id: decoded.id,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role,
      };
      return next();
    }

    // ── Fallback: old tokens that only have `id` — hit DB once ────────────
    // This branch is only reached for existing sessions with old JWTs.
    // After users re-login, all tokens will take the fast path.
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'Not authorized, user not found' });
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' });
  }
};

module.exports = { protect, admin };
