import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const AuthProvider = ({ children }) => {
  const [expert, setExpert] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('expertToken'));
  const [loading, setLoading] = useState(true);

  // Set axios default auth header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Fetch current expert on mount if token exists
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) { setLoading(false); return; }
      try {
        const { data } = await axios.get(`${API_URL}/api/auth/me`);
        setExpert(data);
      } catch {
        // Token invalid — clear it
        localStorage.removeItem('expertToken');
        setToken(null);
        setExpert(null);
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, [token]);

  const login = async (email, password) => {
    const { data } = await axios.post(`${API_URL}/api/auth/login`, { email, password });
    localStorage.setItem('expertToken', data.token);
    setToken(data.token);
    setExpert(data.expert);
    return data.expert;
  };

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/api/auth/logout`);
    } catch {}
    localStorage.removeItem('expertToken');
    setToken(null);
    setExpert(null);
  };

  const updateProfile = async (updates) => {
    const { data } = await axios.put(`${API_URL}/api/auth/profile`, updates);
    setExpert(data);
    return data;
  };

  return (
    <AuthContext.Provider value={{ expert, token, loading, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
