import { CommLog } from '../models/CommLog.js';
import { Mission } from '../models/Mission.js';

export const getCommLogs = async (req, res, next) => {
  try {
    const { mission, logType, signalQuality, q, sort = '-timestamp' } = req.query;
    const query = {};

    if (mission) {
      query.mission = mission;
    }

    if (logType) {
      query.logType = logType;
    }

    if (signalQuality) {
      query.signalQuality = signalQuality;
    }

    if (q) {
      query.message = { $regex: q, $options: 'i' };
    }

    const logs = await CommLog.find(query)
      .populate({
        path: 'mission',
        select: 'name status satellite',
        populate: { path: 'satellite', select: 'name noradId' },
      })
      .populate('groundStation', 'name city country')
      .populate('createdBy', 'name email callsign')
      .sort(sort);

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

export const createCommLog = async (req, res, next) => {
  try {
    const { mission, groundStation, logType, message, signalQuality, frequencyMhz } = req.body;

    if (!mission || !message) {
      return res.status(400).json({
        success: false,
        message: 'Mission identifier and communication message are required',
      });
    }

    const missionExists = await Mission.findById(mission);
    if (!missionExists) {
      return res.status(404).json({
        success: false,
        message: 'Linked mission not found',
      });
    }

    const log = await CommLog.create({
      mission,
      groundStation: groundStation || missionExists.assignedStation || null,
      logType: logType || 'Telemetry Pass',
      message,
      signalQuality: signalQuality || 'Nominal',
      frequencyMhz: frequencyMhz || 2200.5,
      createdBy: req.user ? req.user._id : null,
      timestamp: new Date(),
    });

    const populated = await CommLog.findById(log._id)
      .populate({
        path: 'mission',
        select: 'name status satellite',
        populate: { path: 'satellite', select: 'name noradId' },
      })
      .populate('groundStation', 'name city country')
      .populate('createdBy', 'name email callsign');

    res.status(201).json({
      success: true,
      message: 'Communication log entry recorded',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCommLog = async (req, res, next) => {
  try {
    const log = await CommLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Communication log entry not found',
      });
    }

    await log.deleteOne();

    res.json({
      success: true,
      message: 'Communication log entry removed',
      deletedId: req.params.id,
    });
  } catch (error) {
    next(error);
  }
};
