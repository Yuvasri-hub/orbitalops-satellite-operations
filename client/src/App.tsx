import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ToastContainer, ToastItem } from './components/Toast';

// Views
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { SatellitesView } from './views/SatellitesView';
import { MissionsView } from './views/MissionsView';
import { GroundStationsView } from './views/GroundStationsView';
import { SimulatedTelemetryView } from './views/SimulatedTelemetryView';
import { MaintenanceView } from './views/MaintenanceView';
import { CommLogsView } from './views/CommLogsView';
import { UserManagementView } from './views/UserManagementView';

import {
  LayoutDashboard,
  Satellite,
  Compass,
  Radio,
  Activity,
  Wrench,
  MessageSquare,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { ROLES } from './context/AuthContext';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Guard active tab if user is not admin
  React.useEffect(() => {
    if (activeTab === 'users' && user?.role !== ROLES.ADMIN) {
      setActiveTab('dashboard');
    }
  }, [activeTab, user]);

  const addNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const tabs = [
    { id: 'dashboard', label: 'Mission Overview', icon: LayoutDashboard },
    { id: 'satellites', label: 'Satellites', icon: Satellite },
    { id: 'missions', label: 'Flight Missions', icon: Compass },
    { id: 'stations', label: 'Ground Stations', icon: Radio },
    { id: 'telemetry', label: 'Simulated Telemetry', icon: Activity },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'comm-logs', label: 'Transceiver Logs', icon: MessageSquare },
    ...(user?.role === ROLES.ADMIN
      ? [{ id: 'users', label: 'Personnel', icon: Users }]
      : []),
  ];

  // 1. Loading State while checking session
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="spinner" style={{ width: '48px', height: '48px', marginBottom: '1.25rem' }} />
        <h3 style={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: '1.25rem' }}>
          Space Mission Operations System
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.35rem', fontFamily: 'var(--font-mono)' }}>
          Verifying flight controller authentication session...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated State: Route Guard forces Login & Registration
  if (!user) {
    return (
      <>
        <LoginView onNotify={addNotification} />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  // 3. Authenticated State: Full Protected Mission Operations Console
  return (
    <div className="app-container">
      {/* Simulation Disclaimer Banner */}
      <div className="simulation-banner">
        <AlertTriangle size={15} color="#fde047" />
        <span>
          <strong>SIMULATED DEMO DATA ONLY:</strong> Spacecraft telemetry, orbits, and ground contacts are synthetically generated for mission operations demonstration.
        </span>
      </div>

      {/* Navigation Header */}
      <Navbar onNotify={addNotification} />

      {/* Module Navigation Bar */}
      <nav className="module-tabs">
        <div className="module-tabs-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <DashboardView onNavigate={setActiveTab} onNotify={addNotification} />
        )}
        {activeTab === 'satellites' && (
          <SatellitesView onNotify={addNotification} />
        )}
        {activeTab === 'missions' && (
          <MissionsView onNotify={addNotification} />
        )}
        {activeTab === 'stations' && (
          <GroundStationsView onNotify={addNotification} />
        )}
        {activeTab === 'telemetry' && (
          <SimulatedTelemetryView onNotify={addNotification} />
        )}
        {activeTab === 'maintenance' && (
          <MaintenanceView onNotify={addNotification} />
        )}
        {activeTab === 'comm-logs' && (
          <CommLogsView onNotify={addNotification} />
        )}
        {activeTab === 'users' && user?.role === ROLES.ADMIN && (
          <UserManagementView onNotify={addNotification} />
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(9, 14, 26, 0.95)',
          padding: '1.25rem 1.5rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            Space Mission Operations & Satellite Management System • React + TypeScript + Node.js + Express + PostgreSQL + Redis
          </div>
          <div>
            Space Mission Operations Platform • Flight Control Console
          </div>
        </div>
      </footer>

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};
export default App;
