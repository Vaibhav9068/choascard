import { io, Socket } from "socket.io-client";
import { getAccessToken } from "./authStore";
import { getSocketUrl } from "./env";

export const socket: Socket = io(getSocketUrl(), {
  autoConnect: false,
  withCredentials: true,
});

export const updateSocketAuth = () => {
  const token = getAccessToken();
  socket.auth = token ? { token } : {};
};

export const connectSocket = () => {
  updateSocketAuth();
  if (!socket.connected) {
    socket.connect();
  }
};

export const reconnectSocketWithFreshToken = () => {
  updateSocketAuth();
  if (socket.connected) {
    socket.disconnect();
  }
  socket.connect();
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
