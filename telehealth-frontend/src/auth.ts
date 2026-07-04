export type AuthRole = 'ADMIN' | 'PATIENT' | 'DOCTOR';

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: AuthRole;
  createdAt: string;
}

const ACCESS_TOKEN_KEY = 'telehealth_access_token';
const AUTH_USER_KEY = 'telehealth_auth_user';

export function getAuthToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getAuthUser() {
  const rawUser = localStorage.getItem(AUTH_USER_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuthSession(accessToken: string, user: AuthUser) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}
