const mongoose = require('mongoose');
const { MONGO_URI } = require('./config');

const connectDB = async () => {
  if (!MONGO_URI) {
    console.error('MONGO_URI is not defined. Set it in backend/.env');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
