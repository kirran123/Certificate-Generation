import { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../apiConfig';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    sessionStorage.removeItem('token');
    setUser(null);
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token = sessionStorage.getItem('token');
      if (token) {
        try {
          const res = await axios.get(`${API_BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 6000
          });
          setUser(res.data);
        } catch (error) {
          console.warn('Auth check warning:', error.message);
          if (error.response?.status === 401) {
            sessionStorage.removeItem('token');
            setUser(null);
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const res = await axios.post(`${API_BASE}/api/auth/login`, { email: cleanEmail, password });
    sessionStorage.setItem('token', res.data.token);
    setUser(res.data);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
