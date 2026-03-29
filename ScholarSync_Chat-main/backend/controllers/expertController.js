const Expert = require('../models/Expert');

// @desc    Get all experts (public - status only)
// @route   GET /api/experts
// @access  Public
const getAllExperts = async (req, res) => {
  try {
    const experts = await Expert.find({}, 'name subject subjectLabel description isOnline');
    res.json(experts);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get expert by subject
// @route   GET /api/experts/subject/:subject
// @access  Public
const getExpertBySubject = async (req, res) => {
  try {
    const expert = await Expert.findOne(
      { subject: req.params.subject },
      'name subject subjectLabel description isOnline'
    );
    if (!expert) return res.status(404).json({ message: 'Expert not found' });
    res.json(expert);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getAllExperts, getExpertBySubject };
