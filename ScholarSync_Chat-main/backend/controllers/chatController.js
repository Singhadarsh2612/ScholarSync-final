const Message = require('../models/Message');
const ChatRoom = require('../models/ChatRoom');
const Expert = require('../models/Expert');
const path = require('path');

// @desc    Get chat room info + expert details
// @route   GET /api/chat/room/:roomId
// @access  Public
// @desc    Get chat room info + expert details
// @route   GET /api/chat/room/:roomId?studentId=...
// @access  Public
const getRoomInfo = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { studentId } = req.query;

    let room = await ChatRoom.findOne({ roomId }).populate('expertId', '-password');
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

    // If studentId provided and room has none, claim it
    if (studentId && !room.studentId) {
      room.studentId = studentId;
      await room.save();
    }

    res.json({
      roomId: room.roomId,
      subject: room.subject,
      expert: room.expertId,
      studentId: room.studentId,
      createdAt: room.createdAt,
    });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get message history for a room
// @route   GET /api/chat/messages/:roomId
// @access  Public
const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await Message.find({ roomId }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Upload a file and return URL
// @route   POST /api/chat/upload
// @access  Public
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Force Render URL for file uploads as well
    const serverUrl = 'https://scholarsync-chat-uh1x.onrender.com';
    const fileUrl = `${serverUrl}/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';

    res.json({
      fileUrl,
      fileName: req.file.originalname,
      fileType,
      fileSize: req.file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'File upload failed' });
  }
};

// @desc    Get all chat rooms for an expert
// @route   GET /api/chat/expert-rooms
// @access  Private (expert only)
const getExpertRooms = async (req, res) => {
  try {
    const rooms = await ChatRoom.find({ expertId: req.expert._id })
      .sort({ createdAt: -1 })
      .limit(50);

    // Get last message for each room
    const roomsWithLastMessage = await Promise.all(
      rooms.map(async (room) => {
        const lastMessage = await Message.findOne({ roomId: room.roomId })
          .sort({ timestamp: -1 });
        const messageCount = await Message.countDocuments({ roomId: room.roomId });
        return {
          ...room.toObject(),
          lastMessage,
          messageCount,
        };
      })
    );

    res.json(roomsWithLastMessage);
  } catch (error) {
    console.error('Get expert rooms error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all chat rooms for a user
// @route   GET /api/chat/user-rooms/:studentId
// @access  Public
const getUserRooms = async (req, res) => {
  try {
    const { studentId } = req.params;
    const rooms = await ChatRoom.find({ studentId })
      .sort({ createdAt: -1 })
      .limit(50);

    const roomsWithLastMessage = await Promise.all(
      rooms.map(async (room) => {
        const lastMessage = await Message.findOne({ roomId: room.roomId })
          .sort({ timestamp: -1 });
        const messageCount = await Message.countDocuments({ roomId: room.roomId });
        return {
          ...room.toObject(),
          lastMessage,
          messageCount,
        };
      })
    );

    res.json(roomsWithLastMessage);
  } catch (error) {
    console.error('Get user rooms error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all chat rooms for a subject (public)
// @route   GET /api/chat/subject-rooms/:subject
// @access  Public
const getRoomsBySubject = async (req, res) => {
  try {
    const { subject } = req.params;
    const rooms = await ChatRoom.find({ subject })
      .sort({ createdAt: -1 })
      .limit(50);

    const roomsWithLastMessage = await Promise.all(
      rooms.map(async (room) => {
        const lastMessage = await Message.findOne({ roomId: room.roomId })
          .sort({ timestamp: -1 });
        const messageCount = await Message.countDocuments({ roomId: room.roomId });
        return {
          ...room.toObject(),
          lastMessage,
          messageCount,
        };
      })
    );

    res.json(roomsWithLastMessage);
  } catch (error) {
    console.error('Get subject rooms error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a chat room and its messages
// @route   DELETE /api/chat/room/:roomId
// @access  Public (should ideally be protected, but for guest history simplicity we keep it public)
const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Delete the room document
    const room = await ChatRoom.findOneAndDelete({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Delete all messages associated with this room
    await Message.deleteMany({ roomId });

    res.json({ message: 'Room and messages deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getRoomInfo, getMessages, uploadFile, getExpertRooms, getUserRooms, getRoomsBySubject, deleteRoom };
