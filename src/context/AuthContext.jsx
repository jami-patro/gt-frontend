import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On boot, if we have a token, resolve the current user.
  useEffect(() => {
    const token = localStorage.getItem('gt_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/api/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem('gt_token'))
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((token, u) => {
    localStorage.setItem('gt_token', token);
    setUser(u);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const res = await api.post('/api/auth/login', { email, password });
      persist(res.data.token, res.data.user);
      return res.data.user;
    },
    [persist],
  );

  const register = useCallback(
    async (payload) => {
      const res = await api.post('/api/auth/register', payload);
      persist(res.data.token, res.data.user);
      return res.data.user;
    },
    [persist],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('gt_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
