export type UserRole =
  | 'Admin'
  | 'Mission Operator'
  | 'Ground-Station Coordinator'
  | 'Maintenance Engineer'
  | 'Viewer';

export interface User {
  id: string;
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  callsign: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type OrbitType = 'LEO' | 'MEO' | 'GEO' | 'SSO' | 'Polar' | 'Deep Space';
export type SatelliteStatus = 'Active' | 'Inactive' | 'Maintenance' | 'Decommissioned';

export interface Satellite {
  id: string;
  _id: string;
  name: string;
  noradId: string;
  orbitType: OrbitType;
  launchDate: string;
  status: SatelliteStatus;
  altitudeKm: number;
  inclinationDeg: number;
  massKg: number;
  operator: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export type StationStatus = 'Available' | 'Busy' | 'Maintenance' | 'Offline';
export type FrequencyBand = 'S-Band' | 'X-Band' | 'Ka-Band' | 'UHF/VHF' | 'Optical/Laser';

export interface GroundStation {
  id: string;
  _id: string;
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  status: StationStatus;
  dishDiameterMeters: number;
  frequencyBand: FrequencyBand;
  contactEmail: string;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export type MissionStatus = 'Planned' | 'In Progress' | 'Completed' | 'Aborted' | 'On Hold';
export type MissionPriority = 'Routine' | 'Medium' | 'High' | 'Critical';

export interface Mission {
  id: string;
  _id: string;
  name: string;
  satellite: Satellite | string;
  description: string;
  startTime: string;
  endTime: string;
  status: MissionStatus;
  assignedStation: GroundStation | string | null;
  priority: MissionPriority;
  leadOperator?: User | string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TelemetrySubsystems {
  obc: string;
  aocs: string;
  comm: string;
  eps: string;
}

export interface TelemetryPoint {
  id: string;
  _id: string;
  satellite: Satellite | string;
  timestamp: string;
  batteryVoltage: number;
  batteryTemperature: number;
  solarPanelCurrent: number;
  signalStrengthDbm: number;
  orbitVelocityKmS: number;
  altitudeKm: number;
  payloadStatus: 'Nominal' | 'Standby' | 'Degraded' | 'Telemetry Calibration';
  subsystems: TelemetrySubsystems;
  isSimulated: boolean;
  simulationDisclaimer: string;
  createdAt?: string;
}

export type MaintenanceSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type MaintenanceStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Deferred';

export interface MaintenanceRecord {
  id: string;
  _id: string;
  title: string;
  satellite: Satellite | string;
  description: string;
  severity: MaintenanceSeverity;
  status: MaintenanceStatus;
  scheduledDate: string;
  completedDate: string | null;
  technician: string;
  createdBy?: User | string | null;
  actionTaken: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CommLogType =
  | 'Telemetry Pass'
  | 'Command Uplink'
  | 'Payload Downlink'
  | 'Anomaly Report'
  | 'Handover'
  | 'Voice Check';

export type SignalQuality = 'Nominal' | 'Degraded' | 'Marginal' | 'Loss of Signal';

export interface CommLog {
  id: string;
  _id: string;
  mission: Mission | string;
  groundStation?: GroundStation | string | null;
  timestamp: string;
  logType: CommLogType;
  message: string;
  signalQuality: SignalQuality;
  frequencyMhz: number;
  createdBy?: User | string | null;
  createdAt?: string;
}

export interface DashboardMetrics {
  satellites: { total: number; active: number };
  missions: { total: number; inProgress: number; planned: number };
  groundStations: { total: number; available: number };
  maintenance: { open: number; critical: number };
}

export interface DashboardSummaryData {
  metrics: DashboardMetrics;
  recentTelemetry: TelemetryPoint[];
  recentCommLogs: CommLog[];
  activeMissions: Mission[];
  stations: GroundStation[];
}

export interface SystemAlert {
  id: string;
  type: string;
  level?: 'critical' | 'warning' | 'info';
  severity?: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  title: string;
  message?: string;
  detail?: string;
  source?: string;
  timestamp: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  count?: number;
  cached?: boolean;
  simulationNotice?: string;
  conflict?: boolean;
  conflictingMission?: Mission;
  token?: string;
  user?: User;
}
