const Message = require('../models/Message');
const Expert = require('../models/Expert');

// Track connected users: socketId -> { roomId, role (user/expert), expertId }
const connectedUsers = new Map();
// Track rooms: roomId -> { userSocketId, expertSocketId }
const activeRooms = new Map();

const initSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ─── JOIN ROOM ───────────────────────────────────────────────────────────
    socket.on('joinRoom', async ({ roomId, role, expertId }) => {
      socket.join(roomId);
      connectedUsers.set(socket.id, { roomId, role, expertId });

      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, { userSocketId: null, expertSocketId: null });
      }

      const room = activeRooms.get(roomId);
      if (role === 'expert') {
        room.expertSocketId = socket.id;
        // Mark expert as online
        if (expertId) {
          await Expert.findByIdAndUpdate(expertId, { isOnline: true });
        }
        // Notify user that expert joined
        socket.to(roomId).emit('expertJoined', { message: 'Expert has joined the chat.' });
      } else {
        room.userSocketId = socket.id;
        // Notify expert that user is waiting
        socket.to(roomId).emit('userWaiting', { roomId, message: 'A user has joined and is waiting.' });
      }

      console.log(`👥 ${role} joined room: ${roomId}`);

      // Send current room participant info
      io.to(roomId).emit('roomStatus', {
        userOnline: !!room.userSocketId,
        expertOnline: !!room.expertSocketId,
      });
    });

    // ─── SEND MESSAGE ────────────────────────────────────────────────────────
    socket.on('sendMessage', async ({ roomId, sender, message, fileUrl, fileName }) => {
      try {
        // Save message to DB
        const newMessage = await Message.create({
          roomId,
          sender,
          message: message || '',
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          timestamp: new Date(),
        });

        // Broadcast to all in room
        io.to(roomId).emit('receiveMessage', {
          _id: newMessage._id,
          roomId,
          sender,
          message: newMessage.message,
          fileUrl: newMessage.fileUrl,
          fileName: newMessage.fileName,
          timestamp: newMessage.timestamp,
        });
      } catch (err) {
        console.error('Error saving message:', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ─── TYPING INDICATOR ────────────────────────────────────────────────────
    socket.on('typing', ({ roomId, sender }) => {
      socket.to(roomId).emit('userTyping', { sender });
    });

    socket.on('stopTyping', ({ roomId }) => {
      socket.to(roomId).emit('userStopTyping');
    });

    // ─── WEBRTC SIGNALING ────────────────────────────────────────────────────
    // Forward WebRTC offer
    socket.on('webrtc:offer', ({ roomId, offer }) => {
      socket.to(roomId).emit('webrtc:offer', { offer, from: socket.id });
    });

    // Forward WebRTC answer
    socket.on('webrtc:answer', ({ roomId, answer }) => {
      socket.to(roomId).emit('webrtc:answer', { answer, from: socket.id });
    });

    // Forward ICE candidates
    socket.on('webrtc:ice-candidate', ({ roomId, candidate }) => {
      socket.to(roomId).emit('webrtc:ice-candidate', { candidate, from: socket.id });
    });

    // Notify when video call starts/ends
    socket.on('callStarted', ({ roomId }) => {
      socket.to(roomId).emit('incomingCall', { from: socket.id });
    });

    socket.on('callEnded', ({ roomId }) => {
      socket.to(roomId).emit('callEnded');
    });

    socket.on('callRejected', ({ roomId }) => {
      socket.to(roomId).emit('callRejected');
    });

    // ─── DISCONNECT ──────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const userData = connectedUsers.get(socket.id);
      if (userData) {
        const { roomId, role, expertId } = userData;

        // Update room tracking
        const room = activeRooms.get(roomId);
        if (room) {
          if (role === 'expert') {
            room.expertSocketId = null;
            // Mark expert offline
            if (expertId) {
              await Expert.findByIdAndUpdate(expertId, { isOnline: false });
            }
          } else {
            room.userSocketId = null;
          }

          io.to(roomId).emit('roomStatus', {
            userOnline: !!room.userSocketId,
            expertOnline: !!room.expertSocketId,
          });

          // Notify others
          socket.to(roomId).emit('peerDisconnected', { role });

          // Clean up empty rooms
          if (!room.userSocketId && !room.expertSocketId) {
            activeRooms.delete(roomId);
          }
        }

        connectedUsers.delete(socket.id);
      }

      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = { initSocket };
