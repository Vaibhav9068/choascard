const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const { setupSocket } = require('./sockets');
const validateEnv = require('./config/validateEnv');
const { PORT, FRONTEND_URL, NODE_ENV } = require('./config/config');
const connectDB = require('./config/database');

validateEnv();
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { cleanupExpiredRefreshTokens } = require('./services/tokenService');

const app = express();
const server = http.createServer(app);

connectDB();

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (NODE_ENV !== 'production') {
      return callback(null, true);
    }
    const allowedOrigins = process.env.CLIENT_URL
      ? process.env.CLIENT_URL.split(',').map((o) => o.trim()).filter(Boolean)
      : [];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.use(notFound);
app.use(errorHandler);

const io = new Server(server, {
  cors: corsOptions,
});

setupSocket(io);

setInterval(() => {
  cleanupExpiredRefreshTokens().catch((err) =>
    console.error('Refresh token cleanup failed:', err.message)
  );
}, 60 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
