import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { DashboardSummaryData, SystemAlert } from '../types';
import {
  Satellite,
  Compass,
  Radio,
  Wrench,
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ShieldAlert,
  Zap,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tabId: string) => void;
  onNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [data, setData] = useState<DashboardSummaryData | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [alertsCached, setAlertsCached] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const [resSummary, resAlerts] = await Promise.all([
        api.dashboard.getSummary(),
        api.dashboard.getAlerts().catch(() => ({ success: false, data: [], cached: false })),
      ]);

      if (resSummary.success && resSummary.data) {
        setData(resSummary.data);
      }
      if (resAlerts.success && resAlerts.data) {
        setAlerts(resAlerts.data);
        setAlertsCached(Boolean(resAlerts.cached));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch dashboard data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="state-box">
        <div className="spinner" />
        <h4>Accessing Orbital Operations Feed...</h4>
        <p style={{ fontSize: '0.82rem' }}>Retrieving telemetry streams and active satellite tracking passes from PostgreSQL & Redis cache.</p>
      </div>
    );
  }

  return (
    <div>
      {/* KPI Stats Overview Grid */}
      <div className="kpi-grid">
        <div className="kpi-card" onClick={() => onNavigate('satellites')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon blue">
            <Satellite size={24} />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">Active Satellites</div>
            <div className="kpi-value">{data?.metrics?.satellites?.active ?? 0} / {data?.metrics?.satellites?.total ?? 0}</div>
            <div className="kpi-subtext">Constellation in orbit</div>
          </div>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('missions')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon emerald">
            <Compass size={24} />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">Active Missions</div>
            <div className="kpi-value">{data?.metrics?.missions?.inProgress ?? 0}</div>
            <div className="kpi-subtext">{data?.metrics?.missions?.planned ?? 0} scheduled passes</div>
          </div>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('stations')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon amber">
            <Radio size={24} />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">Ground Stations</div>
            <div className="kpi-value">{data?.metrics?.groundStations?.available ?? 0} / {data?.metrics?.groundStations?.total ?? 0}</div>
            <div className="kpi-subtext">Available tracking terminals</div>
          </div>
        </div>

        <div className="kpi-card" onClick={() => onNavigate('maintenance')} style={{ cursor: 'pointer' }}>
          <div className="kpi-icon rose">
            <Wrench size={24} />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">Open Maintenance</div>
            <div className="kpi-value">{data?.metrics?.maintenance?.open ?? 0}</div>
            <div className="kpi-subtext">{data?.metrics?.maintenance?.critical ?? 0} critical priority</div>
          </div>
        </div>
      </div>

      {/* Real-time System Alerts Banner (Powered by Redis) */}
      {alerts && alerts.length > 0 && (
        <div className="glass-panel" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--accent-rose, #f43f5e)' }}>
          <div className="panel-header" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShieldAlert size={18} color="#f43f5e" />
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Mission Operations Active Alerts</h3>
              {alertsCached && (
                <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.4)', fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Zap size={10} /> Redis Cached
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {alerts.length} Flagged Incident{alerts.length > 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.65rem' }}>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: `1px solid ${alert.severity === 'Critical' ? 'rgba(244, 63, 94, 0.4)' : 'rgba(234, 179, 8, 0.3)'}`,
                  borderRadius: 'var(--radius-sm, 6px)',
                  padding: '0.65rem 0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.82rem', color: alert.severity === 'Critical' ? '#fda4af' : '#fde047' }}>
                    {alert.source}
                  </span>
                  <span className={`badge ${alert.severity === 'Critical' ? 'badge-critical' : 'badge-high'}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                    {alert.severity}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {alert.message}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                  {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Dashboard Two-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Active & Upcoming Missions List */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3>
              <Compass size={18} color="var(--cyan-neon)" />
              Mission Timeline & Tracking Passes
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('missions')}>
              View All <ArrowUpRight size={14} />
            </button>
          </div>

          {(!data?.activeMissions || data.activeMissions.length === 0) ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No active or scheduled flight missions recorded.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.activeMissions.map((m) => (
                <div
                  key={m._id}
                  style={{
                    background: 'rgba(11, 18, 33, 0.6)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{m.name}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      Sat: <strong style={{ color: 'var(--cyan-neon)' }}>{typeof m.satellite === 'object' && m.satellite ? m.satellite.name : 'Unassigned'}</strong> • Station: {typeof m.assignedStation === 'object' && m.assignedStation ? `${m.assignedStation.name} (${m.assignedStation.country})` : 'Autonomous Flight'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${m.status === 'In Progress' ? 'badge-in-progress' : 'badge-planned'}`}>
                      {m.status}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                      {new Date(m.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ground Station Readiness Status */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3>
              <Radio size={18} color="var(--amber-warning)" />
              Ground Tracking Network Status
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('stations')}>
              Network Map <ArrowUpRight size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {data?.stations?.map((st) => (
              <div
                key={st._id}
                style={{
                  background: 'rgba(11, 18, 33, 0.6)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span className={`badge ${st.status === 'Available' ? 'badge-available' : st.status === 'Busy' ? 'badge-busy' : 'badge-offline'}`}>
                    {st.status}
                  </span>
                  <span className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {st.dishDiameterMeters}m {st.frequencyBand}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{st.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  {st.city}, {st.country}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Simulated Telemetry Feed Section */}
      <div className="glass-panel">
        <div className="panel-header">
          <div>
            <h3>
              <Activity size={18} color="var(--emerald-success)" />
              Simulated Telemetry Stream (Recent Frames)
            </h3>
            <div style={{ fontSize: '0.72rem', color: '#fde047', fontFamily: 'var(--font-mono)' }}>
              * STRICTLY SIMULATED DEMO DATA — Synthesized for mission operations display
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('telemetry')}>
            Telemetry Visualizer <ArrowUpRight size={14} />
          </button>
        </div>

        {(!data?.recentTelemetry || data.recentTelemetry.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No simulated telemetry records found. Go to Telemetry tab to generate simulated frames.
          </div>
        ) : (
          <div className="telemetry-table-wrapper">
            <table className="telemetry-table">
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Satellite</th>
                  <th>Battery (V)</th>
                  <th>Temp (°C)</th>
                  <th>Solar Array (A)</th>
                  <th>Signal SNR</th>
                  <th>Subsystems</th>
                  <th>Payload Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentTelemetry.map((t) => (
                  <tr key={t._id}>
                    <td>{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    <td style={{ color: 'var(--cyan-neon)' }}>{typeof t.satellite === 'object' && t.satellite ? t.satellite.name : 'Orbiter'}</td>
                    <td>{t.batteryVoltage} V</td>
                    <td>{t.batteryTemperature} °C</td>
                    <td>{t.solarPanelCurrent} A</td>
                    <td>{t.signalStrengthDbm} dBm</td>
                    <td>
                      <span style={{ fontSize: '0.7rem', color: 'var(--emerald-success)' }}>
                        OBC:{t.subsystems?.obc || 'OK'} • COMM:{t.subsystems?.comm || 'OK'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${t.payloadStatus === 'Nominal' ? 'badge-nominal' : 'badge-high'}`}>
                        {t.payloadStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
