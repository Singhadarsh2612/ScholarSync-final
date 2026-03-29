import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';
import styles from './DashboardPage.module.css';

const SUBJECT_LABELS = {
  computer_networks: 'Computer Networks',
  operating_systems: 'Operating Systems',
  database_management_system: 'DBMS',
  software_engineering: 'Software Engg.',
  data_structures_and_algorithms: 'DSA',
  greedy: 'Greedy',
  math: 'Math',
  binary_search: 'Binary Search',
  two_pointers: 'Two Pointers',
  graph: 'Graph',
};

const DashboardPage = () => {
  const { expert, logout, updateProfile } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const { data } = await api.get('/chat/expert-rooms');
      setRooms(data);
    } catch (err) {
      console.error('Fetch rooms error:', err);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Are you sure you want to delete this session?')) return;
    try {
      await api.delete(`/chat/room/${roomId}`);
      fetchRooms();
    } catch (err) {
      console.error('Delete room error:', err);
      alert('Failed to delete session.');
    }
  };

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  // Listen for new user waiting events
  useEffect(() => {
    if (!socket || !expert) return;

    // Join personal expert channel for notifications
    socket.emit('joinExpertNotifications', { expertId: expert._id });

    socket.on('userWaiting', ({ roomId, message }) => {
      setNotifications(prev => [
        { roomId, message, id: Date.now() },
        ...prev.slice(0, 4), // keep last 5
      ]);
      // Refresh rooms list
      fetchRooms();
    });

    return () => {
      socket.off('userWaiting');
    };
  }, [socket, expert, fetchRooms]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleJoinRoom = (roomId) => {
    navigate(`/chat/${roomId}`);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile(editForm);
      setEditMode(false);
    } catch {}
    setSaving(false);
  };

  const openEdit = () => {
    setEditForm({ name: expert.name, description: expert.description });
    setEditMode(true);
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sideTop}>
          <span className={styles.logoText}>◈ ScholarSync</span>
        </div>

        <div className={styles.expertCard}>
          <div className={styles.avatarWrap}>
            <span className={styles.avatar}>{expert?.name?.[0] ?? '?'}</span>
            <span className={styles.onlineDot} title="Online" />
          </div>
          <div className={styles.expertInfo}>
            <div className={styles.expertName}>{expert?.name}</div>
            <div className={styles.expertSubject}>{SUBJECT_LABELS[expert?.subject] || expert?.subject}</div>
          </div>
        </div>

        {/* Description */}
        <div className={styles.descBlock}>
          <div className={styles.descLabel}>About</div>
          <p className={styles.descText}>{expert?.description}</p>
        </div>

        <div className={styles.sideActions}>
          <button className={styles.editBtn} onClick={openEdit}>Edit Profile</button>
          <button className={styles.logoutBtn} onClick={handleLogout}>Sign Out</button>
        </div>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.heading}>Dashboard</h1>
            <p className={styles.subheading}>Manage your chat sessions</p>
          </div>
          {notifications.length > 0 && (
            <div className={styles.notifBadge}>
              <span className="pulse">🔔</span> {notifications.length} new
            </div>
          )}
        </header>

        {/* Notifications */}
        {notifications.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>⚡ Incoming</h2>
            <div className={styles.notifList}>
              {notifications.map(n => (
                <div key={n.id} className={styles.notifCard}>
                  <div className={styles.notifMsg}>{n.message}</div>
                  <button
                    className={styles.joinBtn}
                    onClick={() => {
                      setNotifications(prev => prev.filter(x => x.id !== n.id));
                      handleJoinRoom(n.roomId);
                    }}
                  >
                    Join Now →
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Chat Rooms */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Sessions</h2>
            <button className={styles.refreshBtn} onClick={fetchRooms}>↺ Refresh</button>
          </div>

          {loadingRooms ? (
            <div className={styles.loader}><span className="spin">◌</span> Loading sessions…</div>
          ) : rooms.length === 0 ? (
            <div className={styles.emptyState}>
              <span>No sessions yet.</span>
              <p>When ScholarSync connects a user, rooms will appear here.</p>
            </div>
          ) : (
            <div className={styles.roomGrid}>
              {rooms.map(room => (
                <div key={room._id} className={styles.roomCard}>
                  <div className={styles.roomHeader}>
                    <span className={styles.roomId + ' mono'}>#{room.roomId.slice(0, 8)}…</span>
                    <span className={styles.roomSubject}>{SUBJECT_LABELS[room.subject] || room.subject}</span>
                  </div>
                  <div className={styles.roomMeta}>
                    <span>{formatTime(room.createdAt)}</span>
                    <span>{room.messageCount} messages</span>
                  </div>
                  {room.lastMessage && (
                    <div className={styles.lastMsg}>
                      "{room.lastMessage.message || '[file]'}"
                    </div>
                  )}
                  <div className={styles.roomActions}>
                    <button
                      className={styles.roomJoinBtn}
                      onClick={() => handleJoinRoom(room.roomId)}
                    >
                      Open Chat →
                    </button>
                    <button
                      className={styles.deleteSessionBtn}
                      onClick={() => handleDeleteRoom(room.roomId)}
                      title="Delete Session"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Edit Profile Modal */}
      {editMode && (
        <div className={styles.modalOverlay} onClick={() => setEditMode(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Edit Profile</h3>
            <label className={styles.formLabel}>
              Name
              <input
                className={styles.formInput}
                value={editForm.name}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
              />
            </label>
            <label className={styles.formLabel}>
              Description
              <textarea
                className={styles.formTextarea}
                value={editForm.description}
                rows={4}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
              />
            </label>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setEditMode(false)}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSaveProfile} disabled={saving}>
                {saving ? <span className="spin">◌</span> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
