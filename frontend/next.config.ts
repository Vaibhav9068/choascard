import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

const lanIp = process.env.LAN_DEV_IP;

const allowedDevOrigins = [
  "localhost:3000",
  "192.168.1.5",
  "192.168.1.5:3000",
  "192.168.1.6",
  "192.168.1.6:3000",
  ...(lanIp ? [lanIp, `${lanIp}:3000`] : []),
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  turbopack: {
    root: frontendRoot,
  },
};

export default nextConfig;
