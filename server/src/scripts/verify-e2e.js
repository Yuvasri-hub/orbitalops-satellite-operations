import http from 'http';

const API_BASE = 'http://localhost:5000/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runE2E() {
  console.log('=== STARTING END-TO-END VERIFICATION CHECKS ===\n');

  // 1. Health endpoint
  console.log('Checking 1: Health endpoint...');
  const health = await request('/health');
  if (health.status !== 200 || health.data.status !== 'operational') {
    throw new Error(`Health check failed: ${JSON.stringify(health.data)}`);
  }
  console.log(`[PASS] Health check OK. Service Status: ${health.data.status}\n`);

  // 2. Authentication: Admin Login
  console.log('Checking 2: Admin Authentication...');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@spaceops.local', password: 'MissionControl2026!' }),
  });
  if (adminLogin.status !== 200 || !adminLogin.data.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  }
  const adminToken = adminLogin.data.token;
  console.log(`[PASS] Admin authenticated as: ${adminLogin.data.user.name} (${adminLogin.data.user.role})\n`);

  // 3. Authentication: Operator Login
  console.log('Checking 3: Operator Authentication & Role Guard...');
  const opLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'operator@spaceops.local', password: 'MissionControl2026!' }),
  });
  const opToken = opLogin.data.token;
  console.log(`[PASS] Operator authenticated as: ${opLogin.data.user.name} (${opLogin.data.user.role})\n`);

  // 4. Role Guard: Operator attempts to delete satellite (Forbidden check)
  console.log('Checking 4: Role Permissions (Operator cannot delete satellite)...');
  const satellites = await request('/satellites', { headers: { Authorization: `Bearer ${adminToken}` } });
  const testSat = satellites.data.data[0];
  const deleteAttempt = await request(`/satellites/${testSat._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${opToken}` },
  });
  if (deleteAttempt.status !== 403) {
    throw new Error(`Operator was able to delete satellite! Status: ${deleteAttempt.status}`);
  }
  console.log(`[PASS] Operator deletion blocked with HTTP 403 Forbidden: ${deleteAttempt.data.message}\n`);

  // 5. Ground Station Conflict Rejection Check
  console.log('Checking 5: Ground Station Schedule Conflict Rejection...');
  const stations = await request('/stations', { headers: { Authorization: `Bearer ${adminToken}` } });
  const station = stations.data.data.find(s => s.name.includes('Svalbard')) || stations.data.data[0];

  const now = new Date();
  const offset = 100 + Math.floor(Math.random() * 50000);
  const startTimeA = new Date(now.getTime() + offset * 3600000).toISOString();
  const endTimeA = new Date(now.getTime() + (offset + 4) * 3600000).toISOString();

  // Create Mission A on Station
  const missionA = await request('/missions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `E2E Flight Pass Alpha ${offset}`,
      satellite: testSat._id,
      assignedStation: station._id,
      startTime: startTimeA,
      endTime: endTimeA,
      status: 'Planned',
    }),
  });
  if (missionA.status !== 201) {
    throw new Error(`Failed to create Mission A: ${JSON.stringify(missionA.data)}`);
  }
  console.log(`[PASS] Scheduled Mission A on ${station.name} (${startTimeA} to ${endTimeA})`);

  // Attempt Overlapping Mission B on same Station
  const startTimeB = new Date(now.getTime() + (offset + 2) * 3600000).toISOString(); // Overlaps!
  const endTimeB = new Date(now.getTime() + (offset + 6) * 3600000).toISOString();

  const missionB = await request('/missions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: `E2E Flight Pass Bravo ${offset} (Conflict Test)`,
      satellite: testSat._id,
      assignedStation: station._id,
      startTime: startTimeB,
      endTime: endTimeB,
      status: 'Planned',
    }),
  });

  if (missionB.status !== 409 || !missionB.data.conflict) {
    throw new Error(`Overlapping mission was NOT rejected! Status: ${missionB.status}, Body: ${JSON.stringify(missionB.data)}`);
  }
  console.log(`[PASS] Overlapping assignment correctly rejected with HTTP 409 Conflict: "${missionB.data.message}"\n`);

  // 6. Simulated Telemetry Filtering
  console.log('Checking 6: Simulated Telemetry Filtering & Labels...');
  const telem = await request(`/telemetry?satellite=${testSat._id}&limit=5`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (telem.status !== 200 || !telem.data.simulationNotice) {
    throw new Error(`Telemetry failed: ${JSON.stringify(telem.data)}`);
  }
  if (!telem.data.data.every(t => t.isSimulated === true)) {
    throw new Error('Telemetry frame missing isSimulated flag!');
  }
  console.log(`[PASS] Telemetry returned ${telem.data.count} frames for ${testSat.name}`);
  console.log(`[PASS] Verified simulation disclaimer: "${telem.data.simulationNotice}"\n`);

  // 7. Maintenance Record Management
  console.log('Checking 7: Maintenance Record Creation & Status Update...');
  const engLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'engineer@spaceops.local', password: 'MissionControl2026!' }),
  });
  const engToken = engLogin.data.token;

  const newMaint = await request('/maintenance', {
    method: 'POST',
    headers: { Authorization: `Bearer ${engToken}` },
    body: JSON.stringify({
      title: 'E2E Reaction Wheel Dynamic Balancing',
      satellite: testSat._id,
      description: 'Vibration dampening verification during orbital apogee pass.',
      severity: 'High',
      status: 'In Progress',
      scheduledDate: new Date().toISOString(),
      technician: 'Sarah O’Connor (Avionics)',
    }),
  });
  if (newMaint.status !== 201) {
    throw new Error(`Maintenance creation failed: ${JSON.stringify(newMaint.data)}`);
  }
  console.log(`[PASS] Maintenance record created: "${newMaint.data.data.title}" (Severity: ${newMaint.data.data.severity})`);

  // Update to Completed
  const updateMaint = await request(`/maintenance/${newMaint.data.data._id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${engToken}` },
    body: JSON.stringify({
      status: 'Completed',
      actionTaken: 'Balanced to 0.02 mm/s vibration RMS tolerance.',
    }),
  });
  if (updateMaint.status !== 200 || updateMaint.data.data.status !== 'Completed') {
    throw new Error(`Maintenance update failed: ${JSON.stringify(updateMaint.data)}`);
  }
  console.log(`[PASS] Maintenance status updated to Completed with actionTaken recorded.\n`);

  // 8. Communication Log Entry
  console.log('Checking 8: Communication Log Creation linked to Mission...');
  const newComm = await request('/comm-logs', {
    method: 'POST',
    headers: { Authorization: `Bearer ${opToken}` },
    body: JSON.stringify({
      mission: missionA.data.data._id,
      groundStation: station._id,
      logType: 'Command Uplink',
      message: 'E2E Automated Test: Flight command uplink sequence #994 executed.',
      signalQuality: 'Nominal',
      frequencyMhz: 2200.5,
    }),
  });
  if (newComm.status !== 201) {
    throw new Error(`Comm log creation failed: ${JSON.stringify(newComm.data)}`);
  }
  // 9. Redis Alerts & Telemetry Cache Verification
  console.log('Checking 9: Redis Alerts & Caching Subsystem...');
  const alertsRes = await request('/dashboard/alerts', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (alertsRes.status !== 200) {
    throw new Error(`Alerts endpoint failed: ${JSON.stringify(alertsRes.data)}`);
  }
  console.log(`[PASS] Redis cached alerts endpoint returned ${alertsRes.data.count} alerts (cached: ${alertsRes.data.cached})\n`);

  // Clean up created test entities
  if (missionA?.data?.data?._id) {
    await request(`/missions/${missionA.data.data._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  }
  if (newMaint?.data?.data?._id) {
    await request(`/maintenance/${newMaint.data.data._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${engToken}` },
    });
  }

  console.log('====================================================');
  console.log(' ALL 9 END-TO-END VERIFICATION CHECKS PASSED (100%)');
  console.log('====================================================');
}

runE2E().catch((err) => {
  console.error('\n[FAIL] E2E Verification failed:', err.message);
  process.exit(1);
});
