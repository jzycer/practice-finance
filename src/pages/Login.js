import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showReset, setShowReset] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    if (!email) return setError('Enter your email above first.');
    try {
      await resetPassword(email);
      setResetSent(true);
      setShowReset(false);
    } catch {
      setError('Could not send reset email.');
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">♥</div>
          <h1>Practice Finance</h1>
          <p>Financial management for your practice</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {resetSent && <div className="alert alert-success">Password reset email sent.</div>}

        <form onSubmit={handleLogin} className="login-form">
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="doctor@practice.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <button className="link-btn" onClick={() => setShowReset(!showReset)}>
          Forgot password?
        </button>
        {showReset && (
          <button className="link-btn small" onClick={handleReset}>
            Send reset link to {email || 'your email'}
          </button>
        )}
      </div>
    </div>
  );
}
