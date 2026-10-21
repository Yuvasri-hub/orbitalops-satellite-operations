import { Telemetry } from '../models/Telemetry.js';
import { Satellite } from '../models/Satellite.js';
import {
  generateSimulatedTelemetryPoint,
  generateBatchSimulatedTelemetry,
} from '../utils/telemetrySimulator.js';
import { getCache, setCache, delCache, delCacheByPattern } from '../config/redis.js';

export const getTelemetry = async (req, res, next) => {
  try {
    const { satellite, startDate, endDate, limit = 50, sort = '-timestamp' } = req.query;
    const query = {};

    if (satellite) {
      query.satellite = satellite;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    const maxLimit = Math.min(parseInt(limit, 10) || 50, 200);

    // If fetching the default un-filtered recent feed, check Redis cache
    const isDefaultFeed = !satellite && !startDate && !endDate && maxLimit <= 20;
    const cacheKey = 'cache:telemetry:recent_feed';

    if (isDefaultFeed) {
      const cached = await getCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          cached: true,
          simulationNotice: 'SIMULATED DEMO DATA ONLY - Not connected to real flight hardware',
          count: cached.length,
          data: cached,
        });
      }
    }

    const telemetry = await Telemetry.find(query)
      .populate('satellite', 'name noradId orbitType altitudeKm status')
      .sort(sort)
      .limit(maxLimit);

    if (isDefaultFeed && telemetry.length > 0) {
      await setCache(cacheKey, telemetry, 20); // 20s TTL
    }

    res.json({
      success: true,
      simulationNotice: 'SIMULATED DEMO DATA ONLY - Not connected to real flight hardware',
      count: telemetry.length,
      data: telemetry,
    });
  } catch (error) {
    next(error);
  }
};

export const getLatestSatelliteTelemetry = async (req, res, next) => {
  try {
    const { satelliteId } = req.params;
    const cacheKey = `cache:telemetry:latest:${satelliteId}`;

    // Redis Cache check
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        cached: true,
        simulationNotice: 'SIMULATED DEMO DATA ONLY - Not connected to real flight hardware',
        data: cached,
      });
    }

    const latest = await Telemetry.findOne({ satellite: satelliteId })
      .populate('satellite', 'name noradId orbitType')
      .sort({ timestamp: -1 });

    if (!latest) {
      return res.status(404).json({
        success: false,
        message: 'No simulated telemetry points logged for this satellite yet',
      });
    }

    // Populate Redis cache with 60s TTL
    await setCache(cacheKey, latest, 60);

    res.json({
      success: true,
      cached: false,
      simulationNotice: 'SIMULATED DEMO DATA ONLY - Not connected to real flight hardware',
      data: latest,
    });
  } catch (error) {
    next(error);
  }
};

export const generateTelemetryBatch = async (req, res, next) => {
  try {
    const { satelliteId } = req.params;
    const count = Math.min(parseInt(req.body.count, 10) || 15, 50);

    const satellite = await Satellite.findById(satelliteId);
    if (!satellite) {
      return res.status(404).json({
        success: false,
        message: 'Target satellite not found',
      });
    }

    const generated = generateBatchSimulatedTelemetry(satellite._id, count, 10);
    const saved = await Telemetry.insertMany(generated);

    // Invalidate Redis caches for telemetry and dashboard alerts
    await delCache(`cache:telemetry:latest:${satelliteId}`);
    await delCache('cache:telemetry:recent_feed');
    await delCache('cache:dashboard:summary');
    await delCache('cache:dashboard:alerts');

    // Pre-warm latest satellite cache with the most recent generated point
    if (saved.length > 0) {
      const latestPoint = { ...saved[saved.length - 1], satellite };
      await setCache(`cache:telemetry:latest:${satelliteId}`, latestPoint, 60);
    }

    res.status(201).json({
      success: true,
      simulationNotice: 'SIMULATED DEMO DATA ONLY - Generated synthetic sensor readings for demo purposes',
      message: `Generated ${saved.length} synthetic telemetry frames for ${satellite.name}`,
      count: saved.length,
      data: saved,
    });
  } catch (error) {
    next(error);
  }
};
