import { Mission } from '../models/Mission.js';
import { checkGroundStationConflict } from '../utils/conflictChecker.js';

export const getMissions = async (req, res, next) => {
  try {
    const { q, status, satellite, assignedStation, sort = '-startTime' } = req.query;
    const query = {};

    if (q) {
      query.name = { $regex: q, $options: 'i' };
    }

    if (status) {
      query.status = status;
    }

    if (satellite) {
      query.satellite = satellite;
    }

    if (assignedStation) {
      query.assignedStation = assignedStation;
    }

    const missions = await Mission.find(query)
      .populate('satellite', 'name noradId orbitType status altitudeKm')
      .populate('assignedStation', 'name city country status frequencyBand')
      .populate('leadOperator', 'name email callsign')
      .sort(sort);

    res.json({
      success: true,
      count: missions.length,
      data: missions,
    });
  } catch (error) {
    next(error);
  }
};

export const getMissionById = async (req, res, next) => {
  try {
    const mission = await Mission.findById(req.params.id)
      .populate('satellite')
      .populate('assignedStation')
      .populate('leadOperator', 'name email callsign role');

    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found',
      });
    }

    res.json({
      success: true,
      data: mission,
    });
  } catch (error) {
    next(error);
  }
};

export const createMission = async (req, res, next) => {
  try {
    const {
      name,
      satellite,
      description,
      startTime,
      endTime,
      status = 'Planned',
      assignedStation,
      priority,
    } = req.body;

    if (!name || !satellite || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'Name, satellite, start time, and end time are required',
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid start time or end time format',
      });
    }

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Mission start time must be before end time',
      });
    }

    // Schedule Conflict Verification: Ground Station overlap check
    if (assignedStation && ['Planned', 'In Progress'].includes(status)) {
      const conflictResult = await checkGroundStationConflict(assignedStation, start, end);
      if (conflictResult.hasConflict) {
        return res.status(409).json({
          success: false,
          conflict: true,
          message: conflictResult.message,
          conflictingMission: conflictResult.conflictingMission,
        });
      }
    }

    const mission = await Mission.create({
      name,
      satellite,
      description,
      startTime: start,
      endTime: end,
      status,
      assignedStation: assignedStation || null,
      priority: priority || 'Routine',
      leadOperator: req.user ? req.user._id : null,
    });

    const populatedMission = await Mission.findById(mission._id)
      .populate('satellite', 'name noradId orbitType')
      .populate('assignedStation', 'name city country');

    res.status(201).json({
      success: true,
      message: 'Mission scheduled successfully',
      data: populatedMission,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMission = async (req, res, next) => {
  try {
    const existing = await Mission.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found',
      });
    }

    const startTime = req.body.startTime ? new Date(req.body.startTime) : existing.startTime;
    const endTime = req.body.endTime ? new Date(req.body.endTime) : existing.endTime;
    const assignedStation =
      req.body.assignedStation !== undefined ? req.body.assignedStation : existing.assignedStation;
    const status = req.body.status || existing.status;

    if (startTime >= endTime) {
      return res.status(400).json({
        success: false,
        message: 'Mission start time must be before end time',
      });
    }

    // Check conflict if ground station is assigned
    if (assignedStation && ['Planned', 'In Progress'].includes(status)) {
      const conflictResult = await checkGroundStationConflict(
        assignedStation,
        startTime,
        endTime,
        existing._id
      );

      if (conflictResult.hasConflict) {
        return res.status(409).json({
          success: false,
          conflict: true,
          message: conflictResult.message,
          conflictingMission: conflictResult.conflictingMission,
        });
      }
    }

    const updated = await Mission.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        startTime,
        endTime,
        assignedStation: assignedStation || null,
      },
      { new: true, runValidators: true }
    )
      .populate('satellite', 'name noradId orbitType')
      .populate('assignedStation', 'name city country');

    res.json({
      success: true,
      message: 'Mission updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMission = async (req, res, next) => {
  try {
    const mission = await Mission.findById(req.params.id);

    if (!mission) {
      return res.status(404).json({
        success: false,
        message: 'Mission not found',
      });
    }

    await mission.deleteOne();

    res.json({
      success: true,
      message: `Mission '${mission.name}' successfully deleted`,
      deletedId: req.params.id,
    });
  } catch (error) {
    next(error);
  }
};
