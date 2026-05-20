import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import {
  applyAuthSession,
  clearAuth,
  getAccessToken,
  setAccessToken,
  type AuthTokensResponse,
} from "./authStore";
export const getApiBaseUrl = (): string => {
  return (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
};

export const getSocketUrl = (): string => {
  return (process.env.NEXT_PUBLIC_SOCKET_URL || "").replace(/\/+$/, "");
};

export interface UserProfile {
  _id: string;
  fullName: string;
  username: string;
  email: string;
  trophies: number;
  league: string;
  wins: number;
  losses: number;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  error?: string;
  status: number;
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  config.baseURL = getApiBaseUrl();
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown | null, token: string | null = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else if (token) resolve(token);
  });
  refreshQueue = [];
};

const refreshAccessToken = async (): Promise<string> => {
  const { data } = await axios.post<AuthTokensResponse>(
    `${getApiBaseUrl()}/api/auth/refresh-token`,
    {},
    { withCredentials: true }
  );
  applyAuthSession(data);

  if (typeof window !== "undefined") {
    const { socket, reconnectSocketWithFreshToken, updateSocketAuth } =
      await import("./socket");
    if (socket.connected) {
      reconnectSocketWithFreshToken();
    } else {
      updateSocketAuth();
    }
  }

  return data.accessToken;
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
      _skipAuthRefresh?: boolean;
    };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isAuthEndpoint =
      originalRequest.url?.includes("/api/auth/login") ||
      originalRequest.url?.includes("/api/auth/register") ||
      originalRequest.url?.includes("/api/auth/verify-otp") ||
      originalRequest.url?.includes("/api/auth/resend-otp") ||
      originalRequest.url?.includes("/api/auth/refresh-token");

    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest._skipAuthRefresh ||
      isAuthEndpoint
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const newToken = await refreshAccessToken();
      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuth();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: {
    method?: string;
    data?: unknown;
    headers?: Record<string, string>;
    skipAuthRefresh?: boolean;
  } = {}
): Promise<ApiResponse<T>> {
  const { data, method, headers, skipAuthRefresh } = options;

  const config: AxiosRequestConfig & { _skipAuthRefresh?: boolean } = {
    url: endpoint,
    method: method || (data ? "POST" : "GET"),
    headers,
    _skipAuthRefresh: skipAuthRefresh,
  };

  if (data !== undefined) {
    config.data = data;
  }

  try {
    const response = await api.request<T>(config);
    const body = response.data as T & { message?: string };

    return {
      data: body,
      message: (body as { message?: string })?.message,
      status: response.status,
    };
  } catch (err) {
    const axiosErr = err as AxiosError<{ message?: string }>;
    const message =
      axiosErr.response?.data?.message ||
      axiosErr.message ||
      "Something went wrong";

    return {
      error: message,
      status: axiosErr.response?.status || 500,
    };
  }
}

export const restoreSession = async (): Promise<boolean> => {
  try {
    await refreshAccessToken();
    const me = await apiFetch<UserProfile>("/api/auth/me");
    if (me.data) {
      const { setAuthUser } = await import("./authStore");
      setAuthUser(me.data);
      return true;
    }
    clearAuth();
    return false;
  } catch {
    clearAuth();
    return false;
  }
};

export default api;
