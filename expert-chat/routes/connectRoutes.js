const express = require('express');
const router = express.Router();
const { connectUser, getAllExperts, connectAndRedirect } = require('../controllers/connectController');

router.get('/all', getAllExperts);

router.get('/redirect', connectAndRedirect);

router.get('/', connectUser);

module.exports = router;
