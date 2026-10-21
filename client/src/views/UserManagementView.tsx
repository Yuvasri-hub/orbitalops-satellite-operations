import React, { useState, useEffect } from 'react';
import { api } from '../api/api';
import { useAuth, ROLES } from '../context/AuthContext';
import { User } from '../types';
import {
  Users,
  Search,
  Shield,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  RefreshCw,
  Mail,
} from 'lucide-react';

interface UserManagementViewProps {
  onNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ onNotify }) => {
  const { user, hasRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});

  const isAdmin = hasRole(ROLES.ADMIN);

  const fetchUsers = async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (roleFilter) params.role = roleFilter;

      const res = await api.users.getAll(params);
      if (res.success && res.data) {
        setUsers(res.data);
        // Initialize pending roles map
        const initial: Record<string, string> = {};
        res.data.forEach((u) => {
          initial[u._id] = u.role;
        });
        setPendingRoles(initial);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch users';
      if (onNotify) onNotify(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter]);

  const handleRoleSelectChange = (userId: string, newRole: string) => {
    setPendingRoles((prev) => ({
      ...prev,
      [userId]: newRole,
    }));
  };

  const handleSaveRole = async (targetUser: User) => {
    const newRole = pendingRoles[targetUser._id];
    if (!newRole || newRole === targetUser.role) return;

    try {
      setUpdatingId(targetUser._id);
      const res = await api.users.updateRole(targetUser._id, newRole);
      if (res.success) {
        if (onNotify) {
          onNotify(res.message || `Role updated to ${newRole}`, 'success');
        }
        // Update local user list
        setUsers((prev) =>
          prev.map((u) => (u._id === targetUser._id ? { ...u, role: newRole as any } : u))
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update user role';
      if (onNotify) {
        onNotify(msg, 'error');
      }
      // Revert pending role selection
      setPendingRoles((prev) => ({
        ...prev,
        [targetUser._id]: targetUser.role,
      }));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleStatus = async (targetUser: User) => {
    if (targetUser._id === user?._id || targetUser._id === user?.id) {
      if (onNotify) onNotify('Cannot deactivate your own active session.', 'error');
      return;
    }

    try {
      setUpdatingId(targetUser._id);
      const res = await api.users.toggleStatus(targetUser._id);
      if (res.success && res.data) {
        if (onNotify) onNotify(res.message || 'Status updated', 'success');
        setUsers((prev) =>
          prev.map((u) =>
            u._id === targetUser._id ? { ...u, isActive: res.data.isActive } : u
          )
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle status';
      if (onNotify) onNotify(msg, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="state-box">
        <ShieldAlert size={56} color="#fb7185" />
        <h3 style={{ color: '#fecdd3', marginTop: '1rem' }}>Access Restricted: Flight Director Only</h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0.5rem auto' }}>
          Personnel and Role-Based Access Control administration requires authenticated Administrator privileges.
        </p>
      </div>
    );
  }

  // Calculate role metrics
  const adminCount = users.filter((u) => u.role === ROLES.ADMIN).length;
  const operatorCount = users.filter((u) => u.role === ROLES.OPERATOR).length;
  const coordinatorCount = users.filter((u) => u.role === ROLES.COORDINATOR).length;
  const engineerCount = users.filter((u) => u.role === ROLES.ENGINEER).length;
  const viewerCount = users.filter((u) => u.role === ROLES.VIEWER).length;

  const getRoleBadgeClass = (roleName: string) => {
    switch (roleName) {
      case ROLES.ADMIN:
        return 'badge-admin';
      case ROLES.OPERATOR:
        return 'badge-in-progress';
      case ROLES.COORDINATOR:
        return 'badge-busy';
      case ROLES.ENGINEER:
        return 'badge-maintenance';
      case ROLES.VIEWER:
        return 'badge-viewer';
      default:
        return 'badge-nominal';
    }
  };

  return (
    <div>
      {/* Title & Description */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2>Personnel & Access Control</h2>
            <span
              className="badge"
              style={{
                background: 'rgba(244, 63, 94, 0.15)',
                color: '#fb7185',
                border: '1px solid rgba(244, 63, 94, 0.4)',
              }}
            >
              ADMIN CONSOLE
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Inspect all registered personnel, grant elevated flight privileges, and assign operational roles
          </p>
        </div>

        <button className="btn btn-secondary btn-sm" onClick={fetchUsers}>
          <RefreshCw size={14} /> Refresh Personnel Directory
        </button>
      </div>

      {/* Role Counts KPI Grid */}
      <div className="kpi-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="kpi-card">
          <div className="kpi-icon rose">
            <ShieldAlert size={22} />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">Flight Directors (Admin)</div>
            <div className="kpi-value">{adminCount}</div>
            <div className="kpi-subtext">Full system authority</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon blue">
            <ShieldCheck size={22} />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">Mission Operators</div>
            <div className="kpi-value">{operatorCount}</div>
            <div className="kpi-subtext">Flight passes & telemetry</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon amber">
            <Shield size={22} />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">Station Coordinators</div>
            <div className="kpi-value">{coordinatorCount}</div>
            <div className="kpi-subtext">Ground tracking network</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon emerald">
            <UserCheck size={22} />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">Maintenance Engineers</div>
            <div className="kpi-value">{engineerCount}</div>
            <div className="kpi-subtext">Avionics servicing tickets</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">
            <Users size={22} />
          </div>
          <div className="kpi-details">
            <div className="kpi-label">Viewers / Analysts</div>
            <div className="kpi-value">{viewerCount}</div>
            <div className="kpi-subtext">Read-only flight feed</div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="filter-bar" style={{ marginBottom: '1.5rem' }}>
        <div className="search-box" style={{ flex: 1, minWidth: '240px' }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by name, email, or callsign..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="select-filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{ minWidth: '180px' }}
        >
          <option value="">All Account Roles</option>
          <option value={ROLES.ADMIN}>Flight Director (Admin)</option>
          <option value={ROLES.OPERATOR}>Mission Operator</option>
          <option value={ROLES.COORDINATOR}>Ground-Station Coordinator</option>
          <option value={ROLES.ENGINEER}>Maintenance Engineer</option>
          <option value={ROLES.VIEWER}>Viewer</option>
        </select>
      </div>

      {/* Users Directory Table */}
      <div className="glass-panel">
        <div className="panel-header">
          <h3>
            <Users size={18} color="var(--cyan-neon)" />
            Registered Personnel Directory ({users.length} Records)
          </h3>
          <span className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            * Role modifications persist directly in PostgreSQL database
          </span>
        </div>

        {loading ? (
          <div className="state-box">
            <div className="spinner" />
            <p>Accessing personnel registry...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="state-box">
            <Users size={48} />
            <h4>No personnel records found</h4>
            <p style={{ fontSize: '0.82rem' }}>Adjust search terms or clear role filters.</p>
          </div>
        ) : (
          <div className="telemetry-table-wrapper">
            <table className="telemetry-table">
              <thead>
                <tr>
                  <th>Personnel</th>
                  <th>Email Address</th>
                  <th>Current Role</th>
                  <th>Modify Access Role</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isCurrentLoggedUser = u._id === user?._id || u._id === user?.id;
                  const selectedRole = pendingRoles[u._id] || u.role;
                  const hasUnsavedRole = selectedRole !== u.role;
                  const isBusy = updatingId === u._id;

                  return (
                    <tr key={u._id}>
                      {/* Name & Callsign */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div
                            className="user-avatar"
                            style={{
                              width: '32px',
                              height: '32px',
                              fontSize: '0.82rem',
                              background:
                                u.role === ROLES.ADMIN
                                    ? 'rgba(244, 63, 94, 0.2)'
                                    : 'rgba(0, 240, 255, 0.15)',
                              color:
                                u.role === ROLES.ADMIN
                                    ? '#fb7185'
                                    : 'var(--cyan-neon)',
                              border:
                                u.role === ROLES.ADMIN
                                    ? '1px solid rgba(244, 63, 94, 0.5)'
                                    : '1px solid var(--border-subtle)',
                            }}
                          >
                            {u.name?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                              {u.name}
                              {isCurrentLoggedUser && (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    color: 'var(--cyan-neon)',
                                    marginLeft: '6px',
                                    fontFamily: 'var(--font-mono)',
                                  }}
                                >
                                  (YOU)
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              Callsign: {u.callsign || 'OPS-CADET'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}>
                          <Mail size={13} color="var(--text-muted)" />
                          <span className="mono">{u.email}</span>
                        </div>
                      </td>

                      {/* Current Role Badge */}
                      <td>
                        <span className={`badge ${getRoleBadgeClass(u.role)}`}>
                          {u.role}
                        </span>
                      </td>

                      {/* Role Selector */}
                      <td>
                        <select
                          className="select-filter"
                          value={selectedRole}
                          onChange={(e) => handleRoleSelectChange(u._id, e.target.value)}
                          disabled={isBusy}
                          style={{
                            fontSize: '0.8rem',
                            padding: '0.35rem 0.65rem',
                            minWidth: '200px',
                            borderColor: hasUnsavedRole ? 'var(--cyan-neon)' : 'var(--border-subtle)',
                            background: hasUnsavedRole ? 'rgba(0, 240, 255, 0.08)' : 'var(--bg-input)',
                          }}
                        >
                          <option value={ROLES.ADMIN}>Flight Director (Admin)</option>
                          <option value={ROLES.OPERATOR}>Mission Operator</option>
                          <option value={ROLES.COORDINATOR}>Ground-Station Coordinator</option>
                          <option value={ROLES.ENGINEER}>Maintenance Engineer</option>
                          <option value={ROLES.VIEWER}>Viewer</option>
                        </select>
                      </td>

                      {/* Account Status */}
                      <td>
                        <span
                          className={`badge ${u.isActive ? 'badge-nominal' : 'badge-offline'}`}
                          style={{ fontSize: '0.72rem' }}
                        >
                          {u.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>

                      {/* Registration Date */}
                      <td>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {new Date(u.createdAt).toLocaleDateString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                          {hasUnsavedRole && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleSaveRole(u)}
                              disabled={isBusy}
                              style={{ padding: '0.3rem 0.65rem' }}
                              title="Commit role change to PostgreSQL"
                            >
                              {isBusy ? 'Saving...' : 'Apply Role'}
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleToggleStatus(u)}
                            disabled={isBusy || isCurrentLoggedUser}
                            title={u.isActive ? 'Deactivate account' : 'Reactivate account'}
                            style={{ padding: '0.3rem 0.5rem' }}
                          >
                            {u.isActive ? (
                              <UserX size={14} color="#fb7185" />
                            ) : (
                              <UserCheck size={14} color="#34d399" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
