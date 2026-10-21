import { Satellite } from '../models/Satellite.js';
import { Mission } from '../models/Mission.js';
import { GroundStation } from '../models/GroundStation.js';
import { Telemetry } from '../models/Telemetry.js';
import { Maintenance } from '../models/Maintenance.js';
import { CommLog } from '../models/CommLog.js';
import { getCache, setCache } from '../config/redis.js';

export const getDashboardSummary = async (req, res, next) => {
  try {
    const cacheKey = 'cache:dashboard:summary';
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        cached: true,
        data: cached,
      });
    }

    const [
      totalSatellites,
      activeSatellites,
      totalMissions,
      inProgressMissions,
      plannedMissions,
      totalStations,
      availableStations,
      openMaintenanceCount,
      criticalMaintenanceCount,
      recentTelemetry,
      recentCommLogs,
      activeMissionsList,
      stationList,
    ] = await Promise.all([
      Satellite.countDocuments(),
      Satellite.countDocuments({ status: 'Active' }),
      Mission.countDocuments(),
      Mission.countDocuments({ status: 'In Progress' }),
      Mission.countDocuments({ status: 'Planned' }),
      GroundStation.countDocuments(),
      GroundStation.countDocuments({ status: 'Available' }),
      Maintenance.countDocuments({ status: { $ne: 'Completed' } }),
      Maintenance.countDocuments({ status: { $ne: 'Completed' }, severity: 'Critical' }),
      Telemetry.find().populate('satellite', 'name noradId orbitType').sort({ timestamp: -1 }).limit(10),
      CommLog.find()
        .populate({
          path: 'mission',
          select: 'name status satellite',
          populate: { path: 'satellite', select: 'name' },
        })
        .populate('groundStation', 'name')
        .sort({ timestamp: -1 })
        .limit(6),
      Mission.find({ status: { $in: ['Planned', 'In Progress'] } })
        .populate('satellite', 'name noradId orbitType status')
        .populate('assignedStation', 'name city country status')
        .sort({ startTime: 1 })
        .limit(6),
      GroundStation.find().sort({ name: 1 }),
    ]);

    const summaryData = {
      metrics: {
        satellites: { total: totalSatellites, active: activeSatellites },
        missions: {
          total: totalMissions,
          inProgress: inProgressMissions,
          planned: plannedMissions,
        },
        groundStations: { total: totalStations, available: availableStations },
        maintenance: { open: openMaintenanceCount, critical: criticalMaintenanceCount },
      },
      recentTelemetry,
      recentCommLogs,
      activeMissions: activeMissionsList,
      stations: stationList,
    };

    // Cache in Redis for 15 seconds
    await setCache(cacheKey, summaryData, 15);

    res.json({
      success: true,
      cached: false,
      data: summaryData,
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardAlerts = async (req, res, next) => {
  try {
    const cacheKey = 'cache:dashboard:alerts';
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        cached: true,
        count: cached.length,
        data: cached,
      });
    }

    // Fetch active critical and high severity maintenance items, plus degraded systems
    const [criticalMaintenance, offlineStations, inactiveSatellites] = await Promise.all([
      Maintenance.find({ status: { $ne: 'Completed' }, severity: 'Critical' })
        .populate('satellite', 'name noradId')
        .sort({ scheduledDate: 1 }),
      GroundStation.find({ status: { $in: ['Offline', 'Maintenance'] } }),
      Satellite.find({ status: { $in: ['Maintenance', 'Inactive'] } }),
    ]);

    const alerts = [
      ...criticalMaintenance.map((m) => ({
        id: `maint-${m._id}`,
        type: 'CRITICAL_MAINTENANCE',
        level: 'critical',
        title: `Critical Maintenance: ${m.title}`,
        detail: `Spacecraft ${m.satellite?.name || 'Unknown'} requires urgent servicing. Technician: ${m.technician}`,
        timestamp: m.scheduledDate,
      })),
      ...offlineStations.map((s) => ({
        id: `station-${s._id}`,
        type: 'STATION_OFFLINE',
        level: 'warning',
        title: `Ground Station Offline: ${s.name}`,
        detail: `${s.city}, ${s.country} terminal is ${s.status.toLowerCase()} and cannot accept tracking passes.`,
        timestamp: s.updatedAt || new Date(),
      })),
      ...inactiveSatellites.map((sat) => ({
        id: `sat-${sat._id}`,
        type: 'SATELLITE_STATUS',
        level: 'info',
        title: `Satellite Non-Operational: ${sat.name}`,
        detail: `Spacecraft is currently marked as ${sat.status}.`,
        timestamp: sat.updatedAt || new Date(),
      })),
    ];

    // Cache alerts in Redis for 20 seconds
    await setCache(cacheKey, alerts, 20);

    res.json({
      success: true,
      cached: false,
      count: alerts.length,
      data: alerts,
    });
  } catch (error) {
    next(error);
  }
};
