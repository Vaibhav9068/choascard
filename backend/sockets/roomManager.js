class ActionQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  push(actionFn) {
    this.queue.push(actionFn);
    this.processNext();
  }

  async processNext() {
    if (this.processing) return;
    if (this.queue.length === 0) return;

    this.processing = true;
    const action = this.queue.shift();
    try {
      await action();
    } catch (err) {
      console.error('Error processing room action:', err);
    } finally {
      this.processing = false;
      this.processNext();
    }
  }
}

const generateRoomId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 5; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

const handleRoomEvents = (io, socket, rooms, disconnectTimers) => {
  socket.on('create_room', (user) => {
    const roomId = generateRoomId();
    rooms.set(roomId, {
      id: roomId,
      hostId: user._id,
      players: [{ ...user, socketId: socket.id, connected: true }],
      gameStarted: false,
      gameState: null,
      queue: new ActionQueue()
    });
    socket.join(roomId);
    socket.emit('room_created', roomId);
    io.to(roomId).emit('room_update', rooms.get(roomId));
  });

  socket.on('join_room', ({ roomId, user }) => {
    const room = rooms.get(roomId);
    if (!room) {
      return socket.emit('error_message', 'Room not found');
    }

    room.queue.push(async () => {
      // Reconnect/session recovery logic
      const existingPlayer = room.players.find(p => p._id === socket.userId);

      if (existingPlayer) {
        // Cancel active disconnect/forfeit timers
        const timerId = `${roomId}_${socket.userId}`;
        if (disconnectTimers.has(timerId)) {
          clearTimeout(disconnectTimers.get(timerId));
          disconnectTimers.delete(timerId);
          console.log(`Reconnection: Cancelled forfeit timer for player ${existingPlayer.username} in room ${roomId}`);
        }

        // Multi-tab checking: disconnect existing active socket if it is different and connected
        if (existingPlayer.socketId && existingPlayer.socketId !== socket.id && existingPlayer.connected) {
          const oldSocket = io.sockets.sockets.get(existingPlayer.socketId);
          if (oldSocket) {
            console.log(`Multi-tab: Disconnecting old socket ${existingPlayer.socketId} for user ${socket.userId}`);
            oldSocket.emit('error_message', 'You have been disconnected because the session was opened in another tab.');
            oldSocket.disconnect();
          }
        }

        // Update player credentials
        existingPlayer.socketId = socket.id;
        existingPlayer.connected = true;
        socket.join(roomId);

        console.log(`Player ${existingPlayer.username} successfully reconnected to room ${roomId}`);

        // Emit updates to everyone in room
        io.to(roomId).emit('room_update', room);

        // If game has started, sync the full state to this specific player
        if (room.gameStarted && room.gameState) {
          const { getMaskedState } = require('./gameEngine');
          socket.emit('sync_game_state', getMaskedState(room, socket.userId));
        }
        return;
      }

      // Normal lobby joining checks
      if (room.gameStarted) {
        return socket.emit('error_message', 'Game already in progress');
      }
      if (room.players.length >= 8) {
        return socket.emit('error_message', 'Room is full');
      }

      room.players.push({ ...user, socketId: socket.id, connected: true });
      socket.join(roomId);
      io.to(roomId).emit('room_update', room);
    });
  });

  socket.on('leave_room', (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      room.queue.push(async () => {
        const leavingPlayer = room.players.find(p => p.socketId === socket.id);
        if (!leavingPlayer) return;

        // Clear any active disconnect timer
        const timerId = `${roomId}_${leavingPlayer._id}`;
        if (disconnectTimers.has(timerId)) {
          clearTimeout(disconnectTimers.get(timerId));
          disconnectTimers.delete(timerId);
        }

        // If game has started, leaving room is a manual forfeit
        if (room.gameStarted) {
          const { handlePlayerForfeit } = require('./gameEngine');
          await handlePlayerForfeit(io, rooms, roomId, leavingPlayer._id);
          socket.leave(roomId);
        } else {
          // Lobby leaving
          room.players = room.players.filter(p => p._id !== leavingPlayer._id);
          socket.leave(roomId);

          if (room.players.length === 0) {
            // Delay deletion for React Strict Mode
            setTimeout(() => {
              const r = rooms.get(roomId);
              if (r && r.players.length === 0) {
                rooms.delete(roomId);
              }
            }, 1000);
          } else {
            if (room.hostId === leavingPlayer._id) {
              room.hostId = room.players[0]._id;
            }
            io.to(roomId).emit('room_update', room);
          }
        }
      });
    }
  });

  socket.on('disband_room', (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      room.queue.push(async () => {
        io.to(roomId).emit('room_disbanded');
        
        // Clean up all disconnect timers for players in the room
        room.players.forEach(p => {
          const timerId = `${roomId}_${p._id}`;
          if (disconnectTimers.has(timerId)) {
            clearTimeout(disconnectTimers.get(timerId));
            disconnectTimers.delete(timerId);
          }
        });

        io.in(roomId).socketsLeave(roomId);
        rooms.delete(roomId);
      });
    }
  });
};

module.exports = { handleRoomEvents, ActionQueue };
