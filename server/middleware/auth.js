const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'tempsecret_wallpaper';

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Unauthorized: Invalid or expired token' });
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User no longer exists' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Internal server error in authorization' });
  }
}

function requireSuperUser(req, res, next) {
  if (!req.user || req.user.role !== 'superuser') {
    return res.status(403).json({ message: 'Access denied: Super User privilege required' });
  }
  next();
}

module.exports = {
  requireAuth,
  requireSuperUser
};
