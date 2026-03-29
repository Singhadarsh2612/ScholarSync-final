const jwt = require('jsonwebtoken');
const Expert = require('../models/Expert');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: '7d',
  });
};

// @desc    Login expert
// @route   POST /api/auth/login
// @access  Public
const loginExpert = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const expert = await Expert.findOne({ email });
    if (!expert) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await expert.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Mark as online on login
    expert.isOnline = true;
    await expert.save();

    res.json({
      token: generateToken(expert._id),
      expert: expert.toJSON(),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Logout expert
// @route   POST /api/auth/logout
// @access  Private
const logoutExpert = async (req, res) => {
  try {
    await Expert.findByIdAndUpdate(req.expert._id, { isOnline: false });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get current expert profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  res.json(req.expert);
};

// @desc    Update expert profile (name, description)
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, description } = req.body;
    const expert = await Expert.findById(req.expert._id);

    if (name) expert.name = name;
    if (description) expert.description = description;

    await expert.save();
    res.json(expert.toJSON());
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { loginExpert, logoutExpert, getMe, updateProfile };
