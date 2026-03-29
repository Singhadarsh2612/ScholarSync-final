import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

// Attach token on each request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('expertToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
