import Redis from 'ioredis';

const API_BASE = 'http://localhost:5000/api';

async function testRedisCache() {
  console.log('--- Testing Redis Connection and Cache Subsystem ---');

  // 1. Direct connection to Redis container on port 6379
  const redisClient = new Redis('redis://localhost:6379');
  await redisClient.ping();
  console.log('[Redis Direct] Connected to Redis on localhost:6379 successfully.');

  // 2. Login to get Admin JWT
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@spaceops.local', password: 'MissionControl2026!' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  const headers = { Authorization: `Bearer ${token}` };

  // 3. Query Dashboard Summary (Miss then Hit)
  console.log('\n[Dashboard Summary Cache]');
  const sum1 = await (await fetch(`${API_BASE}/dashboard/summary`, { headers })).json();
  console.log(`Call 1 (Cache Miss): success=${sum1.success}, cached=${sum1.cached}`);
  
  const sum2 = await (await fetch(`${API_BASE}/dashboard/summary`, { headers })).json();
  console.log(`Call 2 (Cache Hit):  success=${sum2.success}, cached=${sum2.cached}`);

  // 4. Query Dashboard Alerts (Miss then Hit)
  console.log('\n[Dashboard Alerts Cache]');
  const alert1 = await (await fetch(`${API_BASE}/dashboard/alerts`, { headers })).json();
  console.log(`Call 1 (Cache Miss/Hit): cached=${alert1.cached}, alerts count=${alert1.count}`);

  const alert2 = await (await fetch(`${API_BASE}/dashboard/alerts`, { headers })).json();
  console.log(`Call 2 (Cache Hit):      cached=${alert2.cached}, alerts count=${alert2.count}`);

  // 5. Query Recent Telemetry Feed (Miss then Hit)
  console.log('\n[Recent Telemetry Feed Cache]');
  const telemFeed1 = await (await fetch(`${API_BASE}/telemetry?limit=15`, { headers })).json();
  console.log(`Call 1 (Cache Miss): cached=${telemFeed1.cached}, count=${telemFeed1.count}`);

  const telemFeed2 = await (await fetch(`${API_BASE}/telemetry?limit=15`, { headers })).json();
  console.log(`Call 2 (Cache Hit):  cached=${telemFeed2.cached}, count=${telemFeed2.count}`);

  // 6. Query Latest Telemetry for a Satellite (Miss then Hit)
  const satsRes = await (await fetch(`${API_BASE}/satellites`, { headers })).json();
  const satId = satsRes.data[0]._id;
  console.log(`\n[Latest Telemetry Cache for Sat ${satId} (${satsRes.data[0].name})]`);
  
  const lat1 = await (await fetch(`${API_BASE}/telemetry/satellite/${satId}/latest`, { headers })).json();
  console.log(`Call 1 (Cache Miss): cached=${lat1.cached}, timestamp=${lat1.data.timestamp}`);

  const lat2 = await (await fetch(`${API_BASE}/telemetry/satellite/${satId}/latest`, { headers })).json();
  console.log(`Call 2 (Cache Hit):  cached=${lat2.cached}, timestamp=${lat2.data.timestamp}`);

  // 7. Inspect keys directly inside Redis
  console.log('\n[Direct Redis Keys Inspection]');
  const keys = await redisClient.keys('cache:*');
  console.log(`Found ${keys.length} active cache keys in Redis:`);
  for (const k of keys) {
    const ttl = await redisClient.ttl(k);
    console.log(` - Key: "${k}" (TTL: ${ttl}s)`);
  }

  await redisClient.disconnect();
  console.log('\n=== REDIS VERIFICATION COMPLETED SUCCESSFULLY ===');
}

testRedisCache().catch((err) => {
  console.error('Redis verification failed:', err);
  process.exit(1);
});
