const express = require('express');
const router = express.Router();
const { getAllExperts, getExpertBySubject } = require('../controllers/expertController');

router.get('/', getAllExperts);
router.get('/subject/:subject', getExpertBySubject);

module.exports = router;
