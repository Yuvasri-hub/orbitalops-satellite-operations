/**
 * Generates simulated telemetry data for demonstration and testing purposes.
 * NOTE: All data produced by this generator is entirely simulated demo data
 * and does not represent real spacecraft flight instruments.
 */
export const generateSimulatedTelemetryPoint = (satelliteId, timestamp = new Date()) => {
  const date = new Date(timestamp);
  const timeSeconds = Math.floor(date.getTime() / 1000);

  // Realistic diurnal/orbital oscillation based on 90-minute LEO orbit
  const orbitCycle = Math.sin((timeSeconds % 5400) / 5400 * 2 * Math.PI);
  const noise = (Math.random() - 0.5) * 0.4;

  const batteryVoltage = Number((28.0 + orbitCycle * 2.2 + noise).toFixed(2));
  const batteryTemperature = Number((18.5 + orbitCycle * 8.0 + (Math.random() - 0.5) * 1.5).toFixed(1));
  const solarPanelCurrent = Number((Math.max(0, 14.5 * orbitCycle + 7.5 + (Math.random() - 0.5) * 1.2)).toFixed(2));
  const signalStrengthDbm = Number((-92.0 + (Math.random() - 0.5) * 14.0).toFixed(1));
  const orbitVelocityKmS = Number((7.62 + (Math.random() - 0.5) * 0.05).toFixed(3));
  const altitudeKm = Number((542 + orbitCycle * 8 + (Math.random() - 0.5) * 2).toFixed(1));

  let payloadStatus = 'Nominal';
  if (batteryVoltage < 25.5) {
    payloadStatus = 'Standby';
  } else if (signalStrengthDbm < -105) {
    payloadStatus = 'Degraded';
  }

  return {
    satellite: satelliteId,
    timestamp: date,
    batteryVoltage,
    batteryTemperature,
    solarPanelCurrent,
    signalStrengthDbm,
    orbitVelocityKmS,
    altitudeKm,
    payloadStatus,
    subsystems: {
      obc: 'OK',
      aocs: 'LOCKED',
      comm: signalStrengthDbm < -100 ? 'DEGRADED' : 'ACTIVE',
      eps: batteryVoltage < 25.0 ? 'LOW_POWER' : 'NOMINAL',
    },
    isSimulated: true,
    simulationDisclaimer: 'SIMULATED DEMO DATA ONLY - Not connected to real flight hardware',
  };
};

export const generateBatchSimulatedTelemetry = (satelliteId, count = 20, intervalMinutes = 15) => {
  const points = [];
  const now = Date.now();

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = new Date(now - i * intervalMinutes * 60 * 1000);
    points.push(generateSimulatedTelemetryPoint(satelliteId, timestamp));
  }

  return points;
};
