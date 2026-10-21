import { Satellite } from '../models/Satellite.js';
import { Mission } from '../models/Mission.js';
import { Telemetry } from '../models/Telemetry.js';
import { Maintenance } from '../models/Maintenance.js';

export const getSatellites = async (req, res, next) => {
  try {
    const { q, orbitType, status, sort = 'name' } = req.query;
    const query = {};

    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { noradId: { $regex: q, $options: 'i' } },
        { operator: { $regex: q, $options: 'i' } },
      ];
    }

    if (orbitType) {
      query.orbitType = orbitType;
    }

    if (status) {
      query.status = status;
    }

    const satellites = await Satellite.find(query).sort(sort);

    res.json({
      success: true,
      count: satellites.length,
      data: satellites,
    });
  } catch (error) {
    next(error);
  }
};

export const getSatelliteById = async (req, res, next) => {
  try {
    const satellite = await Satellite.findById(req.params.id);

    if (!satellite) {
      return res.status(404).json({
        success: false,
        message: 'Satellite not found with specified ID',
      });
    }

    // Include recent simulated telemetry and active missions
    const activeMissions = await Mission.find({
      satellite: satellite._id,
      status: { $in: ['Planned', 'In Progress'] },
    }).populate('assignedStation', 'name city country');

    const recentTelemetry = await Telemetry.find({ satellite: satellite._id })
      .sort({ timestamp: -1 })
      .limit(5);

    const openMaintenance = await Maintenance.find({
      satellite: satellite._id,
      status: { $ne: 'Completed' },
    });

    res.json({
      success: true,
      data: satellite,
      activeMissions,
      recentTelemetry,
      openMaintenance,
    });
  } catch (error) {
    next(error);
  }
};

export const createSatellite = async (req, res, next) => {
  try {
    const {
      name,
      noradId,
      orbitType,
      launchDate,
      status,
      altitudeKm,
      inclinationDeg,
      massKg,
      operator,
      description,
    } = req.body;

    const satellite = await Satellite.create({
      name,
      noradId,
      orbitType,
      launchDate,
      status,
      altitudeKm,
      inclinationDeg,
      massKg,
      operator,
      description,
    });

    res.status(201).json({
      success: true,
      message: 'Satellite successfully registered into mission database',
      data: satellite,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSatellite = async (req, res, next) => {
  try {
    const satellite = await Satellite.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!satellite) {
      return res.status(404).json({
        success: false,
        message: 'Satellite not found',
      });
    }

    res.json({
      success: true,
      message: 'Satellite parameters updated successfully',
      data: satellite,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSatellite = async (req, res, next) => {
  try {
    const satellite = await Satellite.findById(req.params.id);

    if (!satellite) {
      return res.status(404).json({
        success: false,
        message: 'Satellite not found',
      });
    }

    // Check if satellite has active missions
    const activeMissions = await Mission.countDocuments({
      satellite: satellite._id,
      status: { $in: ['Planned', 'In Progress'] },
    });

    if (activeMissions > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete satellite '${satellite.name}'. It is currently assigned to ${activeMissions} active or planned mission(s).`,
      });
    }

    // Cascade delete related simulated telemetry and maintenance
    await Telemetry.deleteMany({ satellite: satellite._id });
    await Maintenance.deleteMany({ satellite: satellite._id });
    await satellite.deleteOne();

    res.json({
      success: true,
      message: `Satellite '${satellite.name}' and associated records successfully removed`,
      deletedId: req.params.id,
    });
  } catch (error) {
    next(error);
  }
};
