import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth, ROLES } from '../context/AuthContext';
import { Satellite as SatelliteType, Mission, TelemetryPoint } from '../types';
import {
  Satellite,
  Search,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  X,
  Activity,
  Calendar,
} from 'lucide-react';

interface SatellitesViewProps {
  onNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

interface SatelliteDetailResponse {
  success: boolean;
  data: SatelliteType;
  activeMissions?: Mission[];
  recentTelemetry?: TelemetryPoint[];
}

export const SatellitesView: React.FC<SatellitesViewProps> = ({ onNotify }) => {
  const { hasRole } = useAuth();
  const [satellites, setSatellites] = useState<SatelliteType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [orbitFilter, setOrbitFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSat, setEditingSat] = useState<SatelliteType | null>(null);
  const [viewingSat, setViewingSat] = useState<SatelliteDetailResponse | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    noradId: '',
    orbitType: 'LEO' as 'LEO' | 'MEO' | 'GEO' | 'SSO' | 'Polar' | 'Deep Space',
    launchDate: new Date().toISOString().split('T')[0],
    status: 'Active' as 'Active' | 'Inactive' | 'Maintenance' | 'Decommissioned',
    altitudeKm: 550,
    inclinationDeg: 97.5,
    massKg: 800,
    operator: 'Space Operations Fleet',
    description: '',
  });

  const canManage = hasRole(ROLES.ADMIN, ROLES.OPERATOR);
  const canDelete = hasRole(ROLES.ADMIN);

  const fetchSatellites = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (orbitFilter) params.orbitType = orbitFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.satellites.getAll(params);
      if (res.success && res.data) {
        setSatellites(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch satellites';
      onNotify(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSatellites();
  }, [search, orbitFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingSat(null);
    setFormData({
      name: '',
      noradId: '',
      orbitType: 'LEO',
      launchDate: new Date().toISOString().split('T')[0],
      status: 'Active',
      altitudeKm: 550,
      inclinationDeg: 97.5,
      massKg: 800,
      operator: 'Space Operations Fleet',
      description: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sat: SatelliteType) => {
    setEditingSat(sat);
    setFormData({
      name: sat.name,
      noradId: sat.noradId,
      orbitType: sat.orbitType,
      launchDate: new Date(sat.launchDate).toISOString().split('T')[0],
      status: sat.status,
      altitudeKm: sat.altitudeKm,
      inclinationDeg: sat.inclinationDeg,
      massKg: sat.massKg || 800,
      operator: sat.operator || '',
      description: sat.description || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSat) {
        await api.satellites.update(editingSat._id, formData);
        onNotify(`Satellite '${formData.name}' parameters updated.`, 'success');
      } else {
        await api.satellites.create(formData);
        onNotify(`Satellite '${formData.name}' registered to fleet.`, 'success');
      }
      setIsModalOpen(false);
      fetchSatellites();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      onNotify(msg, 'error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await api.satellites.delete(id);
      onNotify(`Satellite '${name}' decommissioned and deleted.`, 'success');
      setDeleteConfirmId(null);
      fetchSatellites();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete satellite';
      onNotify(msg, 'error');
    }
  };

  const handleViewDetails = async (id: string) => {
    try {
      const res = (await api.satellites.getById(id)) as unknown as SatelliteDetailResponse;
      if (res.success) {
        setViewingSat(res);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to view satellite details';
      onNotify(msg, 'error');
    }
  };

  return (
    <div>
      {/* Title & Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Spacecraft & Satellite Fleet</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Orbital catalog, ephemeris parameters, and telemetry tracking profiles
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Register Satellite
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} />
          <input
            type="text"
            className="search-input"
            placeholder="Search by satellite name, NORAD ID, or operator..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="select-filter"
          value={orbitFilter}
          onChange={(e) => setOrbitFilter(e.target.value)}
        >
          <option value="">All Orbit Regimes</option>
          <option value="LEO">LEO (Low Earth Orbit)</option>
          <option value="MEO">MEO (Medium Earth Orbit)</option>
          <option value="GEO">GEO (Geostationary)</option>
          <option value="SSO">SSO (Sun-Synchronous)</option>
          <option value="Polar">Polar Orbit</option>
          <option value="Deep Space">Deep Space</option>
        </select>

        <select
          className="select-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Operational Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Maintenance">Under Maintenance</option>
          <option value="Decommissioned">Decommissioned</option>
        </select>
      </div>

      {/* Grid of Satellites */}
      {loading ? (
        <div className="state-box">
          <div className="spinner" />
          <p>Querying satellite orbital catalog and ephemeris records...</p>
        </div>
      ) : satellites.length === 0 ? (
        <div className="state-box">
          <Satellite size={48} />
          <h4>No satellites matching criteria</h4>
          <p style={{ fontSize: '0.82rem' }}>Adjust search terms or register a new satellite.</p>
        </div>
      ) : (
        <div className="data-grid">
          {satellites.map((sat) => (
            <div key={sat._id} className="item-card">
              <div>
                <div className="item-card-header">
                  <div>
                    <div className="item-title">{sat.name}</div>
                    <div className="item-meta">{sat.noradId} • {sat.operator}</div>
                  </div>
                  <span className={`badge ${sat.status === 'Active' ? 'badge-active' : sat.status === 'Maintenance' ? 'badge-maintenance' : 'badge-decommissioned'}`}>
                    {sat.status}
                  </span>
                </div>

                <div className="item-body">
                  {sat.description || 'Orbital mission platform deployed for aerospace observations.'}
                </div>

                <div className="item-specs">
                  <div><span className="spec-key">Orbit:</span> <span className="spec-val">{sat.orbitType}</span></div>
                  <div><span className="spec-key">Altitude:</span> <span className="spec-val">{sat.altitudeKm} km</span></div>
                  <div><span className="spec-key">Inclination:</span> <span className="spec-val">{sat.inclinationDeg}°</span></div>
                  <div><span className="spec-key">Mass:</span> <span className="spec-val">{sat.massKg} kg</span></div>
                </div>
              </div>

              <div className="item-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleViewDetails(sat._id)}
                  title="View detailed flight diagnostics"
                >
                  <ExternalLink size={14} /> Telemetry & Details
                </button>

                {canManage && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenEdit(sat)}
                    title="Edit satellite parameters"
                  >
                    <Edit3 size={14} />
                  </button>
                )}

                {canDelete ? (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setDeleteConfirmId(sat._id)}
                    title="Delete satellite (Admin role required)"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled
                    title="Deleting satellites requires Flight Director (Admin) privileges"
                  >
                    <Trash2 size={14} style={{ opacity: 0.4 }} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--rose-alert)' }}>Confirm Spacecraft Removal</h3>
              <button className="btn-secondary btn-sm" onClick={() => setDeleteConfirmId(null)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.88rem' }}>
                Are you sure you want to permanently delete this satellite record? Associated simulated telemetry and maintenance items will also be removed.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  const sat = satellites.find((s) => s._id === deleteConfirmId);
                  handleDelete(deleteConfirmId, sat?.name || 'satellite');
                }}
              >
                Delete Satellite
              </button>
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
                <h3>{editingSat ? `Edit Satellite: ${editingSat.name}` : 'Register New Satellite'}</h3>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}><X size={14} /></button>
              </div>

              <div className="modal-body">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Satellite Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. AURA-8 Sentinel"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>NORAD / Catalog ID</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="e.g. NORAD-60882"
                      value={formData.noradId}
                      onChange={(e) => setFormData({ ...formData, noradId: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Orbit Regime</label>
                    <select
                      className="form-control"
                      value={formData.orbitType}
                      onChange={(e) => setFormData({ ...formData, orbitType: e.target.value as any })}
                    >
                      <option value="LEO">LEO (Low Earth Orbit)</option>
                      <option value="MEO">MEO (Medium Earth Orbit)</option>
                      <option value="GEO">GEO (Geostationary)</option>
                      <option value="SSO">SSO (Sun-Synchronous)</option>
                      <option value="Polar">Polar</option>
                      <option value="Deep Space">Deep Space</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Operational Status</label>
                    <select
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Decommissioned">Decommissioned</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Altitude (km)</label>
                    <input
                      type="number"
                      className="form-control mono"
                      value={formData.altitudeKm}
                      onChange={(e) => setFormData({ ...formData, altitudeKm: Number(e.target.value) })}
                      min={100}
                      max={50000}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Inclination (deg)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control mono"
                      value={formData.inclinationDeg}
                      onChange={(e) => setFormData({ ...formData, inclinationDeg: Number(e.target.value) })}
                      min={0}
                      max={180}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Launch Date</label>
                    <input
                      type="date"
                      className="form-control mono"
                      value={formData.launchDate}
                      onChange={(e) => setFormData({ ...formData, launchDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Spacecraft Mass (kg)</label>
                    <input
                      type="number"
                      className="form-control mono"
                      value={formData.massKg}
                      onChange={(e) => setFormData({ ...formData, massKg: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Operator / Agency</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Earth Observation Consortium"
                    value={formData.operator}
                    onChange={(e) => setFormData({ ...formData, operator: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Mission Description & Payload Objectives</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Details about mission scientific payload..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingSat ? 'Save Parameters' : 'Register Spacecraft'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Satellite Detailed Drawer */}
      {viewingSat && (
        <div className="modal-overlay" onClick={() => setViewingSat(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <div>
                <h3>{viewingSat.data.name}</h3>
                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--cyan-neon)' }}>
                  {viewingSat.data.noradId} • {viewingSat.data.orbitType} • {viewingSat.data.status}
                </span>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => setViewingSat(null)}><X size={14} /></button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.4rem' }}>Mission Specification</h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {viewingSat.data.description || 'No additional mission description entered.'}
                </p>
              </div>

              <div className="item-specs" style={{ marginBottom: '1.25rem' }}>
                <div><span className="spec-key">Altitude:</span> <span className="spec-val">{viewingSat.data.altitudeKm} km</span></div>
                <div><span className="spec-key">Inclination:</span> <span className="spec-val">{viewingSat.data.inclinationDeg}°</span></div>
                <div><span className="spec-key">Launch Date:</span> <span className="spec-val">{new Date(viewingSat.data.launchDate).toLocaleDateString()}</span></div>
                <div><span className="spec-key">Operator:</span> <span className="spec-val">{viewingSat.data.operator}</span></div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ fontSize: '0.88rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={15} color="var(--blue-accent)" /> Active / Scheduled Flight Passes
                </h4>
                {!viewingSat.activeMissions || viewingSat.activeMissions.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No currently active missions.</div>
                ) : (
                  viewingSat.activeMissions.map((m) => (
                    <div key={m._id} style={{ background: 'rgba(11,18,33,0.6)', padding: '0.5rem 0.75rem', borderRadius: '4px', marginBottom: '4px', fontSize: '0.78rem' }}>
                      <strong>{m.name}</strong> • Status: {m.status} • Station: {typeof m.assignedStation === 'object' && m.assignedStation ? m.assignedStation.name : 'None'}
                    </div>
                  ))
                )}
              </div>

              <div>
                <h4 style={{ fontSize: '0.88rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={15} color="var(--emerald-success)" /> Latest Simulated Telemetry Frame
                </h4>
                {!viewingSat.recentTelemetry || viewingSat.recentTelemetry.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No telemetry frames recorded yet.</div>
                ) : (
                  <div style={{ background: 'rgba(11,18,33,0.6)', padding: '0.75rem', borderRadius: '4px', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                    <div>Timestamp: {new Date(viewingSat.recentTelemetry[0].timestamp).toISOString()}</div>
                    <div>Battery: {viewingSat.recentTelemetry[0].batteryVoltage}V | Temp: {viewingSat.recentTelemetry[0].batteryTemperature}°C | Solar: {viewingSat.recentTelemetry[0].solarPanelCurrent}A</div>
                    <div>SNR: {viewingSat.recentTelemetry[0].signalStrengthDbm} dBm | Payload: {viewingSat.recentTelemetry[0].payloadStatus}</div>
                    <div style={{ color: '#fde047', fontSize: '0.7rem', marginTop: '4px' }}>* SIMULATED DEMO DATA ONLY</div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewingSat(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
