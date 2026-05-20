import type { UserProfile } from "./api";

let accessToken: string | null = null;
let user: UserProfile | null = null;

type AuthListener = () => void;
const listeners = new Set<AuthListener>();

export const subscribeAuth = (listener: AuthListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const notify = () => listeners.forEach((l) => l());

export const getAccessToken = () => accessToken;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
  notify();
};

export const getAuthUser = () => user;

export const setAuthUser = (nextUser: UserProfile | null) => {
  user = nextUser;
  notify();
};

export const clearAuth = () => {
  accessToken = null;
  user = null;
  notify();
};

export interface AuthTokensResponse {
  accessToken: string;
  expiresIn: number;
  user: UserProfile;
}

export const applyAuthSession = (payload: AuthTokensResponse) => {
  setAccessToken(payload.accessToken);
  setAuthUser(payload.user);
};
