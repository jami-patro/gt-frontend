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

// Pull a clean error message out of an axios error.
export function apiError(err, fallback = 'Something went wrong') {
  return err?.response?.data?.error || err?.message || fallback;
}

export default api;
