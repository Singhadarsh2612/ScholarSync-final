const express = require('express');
const router = express.Router();
const { connectUser, getAllExperts, connectAndRedirect } = require('../controllers/connectController');

// @route   GET /api/connect/all
router.get('/all', getAllExperts);

// @route   GET /api/connect/redirect
router.get('/redirect', connectAndRedirect);

// @route   GET /api/connect
router.get('/', connectUser);

module.exports = router;
