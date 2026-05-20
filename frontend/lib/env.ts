/**
 * Next.js public environment variables (browser-safe only).
 * Never add JWT, MongoDB, or OAuth secrets here — backend .env only.
 *
 * Vercel: set NEXT_PUBLIC_* in Project → Settings → Environment Variables
 * Render backend URL example: https://your-app.onrender.com
 */

const trimTrailingSlash = (url: string) => url.replace(/\/+$/, "");

const getLanFallbackBaseUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  return `http://${hostname}:5000`;
};

export const getApiBaseUrl = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL);
  }
  return getLanFallbackBaseUrl() ?? "http://localhost:5000";
};

export const getSocketUrl = (): string => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return trimTrailingSlash(process.env.NEXT_PUBLIC_SOCKET_URL);
  }
  return getLanFallbackBaseUrl() ?? "http://localhost:5000";
};
