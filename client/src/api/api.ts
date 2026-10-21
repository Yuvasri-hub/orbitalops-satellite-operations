import {
  User,
  Satellite,
  GroundStation,
  Mission,
  TelemetryPoint,
  MaintenanceRecord,
  CommLog,
  DashboardSummaryData,
  SystemAlert,
  ApiResponse,
} from '../types';

const resolveApiBase = (): string => {
  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!envUrl) return '/api';
  const clean = envUrl.replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
};

const BASE_URL = resolveApiBase();

export const getStoredToken = (): string | null => localStorage.getItem('space_ops_token');
export const setStoredToken = (token: string): void => localStorage.setItem('space_ops_token', token);
export const removeStoredToken = (): void => localStorage.removeItem('space_ops_token');

const request = async <T = any>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error: any = new Error(data.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data as T;
  } catch (err: any) {
    // If unauthorized, clear token if expired
    if (err.status === 401 && !endpoint.includes('/login') && !endpoint.includes('/register')) {
      removeStoredToken();
    }
    throw err;
  }
};

export const api = {
  // Health
  getHealth: () => request<ApiResponse>('/health'),

  // Auth
  auth: {
    login: (credentials: { email: string; password?: string }) =>
      request<ApiResponse<{ token: string; user: User }>>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    register: (userData: any) =>
      request<ApiResponse<{ token: string; user: User }>>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    getMe: () => request<ApiResponse<User>>('/auth/me'),
    getDemoAccounts: () => request<ApiResponse<any>>('/auth/demo-accounts'),
  },

  // Users (Admin only)
  users: {
    getAll: (params: Record<string, any> = {}) => {
      const query = new URLSearchParams(params).toString();
      return request<ApiResponse<User[]>>(`/users${query ? `?${query}` : ''}`);
    },
    updateRole: (id: string, role: string) =>
      request<ApiResponse<User>>(`/users/${id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }),
    toggleStatus: (id: string) =>
      request<ApiResponse<User>>(`/users/${id}/status`, {
        method: 'PUT',
      }),
  },

  // Dashboard & Alerts (Redis Cached)
  dashboard: {
    getSummary: () => request<ApiResponse<DashboardSummaryData>>('/dashboard/summary'),
    getAlerts: () => request<ApiResponse<SystemAlert[]>>('/dashboard/alerts'),
  },

  // Satellites
  satellites: {
    getAll: (params: Record<string, any> = {}) => {
      const query = new URLSearchParams(params).toString();
      return request<ApiResponse<Satellite[]>>(`/satellites${query ? `?${query}` : ''}`);
    },
    getById: (id: string) =>
      request<
        ApiResponse<Satellite> & {
          activeMissions: Mission[];
          recentTelemetry: TelemetryPoint[];
          openMaintenance: MaintenanceRecord[];
        }
      >(`/satellites/${id}`),
    create: (data: Partial<Satellite>) =>
      request<ApiResponse<Satellite>>('/satellites', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Satellite>) =>
      request<ApiResponse<Satellite>>(`/satellites/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<ApiResponse<{ deletedId: string }>>(`/satellites/${id}`, {
        method: 'DELETE',
      }),
  },

  // Ground Stations
  stations: {
    getAll: (params: Record<string, any> = {}) => {
      const query = new URLSearchParams(params).toString();
      return request<ApiResponse<GroundStation[]>>(`/stations${query ? `?${query}` : ''}`);
    },
    getById: (id: string) =>
      request<ApiResponse<GroundStation> & { assignedMissions: Mission[] }>(`/stations/${id}`),
    create: (data: Partial<GroundStation>) =>
      request<ApiResponse<GroundStation>>('/stations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<GroundStation>) =>
      request<ApiResponse<GroundStation>>(`/stations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<ApiResponse<{ deletedId: string }>>(`/stations/${id}`, {
        method: 'DELETE',
      }),
  },

  // Missions
  missions: {
    getAll: (params: Record<string, any> = {}) => {
      const query = new URLSearchParams(params).toString();
      return request<ApiResponse<Mission[]>>(`/missions${query ? `?${query}` : ''}`);
    },
    getById: (id: string) => request<ApiResponse<Mission>>(`/missions/${id}`),
    create: (data: Partial<Mission>) =>
      request<ApiResponse<Mission>>('/missions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Mission>) =>
      request<ApiResponse<Mission>>(`/missions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<ApiResponse<{ deletedId: string }>>(`/missions/${id}`, {
        method: 'DELETE',
      }),
  },

  // Telemetry (Redis Cached)
  telemetry: {
    getAll: (params: Record<string, any> = {}) => {
      const query = new URLSearchParams(params).toString();
      return request<ApiResponse<TelemetryPoint[]>>(`/telemetry${query ? `?${query}` : ''}`);
    },
    getLatestBySatellite: (satelliteId: string) =>
      request<ApiResponse<TelemetryPoint>>(`/telemetry/satellite/${satelliteId}/latest`),
    generateBatch: (satelliteId: string, count: number = 15) =>
      request<ApiResponse<TelemetryPoint[]>>(`/telemetry/satellite/${satelliteId}/generate`, {
        method: 'POST',
        body: JSON.stringify({ count }),
      }),
  },

  // Maintenance
  maintenance: {
    getAll: (params: Record<string, any> = {}) => {
      const query = new URLSearchParams(params).toString();
      return request<ApiResponse<MaintenanceRecord[]>>(`/maintenance${query ? `?${query}` : ''}`);
    },
    getById: (id: string) => request<ApiResponse<MaintenanceRecord>>(`/maintenance/${id}`),
    create: (data: Partial<MaintenanceRecord>) =>
      request<ApiResponse<MaintenanceRecord>>('/maintenance', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<MaintenanceRecord>) =>
      request<ApiResponse<MaintenanceRecord>>(`/maintenance/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<ApiResponse<{ deletedId: string }>>(`/maintenance/${id}`, {
        method: 'DELETE',
      }),
  },

  // Comm Logs
  commLogs: {
    getAll: (params: Record<string, any> = {}) => {
      const query = new URLSearchParams(params).toString();
      return request<ApiResponse<CommLog[]>>(`/comm-logs${query ? `?${query}` : ''}`);
    },
    create: (data: Partial<CommLog>) =>
      request<ApiResponse<CommLog>>('/comm-logs', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<ApiResponse<{ deletedId: string }>>(`/comm-logs/${id}`, {
        method: 'DELETE',
      }),
  },
};
