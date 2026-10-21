import { Mission } from '../models/Mission.js';
import { GroundStation } from '../models/GroundStation.js';

/**
 * Checks if assigning a ground station to a mission creates a schedule conflict.
 * An overlap exists if: (existing.startTime < target.endTime) AND (existing.endTime > target.startTime)
 *
 * @param {string} stationId - Ground Station ID to assign
 * @param {Date|string} startTime - Mission start timestamp
 * @param {Date|string} endTime - Mission end timestamp
 * @param {string|null} excludeMissionId - Current mission ID if updating
 * @returns {Promise<{ hasConflict: boolean, message?: string, conflictingMission?: object, station?: object }>}
 */
export const checkGroundStationConflict = async (
  stationId,
  startTime,
  endTime,
  excludeMissionId = null
) => {
  if (!stationId) {
    return { hasConflict: false };
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid start or end date provided for schedule conflict check');
  }

  if (start >= end) {
    return {
      hasConflict: true,
      message: 'Mission start time must be before end time',
    };
  }

  const station = await GroundStation.findById(stationId);
  if (!station) {
    return {
      hasConflict: true,
      message: 'Selected ground station does not exist',
    };
  }

  if (station.status === 'Offline' || station.status === 'Maintenance') {
    return {
      hasConflict: true,
      message: `Station '${station.name}' is currently ${station.status.toLowerCase()} and cannot be assigned`,
      station,
    };
  }

  const query = {
    assignedStation: stationId,
    status: { $in: ['Planned', 'In Progress'] },
    startTime: { $lt: end },
    endTime: { $gt: start },
  };

  if (excludeMissionId) {
    query._id = { $ne: excludeMissionId };
  }

  const conflictingMission = await Mission.findOne(query).populate('satellite', 'name noradId');

  if (conflictingMission) {
    const conflictStart = new Date(conflictingMission.startTime).toISOString();
    const conflictEnd = new Date(conflictingMission.endTime).toISOString();
    return {
      hasConflict: true,
      message: `Ground station schedule conflict: Station '${station.name}' is already assigned to mission '${conflictingMission.name}' (${conflictStart} to ${conflictEnd})`,
      conflictingMission,
      station,
    };
  }

  return { hasConflict: false, station };
};
