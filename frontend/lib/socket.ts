import { io, Socket } from "socket.io-client";
import { getAccessToken } from "./authStore";
import { getSocketUrl } from "./api";

let socketInstance: Socket | null = null;
let isRefreshing = false;

const getSocketInstance = (): Socket | null => {
  if (typeof window === "undefined") {
    return null;
  }

  if (!socketInstance) {
    socketInstance = io(getSocketUrl(), {
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket"],
    });

    // Handle token expiration/auth error on connect attempt
    socketInstance.on("connect_error", async (err) => {
      console.warn("[Socket] Connection error:", err.message);
      if (err.message && err.message.toLowerCase().includes("auth")) {
        if (isRefreshing) return;
        isRefreshing = true;
        console.log("[Socket] Auth error detected. Refreshing token silently...");
        try {
          const { restoreSession } = await import("./api");
          const success = await restoreSession();
          if (success) {
            console.log("[Socket] Token refreshed. Updating socket auth for next retry...");
            // Just update the auth — socket.io will automatically retry connection
            // Do NOT call reconnectSocketWithFreshToken() as that triggers
            // a disconnect event visible to the room page overlay.
            updateSocketAuth();
          } else {
            console.error("[Socket] Session restore failed.");
          }
        } catch (refreshErr) {
          console.error("[Socket] Token refresh error:", refreshErr);
        } finally {
          isRefreshing = false;
        }
      }
    });
  }

  return socketInstance;
};

// Export socket as a proxy that routes to the underlying instance or returns no-ops on SSR
export const socket = new Proxy({} as Socket, {
  get(target, prop) {
    const inst = getSocketInstance();
    if (!inst) {
      // Mock methods during SSR to avoid undefined or invocation errors
      if (prop === "on" || prop === "off" || prop === "emit") {
        return () => {};
      }
      if (prop === "connect" || prop === "disconnect") {
        return () => {};
      }
      if (prop === "connected") {
        return false;
      }
      return undefined;
    }
    const val = Reflect.get(inst, prop);
    if (typeof val === "function") {
      return val.bind(inst);
    }
    return val;
  },
  set(target, prop, value) {
    const inst = getSocketInstance();
    if (!inst) return false;
    return Reflect.set(inst, prop, value);
  },
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
