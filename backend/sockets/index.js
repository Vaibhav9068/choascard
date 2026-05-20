const { verifyAccessToken } = require('../services/tokenService');
const { handleRoomEvents } = require('./roomManager');
const { handleGameEvents } = require('./gameEngine');

const rooms = new Map();
const disconnectTimers = new Map();

const extractSocketToken = (socket) => {
  if (socket.handshake.auth?.token) {
    return socket.handshake.auth.token;
  }

  const authHeader = socket.handshake.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
};

const setupSocket = (io) => {
  io.use((socket, next) => {
    const token = extractSocketToken(socket);

    if (!token) {
      return next(new Error('Authentication error: No access token provided'));
    }

    try {
      const decoded = verifyAccessToken(token);
      socket.userId = decoded.userId;
      next();
    } catch {
      return next(new Error('Authentication error: Invalid or expired access token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}, User ID: ${socket.userId}`);

    handleRoomEvents(io, socket, rooms, disconnectTimers);
    handleGameEvents(io, socket, rooms);

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}, User ID: ${socket.userId}`);
      if (!socket.userId) return;

      for (const [roomId, roomData] of rooms.entries()) {
        const playerIndex = roomData.players.findIndex((p) => p._id === socket.userId);
        if (playerIndex !== -1) {
          const player = roomData.players[playerIndex];
          if (player.socketId !== socket.id) {
            console.log(`Stale socket disconnected for player ${player.username}, ignoring.`);
            continue;
          }

          player.connected = false;

          const timerId = `${roomId}_${socket.userId}`;
          if (disconnectTimers.has(timerId)) {
            clearTimeout(disconnectTimers.get(timerId));
          }

          if (!roomData.gameStarted) {
            const timer = setTimeout(() => {
              disconnectTimers.delete(timerId);
              const r = rooms.get(roomId);
              if (r) {
                const idx = r.players.findIndex((p) => p._id === socket.userId);
                if (idx !== -1) {
                  const leavingPlayer = r.players[idx];
                  r.players.splice(idx, 1);
                  console.log(
                    `Lobby disconnect timeout: Removed player ${leavingPlayer.username} from room ${roomId}`
                  );
                  if (r.players.length === 0) {
                    rooms.delete(roomId);
                  } else {
                    if (r.hostId === leavingPlayer._id) {
                      r.hostId = r.players[0]._id;
                    }
                    io.to(roomId).emit('room_update', r);
                  }
                }
              }
            }, 10000);

            disconnectTimers.set(timerId, timer);
            io.to(roomId).emit('room_update', roomData);
          } else {
            const timer = setTimeout(() => {
              disconnectTimers.delete(timerId);
              console.log(
                `Game disconnect timeout: Forfeiting player ${player.username} from room ${roomId}`
              );

              const { handlePlayerForfeit } = require('./gameEngine');
              handlePlayerForfeit(io, rooms, roomId, socket.userId);
            }, 60000);

            disconnectTimers.set(timerId, timer);
            io.to(roomId).emit('room_update', roomData);
          }
        }
      }
    });
  });
};

module.exports = { setupSocket };
