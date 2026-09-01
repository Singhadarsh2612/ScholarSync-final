const Message = require('../models/Message');
const Expert = require('../models/Expert');

const connectedUsers = new Map();
const activeRooms = new Map();

const initSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on('joinRoom', async ({ roomId, role, expertId }) => {
      socket.join(roomId);
      connectedUsers.set(socket.id, { roomId, role, expertId });

      if (!activeRooms.has(roomId)) {
        activeRooms.set(roomId, { userSocketId: null, expertSocketId: null });
      }

      const room = activeRooms.get(roomId);
      if (role === 'expert') {
        room.expertSocketId = socket.id;
        if (expertId) {
          await Expert.findByIdAndUpdate(expertId, { isOnline: true });
        }
        socket.to(roomId).emit('expertJoined', { message: 'Expert has joined the chat.' });
      } else {
        room.userSocketId = socket.id;
        socket.to(roomId).emit('userWaiting', { roomId, message: 'A user has joined and is waiting.' });
      }

      console.log(`👥 ${role} joined room: ${roomId}`);

      io.to(roomId).emit('roomStatus', {
        userOnline: !!room.userSocketId,
        expertOnline: !!room.expertSocketId,
      });
    });

    socket.on('sendMessage', async ({ roomId, sender, message, fileUrl, fileName }) => {
      try {
        const newMessage = await Message.create({
          roomId,
          sender,
          message: message || '',
          fileUrl: fileUrl || null,
          fileName: fileName || null,
          timestamp: new Date(),
        });

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

    socket.on('typing', ({ roomId, sender }) => {
      socket.to(roomId).emit('userTyping', { sender });
    });

    socket.on('stopTyping', ({ roomId }) => {
      socket.to(roomId).emit('userStopTyping');
    });

    socket.on('webrtc:offer', ({ roomId, offer }) => {
      socket.to(roomId).emit('webrtc:offer', { offer, from: socket.id });
    });

    socket.on('webrtc:answer', ({ roomId, answer }) => {
      socket.to(roomId).emit('webrtc:answer', { answer, from: socket.id });
    });

    socket.on('webrtc:ice-candidate', ({ roomId, candidate }) => {
      socket.to(roomId).emit('webrtc:ice-candidate', { candidate, from: socket.id });
    });

    socket.on('callStarted', ({ roomId }) => {
      socket.to(roomId).emit('incomingCall', { from: socket.id });
    });

    socket.on('callEnded', ({ roomId }) => {
      socket.to(roomId).emit('callEnded');
    });

    socket.on('callRejected', ({ roomId }) => {
      socket.to(roomId).emit('callRejected');
    });

    socket.on('disconnect', async () => {
      const userData = connectedUsers.get(socket.id);
      if (userData) {
        const { roomId, role, expertId } = userData;

        const room = activeRooms.get(roomId);
        if (room) {
          if (role === 'expert') {
            room.expertSocketId = null;
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

          socket.to(roomId).emit('peerDisconnected', { role });

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
