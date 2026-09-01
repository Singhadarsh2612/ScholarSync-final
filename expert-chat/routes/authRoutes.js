const express = require('express');
const router = express.Router();
const { loginExpert, logoutExpert, getMe, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/login', loginExpert);
router.post('/logout', protect, logoutExpert);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

module.exports = router;
