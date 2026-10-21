import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth, ROLES } from '../context/AuthContext';
import { GroundStation, Mission } from '../types';
import {
  Radio,
  Search,
  Plus,
  Trash2,
  Edit3,
  MapPin,
  Calendar,
  X,
} from 'lucide-react';

interface GroundStationsViewProps {
  onNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

interface StationScheduleState {
  station: GroundStation;
  missions: Mission[];
}

export const GroundStationsView: React.FC<GroundStationsViewProps> = ({ onNotify }) => {
  const { hasRole } = useAuth();
  const [stations, setStations] = useState<GroundStation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals & form
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingStation, setEditingStation] = useState<GroundStation | null>(null);
  const [selectedStationMissions, setSelectedStationMissions] = useState<StationScheduleState | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    city: '',
    country: '',
    latitude: 0,
    longitude: 0,
    status: 'Available' as 'Available' | 'Busy' | 'Maintenance' | 'Offline',
    dishDiameterMeters: 12,
    frequencyBand: 'X-Band' as 'S-Band' | 'X-Band' | 'Ka-Band' | 'UHF/VHF' | 'Optical/Laser',
    contactEmail: '',
    notes: '',
  });

  const canManage = hasRole(ROLES.ADMIN, ROLES.COORDINATOR);
  const canDelete = hasRole(ROLES.ADMIN);

  const fetchStations = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (statusFilter) params.status = statusFilter;

      const res = await api.stations.getAll(params);
      if (res.success && res.data) {
        setStations(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch ground stations';
      onNotify(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, [search, statusFilter]);

  const handleOpenCreate = () => {
    setEditingStation(null);
    setFormData({
      name: '',
      city: '',
      country: '',
      latitude: 0,
      longitude: 0,
      status: 'Available',
      dishDiameterMeters: 12,
      frequencyBand: 'X-Band',
      contactEmail: '',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (st: GroundStation) => {
    setEditingStation(st);
    setFormData({
      name: st.name,
      city: st.city,
      country: st.country,
      latitude: st.latitude,
      longitude: st.longitude,
      status: st.status,
      dishDiameterMeters: st.dishDiameterMeters,
      frequencyBand: st.frequencyBand,
      contactEmail: st.contactEmail || '',
      notes: st.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStation) {
        await api.stations.update(editingStation._id, formData);
        onNotify(`Ground station '${formData.name}' updated.`, 'success');
      } else {
        await api.stations.create(formData);
        onNotify(`Ground station '${formData.name}' added to tracking network.`, 'success');
      }
      setIsModalOpen(false);
      fetchStations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      onNotify(msg, 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to decommission station '${name}'?`)) return;
    try {
      await api.stations.delete(id);
      onNotify(`Station '${name}' decommissioned and removed.`, 'success');
      fetchStations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete ground station';
      onNotify(msg, 'error');
    }
  };

  const handleViewSchedule = async (st: GroundStation) => {
    try {
      const res = await api.stations.getById(st._id);
      if (res.success) {
        setSelectedStationMissions({ station: st, missions: (res as any).assignedMissions || [] });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to view schedule';
      onNotify(msg, 'error');
    }
  };

  return (
    <div>
      {/* Title & Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Ground Station Tracking Network</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Deep space antennas, high-gain parabolic dishes, and RF pass scheduling
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Add Ground Station
          </button>
        )}
      </div>

      {/* Demo Conflict Rejection Callout */}
      <div
        style={{
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '0.85rem 1.1rem',
          marginBottom: '1.5rem',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <Radio size={20} color="var(--cyan-neon)" style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--cyan-neon)' }}>Mission Control Safeguard: Schedule Conflict Detection</strong>
          <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
            When scheduling a pass in the <strong>Missions</strong> tab, assigning a ground station that is already occupied during an overlapping time window is automatically rejected with HTTP 409 Conflict.
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="Search ground stations by name, city, or country..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="select-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Terminal Statuses</option>
          <option value="Available">Available</option>
          <option value="Busy">Busy (In Pass)</option>
          <option value="Maintenance">Maintenance</option>
          <option value="Offline">Offline</option>
        </select>
      </div>

      {/* Stations Grid */}
      {loading ? (
        <div className="state-box">
          <div className="spinner" />
          <p>Connecting to global tracking terminals...</p>
        </div>
      ) : stations.length === 0 ? (
        <div className="state-box">
          <Radio size={48} />
          <h4>No ground stations registered</h4>
          <p style={{ fontSize: '0.82rem' }}>Add a new tracking dish or clear filters.</p>
        </div>
      ) : (
        <div className="data-grid">
          {stations.map((st) => (
            <div key={st._id} className="item-card">
              <div>
                <div className="item-card-header">
                  <div>
                    <div className="item-title">{st.name}</div>
                    <div className="item-meta" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} color="var(--blue-accent)" />
                      {st.city}, {st.country}
                    </div>
                  </div>
                  <span className={`badge ${st.status === 'Available' ? 'badge-available' : st.status === 'Busy' ? 'badge-busy' : st.status === 'Maintenance' ? 'badge-maintenance' : 'badge-offline'}`}>
                    {st.status}
                  </span>
                </div>

                <div className="item-body">
                  {st.notes || 'Equipped with parabolic reflector and multi-frequency downlinks.'}
                </div>

                <div className="item-specs">
                  <div><span className="spec-key">Dish Diameter:</span> <span className="spec-val">{st.dishDiameterMeters} meters</span></div>
                  <div><span className="spec-key">RF Band:</span> <span className="spec-val">{st.frequencyBand}</span></div>
                  <div><span className="spec-key">Latitude:</span> <span className="spec-val">{st.latitude}°</span></div>
                  <div><span className="spec-key">Longitude:</span> <span className="spec-val">{st.longitude}°</span></div>
                </div>
              </div>

              <div className="item-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => handleViewSchedule(st)}>
                  <Calendar size={14} /> Schedule View
                </button>
                {canManage && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(st)}>
                    <Edit3 size={14} />
                  </button>
                )}
                {canDelete && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(st._id, st.name)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Station Schedule Drawer Modal */}
      {selectedStationMissions && (
        <div className="modal-overlay" onClick={() => setSelectedStationMissions(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <div>
                <h3>{selectedStationMissions.station.name}</h3>
                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--cyan-neon)' }}>
                  Assigned Passes • {selectedStationMissions.station.city}, {selectedStationMissions.station.country}
                </span>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => setSelectedStationMissions(null)}><X size={14} /></button>
            </div>

            <div className="modal-body">
              {selectedStationMissions.missions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No active or planned missions currently booked for this station.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedStationMissions.missions.map((m) => (
                    <div
                      key={m._id}
                      style={{
                        background: 'rgba(11, 18, 33, 0.7)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '0.75rem 1rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600 }}>{m.name}</span>
                        <span className={`badge ${m.status === 'In Progress' ? 'badge-in-progress' : 'badge-planned'}`}>{m.status}</span>
                      </div>
                      <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Spacecraft: <strong style={{ color: 'var(--cyan-neon)' }}>{typeof m.satellite === 'object' && m.satellite ? m.satellite.name : 'Orbiter'}</strong>
                      </div>
                      <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Time: {new Date(m.startTime).toLocaleString()} → {new Date(m.endTime).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedStationMissions(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmitForm}>
              <div className="modal-header">
                <h3>{editingStation ? `Edit Ground Station: ${editingStation.name}` : 'Register Ground Station'}</h3>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}><X size={14} /></button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>Station Name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Svalbard Arctic Tracking Station"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>City / Region</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Longyearbyen"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Country</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Norway"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Latitude (-90 to +90)</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="form-control mono"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: Number(e.target.value) })}
                      min={-90}
                      max={90}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Longitude (-180 to +180)</label>
                    <input
                      type="number"
                      step="0.0001"
                      className="form-control mono"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: Number(e.target.value) })}
                      min={-180}
                      max={180}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Antenna Dish Diameter (meters)</label>
                    <input
                      type="number"
                      className="form-control mono"
                      value={formData.dishDiameterMeters}
                      onChange={(e) => setFormData({ ...formData, dishDiameterMeters: Number(e.target.value) })}
                      min={1}
                      max={100}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>RF Band Architecture</label>
                    <select
                      className="form-control"
                      value={formData.frequencyBand}
                      onChange={(e) => setFormData({ ...formData, frequencyBand: e.target.value as any })}
                    >
                      <option value="S-Band">S-Band (2-4 GHz)</option>
                      <option value="X-Band">X-Band (8-12 GHz)</option>
                      <option value="Ka-Band">Ka-Band (26-40 GHz)</option>
                      <option value="UHF/VHF">UHF/VHF (300 MHz - 3 GHz)</option>
                      <option value="Optical/Laser">Optical / Laser Comms</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Operational Status</label>
                    <select
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    >
                      <option value="Available">Available</option>
                      <option value="Busy">Busy (In Tracking Pass)</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Offline">Offline</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Contact Email</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="ops@groundnet.org"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Terminal Notes & Specifications</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingStation ? 'Save Terminal Specs' : 'Register Terminal'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
