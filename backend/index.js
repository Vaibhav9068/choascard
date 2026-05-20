const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const { setupSocket } = require('./sockets');
const validateEnv = require('./config/validateEnv');
const { PORT, CLIENT_URL, NODE_ENV } = require('./config/config');
const connectDB = require('./config/database');

validateEnv();
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { cleanupExpiredRefreshTokens } = require('./services/tokenService');

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

connectDB();

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (NODE_ENV !== 'production') {
      return callback(null, true);
    }
    const productionAllowed = [
      'https://choascard.vercel.app',
    ];
    if (productionAllowed.includes(origin) || CLIENT_URL.includes(origin)) {
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

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CHAOS DECK API is running"
  });
});

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
