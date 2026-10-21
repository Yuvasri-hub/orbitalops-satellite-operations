import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Radio,
  Clock,
  LogOut,
  LogIn,
  Activity,
} from 'lucide-react';

interface NavbarProps {
  onOpenAuth?: () => void;
  onNotify?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuth }) => {
  const { user, logout } = useAuth();
  const [utcTime, setUtcTime] = useState<string>('');
  const [localTime, setLocalTime] = useState<string>('');

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().slice(17, 25) + ' UTC');
      setLocalTime(now.toLocaleTimeString([], { hour12: false }));
    };
    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="mission-header">
      <div className="header-inner">
        {/* Brand */}
        <div className="brand-section">
          <div className="brand-icon-wrapper">
            <Radio size={24} />
          </div>
          <div className="brand-titles">
            <h1>Space Mission Operations</h1>
            <div className="subtitle">
              <span>SATELLITE MANAGEMENT SYSTEM</span>
              <span>•</span>
              <span style={{ color: 'var(--cyan-neon)' }}>FLIGHT CONTROL CONSOLE</span>
            </div>
          </div>
        </div>

        {/* Real-time clocks & Subsystem status */}
        <div className="clocks-strip">
          <div className="clock-item">
            <Clock size={14} />
            <span>UTC:</span>
            <strong>{utcTime || '--:--:--'}</strong>
          </div>
          <div className="clock-item">
            <span>LOC:</span>
            <strong>{localTime || '--:--:--'}</strong>
          </div>
          <div
            className="connected-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.25rem 0.65rem',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.74rem',
              color: 'var(--emerald-success)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span className="ping-dot" style={{ background: 'var(--emerald-success)' }} />
            <Activity size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />
            <span>OPERATIONS ONLINE</span>
          </div>
        </div>

        {/* User Info & Actions */}
        <div className="header-actions">
          {user ? (
            <>
              {/* User profile card */}
              <div className="user-badge">
                <div className="user-avatar">{user.name.charAt(0)}</div>
                <div className="user-info">
                  <div className="user-name">{user.name} ({user.callsign})</div>
                  <div className="user-role">{user.role}</div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={logout}
                title="Sign out of flight session"
              >
                <LogOut size={14} />
                <span style={{ marginLeft: '4px' }}>Sign Out</span>
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={onOpenAuth}>
              <LogIn size={14} /> Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
