const mongoose = require('mongoose');
const dns = require('dns');

// Force using Google DNS to resolve MongoDB Atlas SRV records
// This fixes the 'querySrv ECONNREFUSED' error seen on some networks
dns.setServers(['8.8.8.8', '8.8.4.4']);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/scholarsync_chat');
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
