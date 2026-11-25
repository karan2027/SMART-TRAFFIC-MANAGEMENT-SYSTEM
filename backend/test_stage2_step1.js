const http = require('http');
const app = require('./src/app');

const server = http.createServer(app);
const PORT = 5055; // Use dedicated test port

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  server.listen(PORT, async () => {
    console.log(`\n==================================================`);
    console.log(`RUNNING STAGE 2 — STEP 1 VERIFICATION TESTS`);
    console.log(`==================================================\n`);

    try {
      // 1. GET /api/junctions
      console.log('TEST 1: GET /api/junctions');
      let res = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/junctions',
        method: 'GET'
      });
      console.log(`Status: ${res.status}`);
      console.log(`Count: ${res.data.count}`);
      console.log(`Junction ID: ${res.data.data[0].junctionId}`);
      console.log(`Approaches Count: ${res.data.data[0].approaches.length}`);
      if (res.status !== 200 || res.data.data[0].approaches.length !== 4) {
        throw new Error('Test 1 Failed');
      }
      console.log('✅ TEST 1 PASSED\n');

      // 2. GET /api/junctions/JUNC001
      console.log('TEST 2: GET /api/junctions/JUNC001');
      res = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/junctions/JUNC001',
        method: 'GET'
      });
      console.log(`Status: ${res.status}`);
      console.log(`Active Direction: ${res.data.data.activeDirection}`);
      console.log(`Current Mode: ${res.data.data.operatingMode}`);
      if (res.status !== 200 || res.data.data.junctionId !== 'JUNC001') {
        throw new Error('Test 2 Failed');
      }
      console.log('✅ TEST 2 PASSED\n');

      // 3. PUT /api/junctions/JUNC001/phase (Switch green from NORTH to EAST)
      console.log('TEST 3: PUT /api/junctions/JUNC001/phase (Switch green to EAST)');
      res = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/junctions/JUNC001/phase',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      }, {
        activeDirection: 'EAST',
        phaseState: 'GREEN_ACTIVE',
        allocatedGreenSeconds: 30,
        remainingSeconds: 30
      });
      console.log(`Status: ${res.status}`);
      console.log(`Message: ${res.data.message}`);
      const eastApp = res.data.data.approaches.find(a => a.direction === 'EAST');
      const northApp = res.data.data.approaches.find(a => a.direction === 'NORTH');
      console.log(`EAST Signal: ${eastApp.signalState} (${eastApp.remainingSeconds}s)`);
      console.log(`NORTH Signal: ${northApp.signalState}`);
      if (res.status !== 200 || eastApp.signalState !== 'GREEN' || northApp.signalState !== 'RED') {
        throw new Error('Test 3 Failed');
      }
      console.log('✅ TEST 3 PASSED\n');

      // 4. POST /api/junctions/JUNC001/emergency (Trigger ambulance corridor on SOUTH)
      console.log('TEST 4: POST /api/junctions/JUNC001/emergency (Ambulance on SOUTH)');
      res = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/junctions/JUNC001/emergency',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        approach: 'SOUTH',
        vehicleType: 'AMBULANCE',
        triggeredBy: 'AI_DETECTION'
      });
      console.log(`Status: ${res.status}`);
      console.log(`Message: ${res.data.message}`);
      console.log(`Mode: ${res.data.data.operatingMode}`);
      const southApp = res.data.data.approaches.find(a => a.direction === 'SOUTH');
      const otherApps = res.data.data.approaches.filter(a => a.direction !== 'SOUTH');
      console.log(`SOUTH (Emergency): ${southApp.signalState}`);
      console.log(`Other 3 Directions: ${otherApps.map(a => `${a.direction}=${a.signalState}`).join(', ')}`);
      if (res.status !== 200 || southApp.signalState !== 'GREEN' || otherApps.some(a => a.signalState !== 'RED')) {
        throw new Error('Test 4 Failed');
      }
      console.log('✅ TEST 4 PASSED\n');

      // 5. POST /api/junctions/JUNC001/emergency/clear (Clear emergency override)
      console.log('TEST 5: POST /api/junctions/JUNC001/emergency/clear');
      res = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/junctions/JUNC001/emergency/clear',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`Status: ${res.status}`);
      console.log(`Message: ${res.data.message}`);
      console.log(`Restored Mode: ${res.data.data.operatingMode}`);
      console.log(`Emergency Active Flag: ${res.data.data.emergencyOverride.isActive}`);
      if (res.status !== 200 || res.data.data.operatingMode !== 'ADAPTIVE' || res.data.data.emergencyOverride.isActive !== false) {
        throw new Error('Test 5 Failed');
      }
      console.log('✅ TEST 5 PASSED\n');

      // 6. Safety Invariant Check: Reject multiple GREEN approaches
      console.log('TEST 6: Safety Invariant Check (Reject multiple conflicting GREENs)');
      res = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/junctions/JUNC001/phase',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      }, {
        activeDirection: 'NORTH',
        phaseState: 'GREEN_ACTIVE',
        signalStates: {
          NORTH: 'GREEN',
          EAST: 'GREEN', // Illegal conflict!
          SOUTH: 'RED',
          WEST: 'RED'
        }
      });
      console.log(`Status: ${res.status} (Expected: 400)`);
      console.log(`Error Code: ${res.data.errorCode}`);
      console.log(`Error Message: ${res.data.message}`);
      if (res.status !== 400 || res.data.errorCode !== 'CONFLICTING_SIGNALS') {
        throw new Error('Test 6 Failed: Conflicting signals were not rejected!');
      }
      console.log('✅ TEST 6 PASSED\n');

      console.log('==================================================');
      console.log('ALL STAGE 2 — STEP 1 VERIFICATION TESTS PASSED! 🎉');
      console.log('==================================================\n');

    } catch (err) {
      console.error('❌ Test failed with error:', err.message);
      process.exitCode = 1;
    } finally {
      server.close();
    }
  });
}

runTests();
