import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth, ROLES } from '../context/AuthContext';
import { CommLog, Mission, GroundStation } from '../types';
import {
  Radio,
  Search,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

interface CommLogsViewProps {
  onNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const CommLogsView: React.FC<CommLogsViewProps> = ({ onNotify }) => {
  const { hasRole } = useAuth();
  const [logs, setLogs] = useState<CommLog[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [stations, setStations] = useState<GroundStation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [missionFilter, setMissionFilter] = useState<string>('');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('');

  // Modal & form
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    mission: '',
    groundStation: '',
    logType: 'Telemetry Pass' as 'Telemetry Pass' | 'Command Uplink' | 'Payload Downlink' | 'Anomaly Report' | 'Handover' | 'Voice Check',
    message: '',
    signalQuality: 'Nominal' as 'Nominal' | 'Degraded' | 'Marginal' | 'Loss of Signal',
    frequencyMhz: 2200.5,
  });

  const canManage = hasRole(ROLES.ADMIN, ROLES.OPERATOR);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (missionFilter) params.mission = missionFilter;
      if (logTypeFilter) params.logType = logTypeFilter;

      const [logsRes, missionsRes, stationsRes] = await Promise.all([
        api.commLogs.getAll(params),
        api.missions.getAll(),
        api.stations.getAll(),
      ]);

      if (logsRes.success && logsRes.data) setLogs(logsRes.data);
      if (missionsRes.success && missionsRes.data) setMissions(missionsRes.data);
      if (stationsRes.success && stationsRes.data) setStations(stationsRes.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch communication logs';
      onNotify(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, missionFilter, logTypeFilter]);

  const handleOpenCreate = () => {
    setFormData({
      mission: missions[0]?._id || '',
      groundStation: '',
      logType: 'Telemetry Pass',
      message: '',
      signalQuality: 'Nominal',
      frequencyMhz: 2200.5,
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.commLogs.create({
        ...formData,
        groundStation: formData.groundStation || null,
      });
      onNotify('Flight communication entry logged to mission book.', 'success');
      setIsModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      onNotify(msg, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this communication record?')) return;
    try {
      await api.commLogs.delete(id);
      onNotify('Communication log entry removed.', 'success');
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete record';
      onNotify(msg, 'error');
    }
  };

  return (
    <div>
      {/* Title & Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Mission Communications Logbook</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            RF uplink transmissions, pass handovers, command execution, and flight loop logs
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Record Transmission
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="Search communications by keywords or transcript..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="select-filter"
          value={missionFilter}
          onChange={(e) => setMissionFilter(e.target.value)}
        >
          <option value="">All Missions</option>
          {missions.map((m) => (
            <option key={m._id} value={m._id}>{m.name}</option>
          ))}
        </select>

        <select
          className="select-filter"
          value={logTypeFilter}
          onChange={(e) => setLogTypeFilter(e.target.value)}
        >
          <option value="">All Entry Types</option>
          <option value="Telemetry Pass">Telemetry Pass</option>
          <option value="Command Uplink">Command Uplink</option>
          <option value="Payload Downlink">Payload Downlink</option>
          <option value="Anomaly Report">Anomaly Report</option>
          <option value="Handover">Station Handover</option>
          <option value="Voice Check">Flight Loop Voice Check</option>
        </select>
      </div>

      {/* Communications Feed */}
      {loading ? (
        <div className="state-box">
          <div className="spinner" />
          <p>Decrypting transceiver logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="state-box">
          <Radio size={48} />
          <h4>No communication log entries</h4>
          <p style={{ fontSize: '0.82rem' }}>Transceiver channel is clear. Record a transmission pass entry.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {logs.map((log) => (
            <div
              key={log._id}
              className="glass-panel"
              style={{
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                  <span
                    className="badge"
                    style={{
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: 'var(--cyan-neon)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                    }}
                  >
                    {log.logType}
                  </span>

                  <span
                    className={`badge ${log.signalQuality === 'Nominal' ? 'badge-nominal' : 'badge-high'}`}
                  >
                    Signal: {log.signalQuality}
                  </span>

                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Freq: {log.frequencyMhz} MHz
                  </span>

                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })} UTC
                  </span>
                </div>

                <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                  {log.message}
                </div>

                <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span>Mission: <strong style={{ color: 'var(--cyan-neon)' }}>{typeof log.mission === 'object' && log.mission ? log.mission.name : 'General Flight'}</strong></span>
                  {log.groundStation && <span>Station: {typeof log.groundStation === 'object' ? log.groundStation.name : log.groundStation}</span>}
                  <span>Operator: {typeof log.createdBy === 'object' && log.createdBy ? `${log.createdBy.name} (${log.createdBy.callsign || 'OPS'})` : 'Flight Ops'}</span>
                </div>
              </div>

              {canManage && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(log._id)}
                  title="Delete log record"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmitForm}>
              <div className="modal-header">
                <h3>Record Flight Communication Entry</h3>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}><X size={14} /></button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>Linked Flight Mission</label>
                  <select
                    className="form-control"
                    value={formData.mission}
                    onChange={(e) => setFormData({ ...formData, mission: e.target.value })}
                    required
                  >
                    <option value="">Select Mission</option>
                    {missions.map((m) => (
                      <option key={m._id} value={m._id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Transmission Type</label>
                    <select
                      className="form-control"
                      value={formData.logType}
                      onChange={(e) => setFormData({ ...formData, logType: e.target.value as any })}
                    >
                      <option value="Telemetry Pass">Telemetry Pass</option>
                      <option value="Command Uplink">Command Uplink</option>
                      <option value="Payload Downlink">Payload Downlink</option>
                      <option value="Anomaly Report">Anomaly Report</option>
                      <option value="Handover">Handover</option>
                      <option value="Voice Check">Flight Loop Voice Check</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>RF Signal Quality</label>
                    <select
                      className="form-control"
                      value={formData.signalQuality}
                      onChange={(e) => setFormData({ ...formData, signalQuality: e.target.value as any })}
                    >
                      <option value="Nominal">Nominal (SNR &gt; 14dB)</option>
                      <option value="Degraded">Degraded (SNR 8-14dB)</option>
                      <option value="Marginal">Marginal (Carrier Lock Only)</option>
                      <option value="Loss of Signal">Loss of Signal (LOS)</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Ground Tracking Terminal</label>
                    <select
                      className="form-control"
                      value={formData.groundStation}
                      onChange={(e) => setFormData({ ...formData, groundStation: e.target.value })}
                    >
                      <option value="">Default Station for Mission</option>
                      {stations.map((st) => (
                        <option key={st._id} value={st._id}>{st.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Center Frequency (MHz)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control mono"
                      value={formData.frequencyMhz}
                      onChange={(e) => setFormData({ ...formData, frequencyMhz: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Transmission Message & Transcript</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="e.g. Uplink command packet #0492 sent. Flight computer acknowledgment verified."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Transmission</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
