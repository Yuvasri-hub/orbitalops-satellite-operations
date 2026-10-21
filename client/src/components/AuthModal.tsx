import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, UserPlus, X, KeyRound, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onNotify }) => {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [callsign, setCallsign] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  if (!isOpen) return null;

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
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify password confirmation.');
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
    } catch (err: any) {
      setError(err.message || 'Registration failed. A user with this email may already exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h3>
            <KeyRound size={20} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
            {tab === 'login' ? 'Mission Control Authentication' : 'Register Operator Account'}
          </h3>
          <button onClick={onClose} className="btn-secondary btn-sm" style={{ padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Form Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <button
              type="button"
              className={`btn btn-sm ${tab === 'login' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => {
                setTab('login');
                setError('');
                setSuccess('');
              }}
            >
              <LogIn size={14} /> Sign In
            </button>
            <button
              type="button"
              className={`btn btn-sm ${tab === 'register' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => {
                setTab('register');
                setError('');
                setSuccess('');
              }}
            >
              <UserPlus size={14} /> Register
            </button>
          </div>

          {error && (
            <div className="conflict-alert" style={{ marginBottom: '1rem' }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              style={{
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 'var(--radius-sm)',
                color: '#a7f3d0',
                fontSize: '0.82rem',
              }}
            >
              <CheckCircle2 size={16} color="#34d399" />
              <span>{success}</span>
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label>Email Address</label>
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
              <div className="form-group">
                <label>Access Password</label>
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
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={loading}
              >
                {loading ? 'Authenticating...' : 'Sign In to Mission Control'}
              </button>

              <div
                style={{
                  marginTop: '1.25rem',
                  padding: '0.75rem',
                  background: 'rgba(11, 18, 33, 0.7)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.2rem' }}>
                  Demo Accounts Reference:
                </div>
                <div>Director: <code className="mono">admin@spaceops.local</code></div>
                <div>Operator: <code className="mono">operator@spaceops.local</code></div>
                <div>Default Password: <code className="mono">MissionControl2026!</code></div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Cadet John Glen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="jglen@spaceops.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Flight Callsign</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="OPS-CADET"
                    value={callsign}
                    onChange={(e) => setCallsign(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Password</label>
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
              <div className="form-group">
                <label>Confirm Password</label>
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
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                * Self-registered accounts are automatically assigned the standard <strong>Mission Operator</strong> role. Users cannot grant themselves Admin privileges.
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Registering...' : 'Create Mission Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
