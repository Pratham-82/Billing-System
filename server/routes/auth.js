const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { requireAuth, requireSuperUser } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tempsecret_wallpaper';

// Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get current user profile
router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// --- ADMIN / SUPERUSER MANAGEMENT ROUTES ---

// List all users
router.get('/users', requireAuth, requireSuperUser, async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ username: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new user (superuser only)
router.post('/users', requireAuth, requireSuperUser, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username?.trim() || !password?.trim()) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const roles = ['superuser', 'normal'];
    if (!role || !roles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role selection' });
    }

    const existingUser = await User.findOne({ username: username.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ message: 'Username is already taken' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      username: username.toLowerCase().trim(),
      password: hashedPassword,
      role
    });

    res.status(201).json({
      id: newUser._id,
      username: newUser.username,
      role: newUser.role,
      createdAt: newUser.createdAt
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete user account (superuser only)
router.delete('/users/:id', requireAuth, requireSuperUser, async (req, res) => {
  try {
    const userIdToDelete = req.params.id;
    
    // Prevent self deletion
    if (req.user._id.toString() === userIdToDelete) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const deletedUser = await User.findByIdAndDelete(userIdToDelete);
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
