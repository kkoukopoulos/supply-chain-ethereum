const express = require('express');
const User = require('../models/User');
const router = express.Router();

// Create or update user (matches your registerUser function)
router.post('/', async (req, res) => {
  try {
    const { userAddress, name, role } = req.body;
    
    const user = await User.findOneAndUpdate(
      { userAddress },
      { name, role },
      { upsert: true, new: true }
    );
    
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user by address (matches your returnUser function)
router.get('/:userAddress', async (req, res) => {
  try {
    const user = await User.findOne({ userAddress: req.params.userAddress });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;