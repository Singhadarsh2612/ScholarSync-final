const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const { PORT, CLIENT_URL, assertConfig } = require('./config/env');

// Refuse to boot with missing critical configuration.
assertConfig();

const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const connectRoutes = require('./routes/connectRoutes');
const expertRoutes = require('./routes/expertRoutes');
const { initSocket } = require('./config/socket');
const connectDB = require('./config/db');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

connectDB();

app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/connect', connectRoutes);   // ScholarSync integration
app.use('/api/experts', expertRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

initSocket(io);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready`);
  console.log(`🌍 Client URL: ${CLIENT_URL}`);
});

module.exports = { app, io };
