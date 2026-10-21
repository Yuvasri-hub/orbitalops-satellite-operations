import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth, ROLES } from '../context/AuthContext';
import { MaintenanceRecord, Satellite } from '../types';
import {
  Wrench,
  Search,
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  X,
  Satellite as SatelliteIcon,
} from 'lucide-react';

interface MaintenanceViewProps {
  onNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const MaintenanceView: React.FC<MaintenanceViewProps> = ({ onNotify }) => {
  const { user, hasRole } = useAuth();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals & form
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    satellite: '',
    description: '',
    severity: 'Medium' as 'Low' | 'Medium' | 'High' | 'Critical',
    status: 'Scheduled' as 'Scheduled' | 'In Progress' | 'Completed' | 'Deferred',
    scheduledDate: new Date().toISOString().split('T')[0],
    technician: '',
    actionTaken: '',
  });

  const canManage = hasRole(ROLES.ADMIN, ROLES.ENGINEER);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (severityFilter) params.severity = severityFilter;
      if (statusFilter) params.status = statusFilter;

      const [maintRes, satRes] = await Promise.all([
        api.maintenance.getAll(params),
        api.satellites.getAll(),
      ]);

      if (maintRes.success && maintRes.data) setRecords(maintRes.data);
      if (satRes.success && satRes.data) setSatellites(satRes.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch maintenance records';
      onNotify(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, severityFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setFormData({
      title: '',
      satellite: satellites[0]?._id || '',
      description: '',
      severity: 'Medium',
      status: 'Scheduled',
      scheduledDate: new Date().toISOString().split('T')[0],
      technician: user?.name ? `${user.name} (${user.callsign})` : 'Avionics Squad',
      actionTaken: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rec: MaintenanceRecord) => {
    setEditingRecord(rec);
    setFormData({
      title: rec.title,
      satellite: typeof rec.satellite === 'object' && rec.satellite ? rec.satellite._id : String(rec.satellite || ''),
      description: rec.description,
      severity: rec.severity,
      status: rec.status,
      scheduledDate: new Date(rec.scheduledDate).toISOString().split('T')[0],
      technician: rec.technician || '',
      actionTaken: rec.actionTaken || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingRecord) {
        await api.maintenance.update(editingRecord._id, formData);
        onNotify(`Maintenance item '${formData.title}' updated.`, 'success');
      } else {
        await api.maintenance.create(formData);
        onNotify(`Maintenance logged for satellite.`, 'success');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      onNotify(msg, 'error');
    }
  };

  const handleQuickResolve = async (rec: MaintenanceRecord) => {
    try {
      await api.maintenance.update(rec._id, {
        status: 'Completed',
        completedDate: new Date().toISOString(),
        actionTaken: rec.actionTaken || 'Service procedure verified nominal by flight engineer.',
      });
      onNotify(`Maintenance '${rec.title}' marked as Completed.`, 'success');
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resolve record';
      onNotify(msg, 'error');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete maintenance record '${title}'?`)) return;
    try {
      await api.maintenance.delete(id);
      onNotify(`Record '${title}' deleted.`, 'success');
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
          <h2>Spacecraft Health & Servicing Records</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Subsystem anomaly tickets, preventative calibration, and hardware service logs
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Log Servicing Record
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
            placeholder="Search maintenance logs by title, description, technician..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="select-filter"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          <option value="">All Severity Levels</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          className="select-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Scheduled">Scheduled</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Deferred">Deferred</option>
        </select>
      </div>

      {/* Cards List */}
      {loading ? (
        <div className="state-box">
          <div className="spinner" />
          <p>Accessing spacecraft maintenance ledger...</p>
        </div>
      ) : records.length === 0 ? (
        <div className="state-box">
          <Wrench size={48} />
          <h4>No maintenance records found</h4>
          <p style={{ fontSize: '0.82rem' }}>All flight subsystems are operating within nominal specifications.</p>
        </div>
      ) : (
        <div className="data-grid">
          {records.map((r) => (
            <div key={r._id} className="item-card">
              <div>
                <div className="item-card-header">
                  <div>
                    <div className="item-title">{r.title}</div>
                    <div className="item-meta" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <SatelliteIcon size={12} color="var(--cyan-neon)" />
                      {typeof r.satellite === 'object' && r.satellite ? r.satellite.name : 'Satellite Ref'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span className={`badge ${r.severity === 'Critical' ? 'badge-critical' : r.severity === 'High' ? 'badge-high' : r.severity === 'Medium' ? 'badge-medium' : 'badge-routine'}`}>
                      {r.severity}
                    </span>
                    <span className={`badge ${r.status === 'Completed' ? 'badge-completed' : r.status === 'In Progress' ? 'badge-in-progress' : 'badge-planned'}`}>
                      {r.status}
                    </span>
                  </div>
                </div>

                <div className="item-body">
                  {r.description}
                  {r.actionTaken && (
                    <div style={{ marginTop: '0.5rem', background: 'rgba(16,185,129,0.08)', borderLeft: '2px solid #10b981', padding: '0.35rem 0.5rem', fontSize: '0.75rem', color: '#6ee7b7' }}>
                      <strong>Resolution:</strong> {r.actionTaken}
                    </div>
                  )}
                </div>

                <div className="item-specs">
                  <div><span className="spec-key">Technician:</span> <span className="spec-val">{r.technician || 'Engineering Squad'}</span></div>
                  <div><span className="spec-key">Scheduled:</span> <span className="spec-val">{new Date(r.scheduledDate).toLocaleDateString()}</span></div>
                  <div><span className="spec-key">Logged By:</span> <span className="spec-val">{typeof r.createdBy === 'object' && r.createdBy ? r.createdBy.name : 'OPS'}</span></div>
                  <div><span className="spec-key">Completed:</span> <span className="spec-val">{r.completedDate ? new Date(r.completedDate).toLocaleDateString() : 'Pending'}</span></div>
                </div>
              </div>

              <div className="item-actions">
                {canManage && r.status !== 'Completed' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleQuickResolve(r)} title="Mark as Completed">
                    <CheckCircle size={14} color="#10b981" /> Resolve
                  </button>
                )}
                {canManage && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(r)}>
                    <Edit3 size={14} />
                  </button>
                )}
                {canManage && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r._id, r.title)}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmitForm}>
              <div className="modal-header">
                <h3>{editingRecord ? `Edit Maintenance: ${editingRecord.title}` : 'Log Servicing Record'}</h3>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}><X size={14} /></button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>Record Title</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Solar Array Drive Motor Stepper Calibration"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Target Spacecraft</label>
                    <select
                      className="form-control"
                      value={formData.satellite}
                      onChange={(e) => setFormData({ ...formData, satellite: e.target.value })}
                      required
                    >
                      <option value="">Select Satellite</option>
                      {satellites.map((s) => (
                        <option key={s._id} value={s._id}>{s.name} ({s.noradId})</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Severity Level</label>
                    <select
                      className="form-control"
                      value={formData.severity}
                      onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                    >
                      <option value="Low">Low (Routine Check)</option>
                      <option value="Medium">Medium (Attention Advised)</option>
                      <option value="High">High (Subsystem Degradation)</option>
                      <option value="Critical">Critical (Mission Threatening)</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Scheduled Service Date</label>
                    <input
                      type="date"
                      className="form-control mono"
                      value={formData.scheduledDate}
                      onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Servicing Status</label>
                    <select
                      className="form-control"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Deferred">Deferred</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Lead Technician / Unit</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.technician}
                    onChange={(e) => setFormData({ ...formData, technician: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Anomaly Description</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Describe observed telemetry anomalies or scheduled inspection checklist..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Corrective Action Taken</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Document software patches, bias changes, or physical commands issued..."
                    value={formData.actionTaken}
                    onChange={(e) => setFormData({ ...formData, actionTaken: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingRecord ? 'Update Record' : 'Save Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
