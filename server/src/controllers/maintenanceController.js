import { Maintenance } from '../models/Maintenance.js';
import { Satellite } from '../models/Satellite.js';
import { delCache } from '../config/redis.js';

export const getMaintenanceRecords = async (req, res, next) => {
  try {
    const { q, satellite, status, severity, sort = '-scheduledDate' } = req.query;
    const query = {};

    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { technician: { $regex: q, $options: 'i' } },
      ];
    }

    if (satellite) {
      query.satellite = satellite;
    }

    if (status) {
      query.status = status;
    }

    if (severity) {
      query.severity = severity;
    }

    const records = await Maintenance.find(query)
      .populate('satellite', 'name noradId orbitType status')
      .populate('createdBy', 'name email callsign')
      .sort(sort);

    res.json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

export const getMaintenanceById = async (req, res, next) => {
  try {
    const record = await Maintenance.findById(req.params.id)
      .populate('satellite')
      .populate('createdBy', 'name email callsign');

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance record not found',
      });
    }

    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

export const createMaintenanceRecord = async (req, res, next) => {
  try {
    const {
      title,
      satellite,
      description,
      severity,
      status = 'Scheduled',
      scheduledDate,
      completedDate,
      technician,
      actionTaken,
    } = req.body;

    if (!title || !satellite || !description || !scheduledDate) {
      return res.status(400).json({
        success: false,
        message: 'Title, satellite, description, and scheduled date are required',
      });
    }

    const satelliteExists = await Satellite.findById(satellite);
    if (!satelliteExists) {
      return res.status(404).json({
        success: false,
        message: 'Linked satellite not found in fleet database',
      });
    }

    const record = await Maintenance.create({
      title,
      satellite,
      description,
      severity: severity || 'Medium',
      status,
      scheduledDate,
      completedDate: status === 'Completed' ? completedDate || new Date() : null,
      technician: technician || 'Spacecraft Servicing Division',
      createdBy: req.user ? req.user._id : null,
      actionTaken: actionTaken || '',
    });

    // Invalidate Redis dashboard summary and alerts cache
    await delCache('cache:dashboard:summary');
    await delCache('cache:dashboard:alerts');

    const populated = await Maintenance.findById(record._id)
      .populate('satellite', 'name noradId orbitType')
      .populate('createdBy', 'name email callsign');

    res.status(201).json({
      success: true,
      message: 'Maintenance log created successfully',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMaintenanceRecord = async (req, res, next) => {
  try {
    const existing = await Maintenance.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance record not found',
      });
    }

    const updateData = { ...req.body };
    if (updateData.status === 'Completed' && !updateData.completedDate && !existing.completedDate) {
      updateData.completedDate = new Date();
    }

    const updated = await Maintenance.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('satellite', 'name noradId orbitType')
      .populate('createdBy', 'name email callsign');

    // Invalidate Redis dashboard summary and alerts cache
    await delCache('cache:dashboard:summary');
    await delCache('cache:dashboard:alerts');

    res.json({
      success: true,
      message: 'Maintenance record updated',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMaintenanceRecord = async (req, res, next) => {
  try {
    const record = await Maintenance.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Maintenance record not found',
      });
    }

    await record.deleteOne();

    // Invalidate Redis dashboard summary and alerts cache
    await delCache('cache:dashboard:summary');
    await delCache('cache:dashboard:alerts');

    res.json({
      success: true,
      message: `Maintenance item '${record.title}' deleted successfully`,
      deletedId: req.params.id,
    });
  } catch (error) {
    next(error);
  }
};
