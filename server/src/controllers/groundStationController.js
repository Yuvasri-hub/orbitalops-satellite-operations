import { GroundStation } from '../models/GroundStation.js';
import { Mission } from '../models/Mission.js';

export const getStations = async (req, res, next) => {
  try {
    const { q, status, frequencyBand, sort = 'name' } = req.query;
    const query = {};

    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { city: { $regex: q, $options: 'i' } },
        { country: { $regex: q, $options: 'i' } },
      ];
    }

    if (status) {
      query.status = status;
    }

    if (frequencyBand) {
      query.frequencyBand = frequencyBand;
    }

    const stations = await GroundStation.find(query).sort(sort);

    res.json({
      success: true,
      count: stations.length,
      data: stations,
    });
  } catch (error) {
    next(error);
  }
};

export const getStationById = async (req, res, next) => {
  try {
    const station = await GroundStation.findById(req.params.id);

    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Ground station not found',
      });
    }

    const assignedMissions = await Mission.find({
      assignedStation: station._id,
      status: { $in: ['Planned', 'In Progress'] },
    }).populate('satellite', 'name noradId');

    res.json({
      success: true,
      data: station,
      assignedMissions,
    });
  } catch (error) {
    next(error);
  }
};

export const createStation = async (req, res, next) => {
  try {
    const {
      name,
      city,
      country,
      latitude,
      longitude,
      status,
      dishDiameterMeters,
      frequencyBand,
      contactEmail,
      notes,
    } = req.body;

    const station = await GroundStation.create({
      name,
      city,
      country,
      latitude,
      longitude,
      status,
      dishDiameterMeters,
      frequencyBand,
      contactEmail,
      notes,
    });

    res.status(201).json({
      success: true,
      message: 'Ground station successfully added to tracking network',
      data: station,
    });
  } catch (error) {
    next(error);
  }
};

export const updateStation = async (req, res, next) => {
  try {
    const station = await GroundStation.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Ground station not found',
      });
    }

    res.json({
      success: true,
      message: 'Ground station specifications updated successfully',
      data: station,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStation = async (req, res, next) => {
  try {
    const station = await GroundStation.findById(req.params.id);

    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Ground station not found',
      });
    }

    const linkedMissions = await Mission.countDocuments({
      assignedStation: station._id,
      status: { $in: ['Planned', 'In Progress'] },
    });

    if (linkedMissions > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete ground station '${station.name}'. It is currently allocated to ${linkedMissions} active or planned mission(s).`,
      });
    }

    await station.deleteOne();

    res.json({
      success: true,
      message: `Ground station '${station.name}' successfully decommissioned and deleted`,
      deletedId: req.params.id,
    });
  } catch (error) {
    next(error);
  }
};
