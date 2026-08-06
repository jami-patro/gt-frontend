import axios from 'axios';

// In dev, VITE_API_URL is empty and Vite proxies /api to the backend.
// In production, set VITE_API_URL to the deployed backend origin.
const baseURL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({ baseURL });

// Attach the JWT (if present) to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('gt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On an expired/invalid token (401), clear the session and bounce to login —
// but only if we actually had a token (skip 401s from the login form itself).
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const hadToken = Boolean(localStorage.getItem('gt_token'));
    const onLogin = window.location.pathname === '/login';
    if (status === 401 && hadToken && !onLogin) {
      localStorage.removeItem('gt_token');
      // Full redirect so all in-memory state resets cleanly.
      window.location.assign('/login?expired=1');
    }
    return Promise.reject(err);
  },
);

// Pull a clean error message out of an axios error.
export function apiError(err, fallback = 'Something went wrong') {
  return err?.response?.data?.error || err?.message || fallback;
}

export default api;
