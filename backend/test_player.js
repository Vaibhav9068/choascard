require('dotenv').config();
const { io } = require('socket.io-client');

const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:5000';
const roomId = process.argv[2];

if (!roomId) {
  console.error('Usage: node test_player.js <ROOM_ID>');
  process.exit(1);
}

const socket = io(SOCKET_URL, {
  auth: { token: process.env.TEST_ACCESS_TOKEN || '' },
});

socket.on('connect', () => {
  console.log('Mock player connected:', socket.id);
  socket.emit('join_room', {
    roomId: roomId.toUpperCase(),
    user: {
      _id: '000000000000000000000001',
      username: 'test_bot',
      fullName: 'Test Bot',
      trophies: 0,
      league: 'Bronze',
    },
  });
});

socket.on('room_update', (room) => {
  console.log('Room update:', room?.id, 'players:', room?.players?.length);
});

socket.on('error_message', (msg) => {
  console.error('Error:', msg);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
