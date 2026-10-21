import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Radio,
  LogIn,
  UserPlus,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Mail,
  User,
  Shield,
} from 'lucide-react';

interface LoginViewProps {
  onNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onNotify }) => {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [callsign, setCallsign] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await login(email, password);
      if (onNotify) {
        onNotify('Authenticated successfully. Welcome to Mission Operations!', 'success');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed. Please verify your email and password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please ensure both passwords match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      await register({
        name,
        email,
        password,
        passwordConfirm: confirmPassword,
        callsign,
      });

      // Clear password fields and switch to login tab
      const registeredEmail = email;
      setPassword('');
      setConfirmPassword('');
      setError('');
      setSuccess('Account registered successfully! Please enter your password to sign in.');
      setTab('login');
      setEmail(registeredEmail);

      if (onNotify) {
        onNotify('Registration successful! Please sign in with your email and password.', 'success');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. A user with this email may already exist.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem 1rem',
        background: 'radial-gradient(ellipse at top, #0f1c3f 0%, #060913 70%)',
      }}
    >
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(56, 189, 248, 0.05) 100%)',
            border: '1px solid var(--border-hover)',
            marginBottom: '1rem',
            boxShadow: '0 0 25px rgba(0, 240, 255, 0.25)',
          }}
        >
          <Radio size={32} color="var(--cyan-neon)" />
        </div>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
          Space Mission Operations
        </h1>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
            marginTop: '0.35rem',
            letterSpacing: '0.08em',
          }}
        >
          SATELLITE MANAGEMENT SYSTEM • FLIGHT CONTROL CONSOLE
        </div>
      </div>

      {/* Auth Card */}
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '2rem',
          boxShadow: 'var(--shadow-lg), 0 0 30px rgba(0, 240, 255, 0.12)',
          border: '1px solid var(--border-hover)',
        }}
      >
        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            background: 'rgba(6, 9, 19, 0.6)',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            type="button"
            className={`btn btn-sm ${tab === 'login' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, border: 'none' }}
            onClick={() => {
              setTab('login');
              setError('');
              setSuccess('');
            }}
          >
            <LogIn size={15} /> Sign In
          </button>
          <button
            type="button"
            className={`btn btn-sm ${tab === 'register' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, border: 'none' }}
            onClick={() => {
              setTab('register');
              setError('');
              setSuccess('');
            }}
          >
            <UserPlus size={15} /> Register Account
          </button>
        </div>

        {/* Notifications / Alerts */}
        {error && (
          <div
            className="conflict-alert"
            style={{
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.85rem 1rem',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              borderRadius: 'var(--radius-sm)',
              color: '#fecdd3',
              fontSize: '0.85rem',
            }}
          >
            <AlertTriangle size={18} color="#fb7185" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            style={{
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.85rem 1rem',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: 'var(--radius-sm)',
              color: '#a7f3d0',
              fontSize: '0.85rem',
            }}
          >
            <CheckCircle2 size={18} color="#34d399" style={{ flexShrink: 0 }} />
            <span>{success}</span>
          </div>
        )}

        {/* Form Content */}
        {tab === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                <Mail size={14} color="var(--cyan-neon)" /> Email Address
              </label>
              <input
                type="email"
                className="form-control"
                placeholder="e.g. operator@spaceops.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                <Lock size={14} color="var(--cyan-neon)" /> Access Password
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.92rem', justifyContent: 'center' }}
              disabled={loading}
            >
              <LogIn size={16} />
              {loading ? 'Verifying Credentials...' : 'Sign In to Mission Control'}
            </button>

            {/* Informational Seed Reference */}
            <div
              style={{
                marginTop: '1.5rem',
                padding: '0.85rem',
                background: 'rgba(11, 18, 33, 0.7)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.74rem',
                color: 'var(--text-muted)',
                lineHeight: 1.6,
              }}
            >
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                PRE-CONFIGURED SEEDED CREDENTIALS:
              </div>
              <div>• Admin / Flight Director: <code className="mono">admin@spaceops.local</code></div>
              <div>• Mission Operator: <code className="mono">operator@spaceops.local</code></div>
              <div>• Station Coordinator: <code className="mono">coordinator@spaceops.local</code></div>
              <div>• Maintenance Engineer: <code className="mono">engineer@spaceops.local</code></div>
              <div style={{ marginTop: '0.35rem' }}>Default Password: <code className="mono">MissionControl2026!</code></div>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                <User size={14} color="var(--cyan-neon)" /> Full Name
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Cadet John Glenn"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-grid-2" style={{ marginBottom: '1rem' }}>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                  <Mail size={14} color="var(--cyan-neon)" /> Email Address
                </label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="cadet@spaceops.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                  <Shield size={14} color="var(--cyan-neon)" /> Callsign
                </label>
                <input
                  type="text"
                  className="form-control mono"
                  placeholder="OPS-CADET"
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                <Lock size={14} color="var(--cyan-neon)" /> Password
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                <KeyRound size={14} color="var(--cyan-neon)" /> Confirm Password
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            <div
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-muted)',
                marginBottom: '1.25rem',
                lineHeight: 1.5,
              }}
            >
              * Self-registered accounts are automatically assigned the standard <strong>Mission Operator</strong> role. Public accounts cannot grant themselves Admin or director privileges.
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.92rem', justifyContent: 'center' }}
              disabled={loading}
            >
              <UserPlus size={16} />
              {loading ? 'Creating Account...' : 'Register Operator Account'}
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: '2rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
          textAlign: 'center',
        }}
      >
        Space Mission Operations & Satellite Management System • Authorized Personnel Only
      </div>
    </div>
  );
};
