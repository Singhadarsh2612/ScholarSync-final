const Message = require('../models/Message');
const ChatRoom = require('../models/ChatRoom');
const Expert = require('../models/Expert');
const path = require('path');

const { SERVER_URL } = require('../config/env');

const getRoomInfo = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { studentId } = req.query;

    let room = await ChatRoom.findOne({ roomId }).populate('expertId', '-password');
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }

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

const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `${SERVER_URL}/uploads/${req.file.filename}`;
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

const getExpertRooms = async (req, res) => {
  try {
    const rooms = await ChatRoom.find({ expertId: req.expert._id })
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
    console.error('Get expert rooms error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

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

const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await ChatRoom.findOneAndDelete({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    await Message.deleteMany({ roomId });

    res.json({ message: 'Room and messages deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { getRoomInfo, getMessages, uploadFile, getExpertRooms, getUserRooms, getRoomsBySubject, deleteRoom };
