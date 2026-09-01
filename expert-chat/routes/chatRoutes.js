const express = require('express');
const router = express.Router();
const { getRoomInfo, getMessages, uploadFile, getExpertRooms, getUserRooms, getRoomsBySubject, deleteRoom } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/room/:roomId', getRoomInfo);
router.get('/messages/:roomId', getMessages);
router.post('/upload', upload.single('file'), uploadFile);
router.get('/expert-rooms', protect, getExpertRooms);
router.get('/user-rooms/:studentId', getUserRooms);
router.get('/subject-rooms/:subject', getRoomsBySubject);
router.delete('/room/:roomId', deleteRoom);

module.exports = router;
