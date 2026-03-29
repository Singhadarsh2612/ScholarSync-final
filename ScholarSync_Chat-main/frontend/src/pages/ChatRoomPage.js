import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../hooks/useWebRTC';
import api from '../utils/api';
import ChatPanel from '../components/Chat/ChatPanel';
import VideoPanel from '../components/Video/VideoPanel';
import styles from './ChatRoomPage.module.css';

const SERVER_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ChatRoomPage = () => {
  const { roomId } = useParams();
  const { expert } = useAuth();       // null if normal user
  const { socket, connected } = useSocket();
  const navigate = useNavigate();

  const role = expert ? 'expert' : 'user';

  // ── Session History ───────────────────────────────────────────────────────
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [roomInfo, setRoomInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roomStatus, setRoomStatus] = useState({ userOnline: false, expertOnline: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [incomingCall, setIncomingCall] = useState(false);

  const typingTimeout = useRef(null);

  // WebRTC hook
  const webrtc = useWebRTC({ socket, roomId, isExpert: !!expert });

  // ── Fetch room info + message history ─────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [roomRes, msgRes] = await Promise.all([
          api.get(`/chat/room/${roomId}`),
          api.get(`/chat/messages/${roomId}`),
        ]);
        setRoomInfo(roomRes.data);
        setMessages(msgRes.data);
      } catch (err) {
        setError(err.response?.status === 404 ? 'Chat room not found.' : 'Failed to load chat.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [roomId]);

  // Fetch full subject history from backend (matches expert view)
  const fetchSubjectHistory = useCallback(async () => {
    if (role !== 'user' || !roomInfo?.subject) return;

    setLoadingHistory(true);
    try {
      const { data } = await api.get(`/chat/subject-rooms/${roomInfo.subject}`);
      // Only keep rooms of same subject, excluding current room
      const sameSubjectRooms = data.filter(r => r.roomId !== roomId);
      setHistory(sameSubjectRooms);
    } catch (err) {
      console.error('Fetch subject history error:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [role, roomInfo, roomId]);

  useEffect(() => {
    fetchSubjectHistory();
  }, [fetchSubjectHistory]);

  // ── Delete Room ───────────────────────────────────────────────────────────
  const handleDeleteRoom = async (e, targetRoomId) => {
    e.stopPropagation(); // prevent navigation
    if (!window.confirm('Delete this chat history permanently?')) return;

    try {
      await api.delete(`/chat/room/${targetRoomId}`);
      if (targetRoomId === roomId) {
        navigate('/login'); // if current room deleted, exit
      } else {
        fetchSubjectHistory(); // refresh list
      }
    } catch (err) {
      console.error('Delete room error:', err);
      alert('Failed to delete chat.');
    }
  };

  // ── Join socket room ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !connected || !roomInfo) return;
    socket.emit('joinRoom', {
      roomId,
      role,
      expertId: expert?._id || null,
    });
  }, [socket, connected, roomId, role, expert, roomInfo]);

  // ── Socket event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on('receiveMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('roomStatus', (status) => {
      setRoomStatus(status);
    });

    socket.on('userTyping', () => setIsTyping(true));
    socket.on('userStopTyping', () => setIsTyping(false));

    socket.on('incomingCall', () => {
      setIncomingCall(true);
    });

    socket.on('callEnded', () => {
      setShowVideo(false);
      setIncomingCall(false);
    });

    return () => {
      socket.off('receiveMessage');
      socket.off('roomStatus');
      socket.off('userTyping');
      socket.off('userStopTyping');
      socket.off('incomingCall');
      socket.off('callEnded');
    };
  }, [socket]);

  // ── Send text message ──────────────────────────────────────────────────────
  const sendMessage = useCallback((message) => {
    if (!message.trim() || !socket) return;
    socket.emit('sendMessage', { roomId, sender: role, message });
  }, [socket, roomId, role]);

  // ── Send file message ──────────────────────────────────────────────────────
  const sendFile = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post('/chat/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      socket.emit('sendMessage', {
        roomId,
        sender: role,
        message: '',
        fileUrl: data.fileUrl,
        fileName: data.fileName,
      });
    } catch (err) {
      console.error('File upload error:', err);
    }
  }, [socket, roomId, role]);

  // ── Typing indicator ───────────────────────────────────────────────────────
  const handleTyping = useCallback(() => {
    socket?.emit('typing', { roomId, sender: role });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket?.emit('stopTyping', { roomId });
    }, 1500);
  }, [socket, roomId, role]);

  // ── Start video call ───────────────────────────────────────────────────────
  const handleStartCall = () => {
    setShowVideo(true);
    webrtc.startCall();
  };

  const handleAcceptCall = () => {
    setIncomingCall(false);
    setShowVideo(true);
  };

  const handleEndCall = () => {
    webrtc.endCall();
    setShowVideo(false);
    setIncomingCall(false);
  };

  // ── Loading / Error states ─────────────────────────────────────────────────
  if (loading) return (
    <div className={styles.centerScreen}>
      <span className="spin" style={{ fontSize: '1.5rem', color: 'var(--accent)' }}>◌</span>
      <span style={{ marginLeft: '0.75rem', color: 'var(--text-secondary)' }}>Loading session…</span>
    </div>
  );

  if (error) return (
    <div className={styles.centerScreen}>
      <div className={styles.errorBox}>
        <span>⚠</span> {error}
        <button onClick={() => navigate('/login')} style={{ marginLeft: '1rem', color: 'var(--accent)' }}>← Go back</button>
      </div>
    </div>
  );

  const peerOnline = role === 'expert' ? roomStatus.userOnline : roomStatus.expertOnline;

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <span className={styles.logo}>◈</span>
          <div>
            <div className={styles.roomTitle}>
              {roomInfo?.expert?.subjectLabel || roomInfo?.subject?.replace(/_/g, ' ')}
              <span className={styles.roomIdBadge + ' mono'}>#{roomId.slice(0, 8)}</span>
            </div>
            <div className={styles.expertName}>
              {role === 'user'
                ? `Expert: ${roomInfo?.expert?.name}`
                : `You are the expert`}
            </div>
            {role === 'user' && roomInfo?.expert?.description && (
              <div className={styles.expertDescWrapper}>
                <div className={styles.expertDesc}>
                  {roomInfo.expert.description}
                </div>
                <div className={styles.expertDescDropdown}>
                  <strong>About Expert:</strong><br/>
                  {roomInfo.expert.description}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={styles.topRight}>
          <div className={styles.statusRow}>
            <span
              className={styles.statusDot}
              style={{ background: peerOnline ? 'var(--online)' : 'var(--offline)' }}
            />
            <span className={styles.statusLabel}>
              {role === 'expert'
                ? (roomStatus.userOnline ? 'User online' : 'Waiting for user')
                : (roomStatus.expertOnline ? 'Expert online' : 'Expert offline')}
            </span>
          </div>

          {/* Video call button removed per request */}

          {role === 'expert' && (
            <button
              className={styles.dashBtn}
              onClick={() => navigate('/dashboard')}
            >
              ← Dashboard
            </button>
          )}
        </div>
      </header>

      {/* Incoming call banner */}
      {incomingCall && !showVideo && (
        <div className={styles.callBanner}>
          <span>📞 Incoming video call…</span>
          <button className={styles.acceptBtn} onClick={handleAcceptCall}>Accept</button>
          <button className={styles.declineBtn} onClick={() => { setIncomingCall(false); socket?.emit('callRejected', { roomId }); }}>Decline</button>
        </div>
      )}

      {/* Waiting overlay (for user when expert is offline) */}
      {role === 'user' && !roomStatus.expertOnline && (
        <div className={styles.waitingBanner}>
          <span className="pulse">🟡</span>
          &nbsp; Waiting for expert to join…
        </div>
      )}

      {/* Main content area */}
      <div className={styles.content}>
        {/* User Sidebar - only for guest users */}
        {role === 'user' && (
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <span className={styles.sidebarTitle}>Recent Sessions</span>
              <button className={styles.sidebarRefresh} onClick={fetchSubjectHistory} disabled={loadingHistory}>
                {loadingHistory ? '◌' : '↺'}
              </button>
            </div>

            <div className={styles.sidebarList}>
              {history.length === 0 ? (
                <div className={styles.noHistory}>
                  No other sessions for this subject.
                </div>
              ) : (
                history.map(item => (
                  <div
                    key={item.roomId}
                    className={styles.historyCard}
                    onClick={() => navigate(`/chat/${item.roomId}`)}
                  >
                    <div className={styles.historyHeader}>
                      <span className={styles.historyTime}>{formatTime(item.createdAt)}</span>
                      <button 
                        className={styles.deleteBtn} 
                        onClick={(e) => handleDeleteRoom(e, item.roomId)}
                        title="Delete Session"
                      >
                        🗑
                      </button>
                    </div>
                    <div className={styles.historyLastMsg}>
                      {item.lastMessage?.message || 'Empty Conversation'}
                    </div>
                    <div className={styles.historyFooter}>
                      <span>{item.messageCount} messages</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Video panel hidden per request */}
        {/* {showVideo && (
          <VideoPanel
            webrtc={webrtc}
            onEndCall={handleEndCall}
          />
        )} */}

        {/* Chat panel - always visible */}
        <ChatPanel
          messages={messages}
          role={role}
          expertName={roomInfo?.expert?.name}
          isTyping={isTyping}
          onSendMessage={sendMessage}
          onSendFile={sendFile}
          onTyping={handleTyping}
          serverUrl={SERVER_URL}
          compact={showVideo}
        />
      </div>
    </div>
  );
};

export default ChatRoomPage;
