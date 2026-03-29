const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  studentId: { 
    type: String, 
    index: true 
  },
  roomId: {
    type: String,
    required: true,
    unique: true,
  },
  expertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expert',
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('ChatRoom', chatRoomSchema);
