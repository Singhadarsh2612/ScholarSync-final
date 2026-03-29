import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ChatRoomPage from './pages/ChatRoomPage';
import './styles/globals.css';

// Guard for expert-only routes
const PrivateRoute = ({ children }) => {
  const { expert, loading } = useAuth();
  if (loading) return <div className="loading-screen"><span className="spin">◌</span></div>;
  return expert ? children : <Navigate to="/login" replace />;
};

const App = () => (
  <AuthProvider>
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={<PrivateRoute><DashboardPage /></PrivateRoute>}
          />
          {/* Chat room - accessible by anyone with the link */}
          <Route path="/chat/:roomId" element={<ChatRoomPage />} />
          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  </AuthProvider>
);

export default App;
