require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  if (!MONGO_URI) {
    console.error('MONGO_URI is not set. Copy .env.example to .env and configure it.');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGO_URI);
    const db = mongoose.connection.db;
    const otps = await db.collection('otps').find({}).toArray();
    console.log('OTP records (hashed — no plaintext stored):', otps.length);
    console.log(
      JSON.stringify(
        otps.map(({ email, attempts, resendCount, createdAt, lastSentAt }) => ({
          email,
          attempts,
          resendCount,
          createdAt,
          lastSentAt,
        })),
        null,
        2
      )
    );
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
