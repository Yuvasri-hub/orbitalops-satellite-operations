import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth, ROLES } from '../context/AuthContext';
import { Mission, Satellite, GroundStation } from '../types';
import {
  Compass,
  Search,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Satellite as SatelliteIcon } from 'lucide-react';

interface MissionsViewProps {
  onNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const MissionsView: React.FC<MissionsViewProps> = ({ onNotify }) => {
  const { hasRole } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [stations, setStations] = useState<GroundStation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [satelliteFilter, setSatelliteFilter] = useState<string>('');

  // Modals & Form
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    satellite: '',
    description: '',
    startTime: '',
    endTime: '',
    status: 'Planned' as 'Planned' | 'In Progress' | 'Completed' | 'On Hold' | 'Aborted',
    assignedStation: '',
    priority: 'Routine' as 'Routine' | 'Medium' | 'High' | 'Critical',
  });

  const canManage = hasRole(ROLES.ADMIN, ROLES.OPERATOR, ROLES.COORDINATOR);
  const canDelete = hasRole(ROLES.ADMIN, ROLES.OPERATOR);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (statusFilter) params.status = statusFilter;
      if (satelliteFilter) params.satellite = satelliteFilter;

      const [missionRes, satRes, stationRes] = await Promise.all([
        api.missions.getAll(params),
        api.satellites.getAll(),
        api.stations.getAll(),
      ]);

      if (missionRes.success && missionRes.data) setMissions(missionRes.data);
      if (satRes.success && satRes.data) setSatellites(satRes.data);
      if (stationRes.success && stationRes.data) setStations(stationRes.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch mission data';
      onNotify(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, statusFilter, satelliteFilter]);

  const handleOpenCreate = () => {
    setEditingMission(null);
    setConflictError(null);
    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000).toISOString().slice(0, 16);
    const end = new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16);

    setFormData({
      name: '',
      satellite: satellites[0]?._id || '',
      description: '',
      startTime: start,
      endTime: end,
      status: 'Planned',
      assignedStation: '',
      priority: 'Routine',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (mission: Mission) => {
    setEditingMission(mission);
    setConflictError(null);
    const start = new Date(mission.startTime).toISOString().slice(0, 16);
    const end = new Date(mission.endTime).toISOString().slice(0, 16);

    setFormData({
      name: mission.name,
      satellite: typeof mission.satellite === 'object' && mission.satellite ? mission.satellite._id : String(mission.satellite || ''),
      description: mission.description || '',
      startTime: start,
      endTime: end,
      status: mission.status,
      assignedStation: typeof mission.assignedStation === 'object' && mission.assignedStation ? mission.assignedStation._id : String(mission.assignedStation || ''),
      priority: mission.priority || 'Routine',
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError(null);

    // Validate client-side start < end
    if (new Date(formData.startTime) >= new Date(formData.endTime)) {
      setConflictError('Mission start time must be before end time.');
      return;
    }

    try {
      const payload = {
        ...formData,
        assignedStation: formData.assignedStation || null,
      };

      if (editingMission) {
        await api.missions.update(editingMission._id, payload);
        onNotify(`Mission '${formData.name}' updated successfully.`, 'success');
      } else {
        await api.missions.create(payload);
        onNotify(`Mission '${formData.name}' scheduled successfully.`, 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      if (err.status === 409 || err.data?.conflict) {
        setConflictError(err.message || 'Ground station schedule conflict detected!');
      } else {
        setConflictError(err.message || 'Failed to save mission.');
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete mission '${name}'?`)) return;
    try {
      await api.missions.delete(id);
      onNotify(`Mission '${name}' deleted.`, 'success');
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete mission';
      onNotify(msg, 'error');
    }
  };

  return (
    <div>
      {/* Title & Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Mission Planning & Tracking Schedule</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Flight profiles, orbital passes, and conflict-checked ground station assignments
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Schedule Mission
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="Search missions by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="select-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Mission Statuses</option>
          <option value="Planned">Planned</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="On Hold">On Hold</option>
          <option value="Aborted">Aborted</option>
        </select>

        <select
          className="select-filter"
          value={satelliteFilter}
          onChange={(e) => setSatelliteFilter(e.target.value)}
        >
          <option value="">All Satellites</option>
          {satellites.map((s) => (
            <option key={s._id} value={s._id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Mission Cards Grid */}
      {loading ? (
        <div className="state-box">
          <div className="spinner" />
          <p>Syncing mission flight manifest...</p>
        </div>
      ) : missions.length === 0 ? (
        <div className="state-box">
          <Compass size={48} />
          <h4>No missions found</h4>
          <p style={{ fontSize: '0.82rem' }}>Adjust search filter or schedule a new flight pass.</p>
        </div>
      ) : (
        <div className="data-grid">
          {missions.map((m) => (
            <div key={m._id} className="item-card">
              <div>
                <div className="item-card-header">
                  <div>
                    <div className="item-title">{m.name}</div>
                    <div className="item-meta" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <SatelliteIcon size={12} color="var(--cyan-neon)" />
                      {typeof m.satellite === 'object' && m.satellite ? m.satellite.name : 'Unassigned Satellite'}
                    </div>
                  </div>
                  <span className={`badge ${m.status === 'In Progress' ? 'badge-in-progress' : m.status === 'Completed' ? 'badge-completed' : m.status === 'Planned' ? 'badge-planned' : 'badge-offline'}`}>
                    {m.status}
                  </span>
                </div>

                <div className="item-body">
                  {m.description || 'Routine flight pass and telemetry downlinking trajectory.'}
                </div>

                <div className="item-specs">
                  <div><span className="spec-key">Station:</span> <span className="spec-val" style={{ color: m.assignedStation ? 'var(--cyan-neon)' : 'var(--text-muted)' }}>{typeof m.assignedStation === 'object' && m.assignedStation ? m.assignedStation.name : 'Autonomous'}</span></div>
                  <div><span className="spec-key">Priority:</span> <span className="spec-val">{m.priority || 'Routine'}</span></div>
                  <div><span className="spec-key">Start:</span> <span className="spec-val">{new Date(m.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                  <div><span className="spec-key">End:</span> <span className="spec-val">{new Date(m.endTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                </div>
              </div>

              <div className="item-actions">
                {canManage && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(m)}>
                    <Edit3 size={14} /> Edit / Reassign
                  </button>
                )}
                {canDelete && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(m._id, m.name)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal with Conflict Error Handling */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmitForm}>
              <div className="modal-header">
                <h3>{editingMission ? `Edit Mission: ${editingMission.name}` : 'Schedule New Mission'}</h3>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}><X size={14} /></button>
              </div>

              <div className="modal-body">
                {/* Real-time Schedule Conflict Warning Banner */}
                {conflictError && (
                  <div className="conflict-alert">
                    <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff' }}>Ground Station Schedule Conflict</div>
                      <div>{conflictError}</div>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Mission Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Operation Polar Radar Pass 08"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Target Satellite</label>
                    <select
                      className="form-control"
                      value={formData.satellite}
                      onChange={(e) => setFormData({ ...formData, satellite: e.target.value })}
                      required
                    >
                      <option value="">Select Satellite</option>
                      {satellites.map((s) => (
                        <option key={s._id} value={s._id}>{s.name} ({s.orbitType})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Assigned Ground Station</label>
                    <select
                      className="form-control"
                      value={formData.assignedStation}
                      onChange={(e) => setFormData({ ...formData, assignedStation: e.target.value })}
                    >
                      <option value="">None (Autonomous Flight)</option>
                      {stations.map((st) => (
                        <option key={st._id} value={st._id}>
                          {st.name} ({st.city}, {st.status})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Start Time (UTC / Local)</label>
                    <input
                      type="datetime-local"
                      className="form-control mono"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>End Time (UTC / Local)</label>
                    <input
                      type="datetime-local"
                      className="form-control mono"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Mission Status</label>
                    <select
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    >
                      <option value="Planned">Planned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="On Hold">On Hold</option>
                      <option value="Aborted">Aborted</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Mission Priority</label>
                    <select
                      className="form-control"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    >
                      <option value="Routine">Routine</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Flight Objectives & Pass Notes</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Scientific goals or commanding instructions..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingMission ? 'Update Mission' : 'Confirm Schedule'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
