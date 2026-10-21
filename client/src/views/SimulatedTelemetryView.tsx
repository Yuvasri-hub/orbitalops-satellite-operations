import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth, ROLES } from '../context/AuthContext';
import { Satellite as SatelliteType, TelemetryPoint } from '../types';
import {
  Activity,
  RefreshCw,
  Zap,
  Thermometer,
  Sun,
  Radio,
  AlertTriangle,
  Play,
  Cpu,
} from 'lucide-react';

interface SimulatedTelemetryViewProps {
  onNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const SimulatedTelemetryView: React.FC<SimulatedTelemetryViewProps> = ({ onNotify }) => {
  const { hasRole } = useAuth();
  const [satellites, setSatellites] = useState<SatelliteType[]>([]);
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [isCached, setIsCached] = useState<boolean>(false);

  const canGenerate = hasRole(ROLES.ADMIN, ROLES.OPERATOR);

  useEffect(() => {
    const fetchSatellites = async () => {
      try {
        const res = await api.satellites.getAll();
        if (res.success && res.data && res.data.length > 0) {
          setSatellites(res.data);
          setSelectedSatelliteId(res.data[0]._id);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch satellites';
        onNotify(msg, 'error');
      }
    };
    fetchSatellites();
  }, []);

  const fetchTelemetry = async () => {
    if (!selectedSatelliteId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params: Record<string, any> = {
        satellite: selectedSatelliteId,
        limit: 40,
      };
      if (startDate) params.startDate = new Date(startDate).toISOString();
      if (endDate) params.endDate = new Date(endDate).toISOString();

      const [resAll, resLatest] = await Promise.all([
        api.telemetry.getAll(params),
        api.telemetry.getLatestBySatellite(selectedSatelliteId).catch(() => null),
      ]);

      if (resAll.success && resAll.data) {
        setTelemetry(resAll.data);
      }
      if (resLatest && resLatest.cached) {
        setIsCached(true);
      } else {
        setIsCached(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch telemetry';
      onNotify(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, [selectedSatelliteId, startDate, endDate]);

  const handleGenerateBatch = async () => {
    if (!selectedSatelliteId) return;
    try {
      setGenerating(true);
      const res = await api.telemetry.generateBatch(selectedSatelliteId, 15);
      if (res.success) {
        onNotify(res.message || '15 telemetry frames synthesized.', 'success');
        fetchTelemetry();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate telemetry';
      onNotify(msg, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const latest = telemetry[0] || null;
  const currentSat = satellites.find((s) => s._id === selectedSatelliteId);

  // SVG Sparkline calculation for battery voltage trend
  const renderSparkline = (dataKey: keyof TelemetryPoint, strokeColor = '#00f0ff') => {
    if (telemetry.length < 2) return null;
    const values = telemetry.slice(0, 20).map((t) => Number(t[dataKey]) || 0).reverse();
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const width = 280;
    const height = 55;
    const points = values
      .map((val, idx) => {
        const x = (idx / (values.length - 1)) * (width - 20) + 10;
        const y = height - 10 - ((val - min) / range) * (height - 20);
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {values.map((val, idx) => {
          const x = (idx / (values.length - 1)) * (width - 20) + 10;
          const y = height - 10 - ((val - min) / range) * (height - 20);
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r={idx === values.length - 1 ? 4 : 2}
              fill={strokeColor}
            />
          );
        })}
      </svg>
    );
  };

  return (
    <div>
      {/* Prominent Simulated Data Warning Notice */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(2, 132, 199, 0.2) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.5)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
        }}
      >
        <AlertTriangle size={24} color="#fde047" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, color: '#fef08a', fontSize: '0.92rem', fontFamily: 'var(--font-mono)' }}>
            DEMONSTRATION NOTICE: ALL TELEMETRY IS STRICTLY SYNTHESIZED SIMULATED DATA
          </div>
          <div style={{ fontSize: '0.78rem', color: '#fde68a', marginTop: '2px' }}>
            Telemetry sensor points, battery voltages, temperatures, and signal strengths are generated by the server mathematical simulation engine, persisted to PostgreSQL, and cached in Redis.
          </div>
        </div>
      </div>

      {/* Header and Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2>Simulated Telemetry Visualizer</h2>
            {isCached && (
              <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', fontSize: '0.72rem' }}>
                <Zap size={10} style={{ display: 'inline', marginRight: '3px' }} /> Redis Fast Cache
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Downlinked flight instrument parameters, power subsystem health, and RF link metrics
          </p>
        </div>

        {canGenerate && (
          <button
            className="btn btn-primary"
            onClick={handleGenerateBatch}
            disabled={generating || !selectedSatelliteId}
            title="Generate 15 fresh simulated telemetry frames for the selected spacecraft"
          >
            <Play size={16} />
            {generating ? 'Synthesizing...' : 'Generate 15 Simulated Frames'}
          </button>
        )}
      </div>

      {/* Satellite and Date Range Filter Bar */}
      <div className="filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>SELECT SATELLITE:</label>
          <select
            className="select-filter"
            value={selectedSatelliteId}
            onChange={(e) => setSelectedSatelliteId(e.target.value)}
            style={{ minWidth: '240px' }}
          >
            {satellites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} ({s.noradId} - {s.orbitType})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>From:</span>
            <input
              type="date"
              className="form-control mono"
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', width: 'auto' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>To:</span>
            <input
              type="date"
              className="form-control mono"
              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', width: 'auto' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {(startDate || endDate) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setStartDate(''); setEndDate(''); }}
            >
              Reset Dates
            </button>
          )}

          <button className="btn btn-secondary btn-sm" onClick={fetchTelemetry}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="state-box">
          <div className="spinner" />
          <p>Processing downlinked telemetry frames...</p>
        </div>
      ) : !latest ? (
        <div className="state-box">
          <Activity size={48} />
          <h4>No simulated telemetry found for {currentSat?.name || 'satellite'}</h4>
          <p style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>
            Click the button below to generate a batch of realistic simulated telemetry data points.
          </p>
          {canGenerate && (
            <button className="btn btn-primary" onClick={handleGenerateBatch} disabled={generating}>
              <Play size={16} /> Generate Simulated Telemetry
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Real-time Telemetry Sensor Cards */}
          <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
            {/* Battery Voltage */}
            <div className="kpi-card">
              <div className="kpi-icon blue"><Zap size={22} /></div>
              <div className="kpi-details" style={{ width: '100%' }}>
                <div className="kpi-label">Main Bus Voltage</div>
                <div className="kpi-value">{latest.batteryVoltage} <span style={{ fontSize: '1rem' }}>V</span></div>
                <div className="kpi-subtext" style={{ marginTop: '4px' }}>
                  {renderSparkline('batteryVoltage', '#00f0ff')}
                </div>
              </div>
            </div>

            {/* Battery Temperature */}
            <div className="kpi-card">
              <div className="kpi-icon amber"><Thermometer size={22} /></div>
              <div className="kpi-details" style={{ width: '100%' }}>
                <div className="kpi-label">Battery Core Temp</div>
                <div className="kpi-value">{latest.batteryTemperature} <span style={{ fontSize: '1rem' }}>°C</span></div>
                <div className="kpi-subtext" style={{ marginTop: '4px' }}>
                  {renderSparkline('batteryTemperature', '#fbbf24')}
                </div>
              </div>
            </div>

            {/* Solar Panel Current */}
            <div className="kpi-card">
              <div className="kpi-icon emerald"><Sun size={22} /></div>
              <div className="kpi-details" style={{ width: '100%' }}>
                <div className="kpi-label">Solar Array Output</div>
                <div className="kpi-value">{latest.solarPanelCurrent} <span style={{ fontSize: '1rem' }}>A</span></div>
                <div className="kpi-subtext" style={{ marginTop: '4px' }}>
                  {renderSparkline('solarPanelCurrent', '#34d399')}
                </div>
              </div>
            </div>

            {/* RF Signal Strength */}
            <div className="kpi-card">
              <div className="kpi-icon rose"><Radio size={22} /></div>
              <div className="kpi-details" style={{ width: '100%' }}>
                <div className="kpi-label">RF Signal SNR</div>
                <div className="kpi-value">{latest.signalStrengthDbm} <span style={{ fontSize: '1rem' }}>dBm</span></div>
                <div className="kpi-subtext" style={{ marginTop: '4px' }}>
                  {renderSparkline('signalStrengthDbm', '#fb7185')}
                </div>
              </div>
            </div>
          </div>

          {/* Subsystem Health Status Bar */}
          <div
            className="glass-panel"
            style={{
              marginBottom: '1.5rem',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Cpu size={20} color="var(--cyan-neon)" />
              <div>
                <strong style={{ fontSize: '0.85rem' }}>Avionics Subsystems (Latest Frame: {new Date(latest.timestamp).toLocaleTimeString()} UTC)</strong>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Payload Mode: <strong style={{ color: 'var(--emerald-success)' }}>{latest.payloadStatus}</strong> • Velocity: {latest.orbitVelocityKmS} km/s • Altitude: {latest.altitudeKm} km
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge badge-nominal">OBC: {latest.subsystems?.obc || 'NOMINAL'}</span>
              <span className="badge badge-nominal">AOCS: {latest.subsystems?.aocs || 'LOCKED'}</span>
              <span className="badge badge-nominal">COMM: {latest.subsystems?.comm || 'ACTIVE'}</span>
              <span className="badge badge-nominal">EPS: {latest.subsystems?.eps || 'NOMINAL'}</span>
            </div>
          </div>

          {/* Tabular Telemetry History */}
          <div className="glass-panel">
            <div className="panel-header">
              <h3>
                <Activity size={18} color="var(--cyan-neon)" />
                Historical Downlink Frame Log ({telemetry.length} Frames Loaded)
              </h3>
              <span className="mono" style={{ fontSize: '0.72rem', color: '#fde047' }}>
                * SIMULATED VALUES
              </span>
            </div>

            <div className="telemetry-table-wrapper">
              <table className="telemetry-table">
                <thead>
                  <tr>
                    <th>Timestamp (UTC)</th>
                    <th>Voltage (V)</th>
                    <th>Temp (°C)</th>
                    <th>Solar (A)</th>
                    <th>Signal (dBm)</th>
                    <th>Velocity (km/s)</th>
                    <th>Altitude (km)</th>
                    <th>Payload Status</th>
                    <th>Tag</th>
                  </tr>
                </thead>
                <tbody>
                  {telemetry.map((t) => (
                    <tr key={t._id}>
                      <td>{new Date(t.timestamp).toISOString().replace('T', ' ').slice(0, 19)}</td>
                      <td style={{ color: t.batteryVoltage < 26 ? '#f87171' : 'var(--text-primary)' }}>
                        {t.batteryVoltage} V
                      </td>
                      <td>{t.batteryTemperature} °C</td>
                      <td>{t.solarPanelCurrent} A</td>
                      <td>{t.signalStrengthDbm} dBm</td>
                      <td>{t.orbitVelocityKmS}</td>
                      <td>{t.altitudeKm}</td>
                      <td>
                        <span className={`badge ${t.payloadStatus === 'Nominal' ? 'badge-nominal' : 'badge-high'}`}>
                          {t.payloadStatus}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.68rem', color: '#fde047', background: 'rgba(245,158,11,0.15)', padding: '2px 5px', borderRadius: '3px' }}>
                          SIMULATED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
