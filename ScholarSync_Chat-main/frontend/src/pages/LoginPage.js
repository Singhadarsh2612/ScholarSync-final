import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './LoginPage.module.css';

const LoginPage = () => {
  const { login, expert } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  if (expert) { navigate('/dashboard'); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Background grid */}
      <div className={styles.grid} aria-hidden="true" />

      <div className={styles.card + ' page-enter'}>
        <div className={styles.logoRow}>
          <span className={styles.logoIcon}>◈</span>
          <span className={styles.logoText}>ScholarSync</span>
        </div>

        <h1 className={styles.title}>Expert Portal</h1>
        <p className={styles.subtitle}>Sign in to access your dashboard</p>

        {error && <div className={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>
            <span>Email</span>
            <input
              type="email"
              className={styles.input}
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="you@scholarsync.com"
              required
              autoComplete="email"
            />
          </label>

          <label className={styles.label}>
            <span>Password</span>
            <input
              type="password"
              className={styles.input}
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </label>

          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? <span className="spin">◌</span> : 'Sign In →'}
          </button>
        </form>

        <p className={styles.hint}>
          Only registered subject experts can log in.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
