const mongoose = require('mongoose');

const { MONGO_URI } = require('./env');

// NOTE: this module used to pin process-wide DNS to Google's resolvers.
// That breaks any private network - including Docker Compose, where the
// 'mongo' hostname resolves only via Docker's embedded DNS server - so name
// resolution is now left to the host.

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
