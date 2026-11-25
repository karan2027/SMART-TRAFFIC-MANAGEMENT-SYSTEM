const http = require('http');
const app = require('./src/app');

const server = http.createServer(app);
const PORT = 5056;

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
    console.log('\n=============================================================');
    console.log('RUNNING COMPLETE AITMS BACKEND API INTEGRATION TEST SUITE');
    console.log('=============================================================\n');

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
      try {
        process.stdout.write(`TEST: ${name}... `);
        await fn();
        console.log('✅ PASS');
        passed++;
      } catch (err) {
        console.log(`❌ FAIL (${err.message})`);
        failed++;
      }
    }

    try {
      // 1. Health check
      await test('GET /api/health', async () => {
        const res = await request({ hostname: 'localhost', port: PORT, path: '/api/health', method: 'GET' });
        if (res.status !== 200 || res.data.status !== 'ok') throw new Error(`Status ${res.status}`);
      });

      // 2. Camera Management & Mobile Stream Add/Test
      await test('Camera Management: GET, POST (Mobile IP Webcam), and TEST probe', async () => {
        // List
        let res = await request({ hostname: 'localhost', port: PORT, path: '/api/cameras', method: 'GET' });
        if (res.status !== 200 || !Array.isArray(res.data.data)) throw new Error('Failed to list cameras');

        // Create Mobile Camera
        res = await request({
          hostname: 'localhost', port: PORT, path: '/api/cameras', method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, {
          cameraId: 'CAM_MOBILE_TEST',
          name: 'Android Mobile Unit Test Cam',
          roadId: 'ROAD_N01',
          junctionId: 'JUNC001',
          sourceType: 'mobile_stream',
          streamUrl: 'http://127.0.0.1:5056/api/health', // safe local probe target
          isMobileCamera: true,
          resolution: { width: 1280, height: 720 },
          fps: 30
        });
        if (res.status !== 201 || res.data.data.cameraId !== 'CAM_MOBILE_TEST') throw new Error('Create camera failed');

        // Test Connection
        res = await request({
          hostname: 'localhost', port: PORT, path: '/api/cameras/CAM_MOBILE_TEST/test', method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.status !== 200 || res.data.status !== 'online') throw new Error(`Test probe failed: ${JSON.stringify(res.data)}`);
      });

      // 3. Multi-Road & Multi-Junction Management
      await test('Multi-Junction & Multi-Road Verification (2+ junctions, 4+ roads)', async () => {
        let res = await request({ hostname: 'localhost', port: PORT, path: '/api/junctions', method: 'GET' });
        if (res.status !== 200 || res.data.count < 2) throw new Error(`Expected at least 2 junctions, got ${res.data.count}`);

        const j1 = res.data.data.find(j => j.junctionId === 'JUNC001');
        const j2 = res.data.data.find(j => j.junctionId === 'JUNC002');
        if (!j1 || !j2) throw new Error('Both JUNC001 and JUNC002 must exist');
        if (j1.approaches.length !== 4 || j2.approaches.length !== 4) throw new Error('Each junction must have 4 approaches');

        // Roads
        res = await request({ hostname: 'localhost', port: PORT, path: '/api/roads', method: 'GET' });
        if (res.status !== 200 || res.data.data.length < 4) throw new Error('Expected at least 4 roads');
      });

      // 4. V2X SPaT & GLOSA Advisory Endpoint
      await test('V2X SPaT & GLOSA: GET /api/junctions/JUNC001/spat', async () => {
        const res = await request({ hostname: 'localhost', port: PORT, path: '/api/junctions/JUNC001/spat', method: 'GET' });
        if (res.status !== 200 || !res.data.data.glosaAdvisory) throw new Error('SPaT or GLOSA missing');
        if (typeof res.data.data.glosaAdvisory.recommendedCruiseSpeedKmh !== 'number') throw new Error('Invalid GLOSA speed');
      });

      // 5. Vulnerable Pedestrian Crosswalk Extension
      await test('Pedestrian Safety: POST /api/junctions/JUNC001/pedestrians', async () => {
        const res = await request({
          hostname: 'localhost', port: PORT, path: '/api/junctions/JUNC001/pedestrians', method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, {
          approach: 'NORTH',
          crosswalkOccupied: true,
          waitingPedestrians: 4,
          extendSeconds: 8
        });
        if (res.status !== 200 || res.data.data.pedestrianSafety.walkPhaseExtended !== true) {
          throw new Error('Pedestrian extension failed');
        }
      });

      // 6. Accident Reporting, Geospatial Query & Verify/Dispatch
      await test('Accident Incident: Report, 2.5km Nearest Officers & Dispatch', async () => {
        // Report
        let res = await request({
          hostname: 'localhost', port: PORT, path: '/api/incidents', method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, {
          junctionId: 'JUNC001',
          roadId: 'ROAD_N01',
          approach: 'NORTH',
          confidence: 0.94,
          severity: 'CRITICAL',
          collisionType: 'VEHICLE_COLLISION',
          involvedTrackIds: [14, 18],
          velocitiesAtImpactKmh: [42.0, 0.0],
          evidenceVideoUrl: '/outputs/incident_evidence_clip_01.mp4'
        });
        if (res.status !== 201) throw new Error('Incident report failed');
        const incidentId = res.data.data.incidentId;

        // Query Officers Nearby
        res = await request({ hostname: 'localhost', port: PORT, path: '/api/incidents/officers/nearby?lon=77.2090&lat=28.6139&radiusKm=2.5', method: 'GET' });
        if (res.status !== 200 || res.data.count === 0) throw new Error('Nearby officers query returned 0');

        // Verify & Dispatch
        res = await request({
          hostname: 'localhost', port: PORT, path: `/api/incidents/${incidentId}/verify`, method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, {
          verifiedBy: 'Senior Traffic Inspector',
          notes: 'Collision confirmed on camera CAM_NORTH. Ambulances and patrol dispatched.'
        });
        if (res.status !== 200 || res.data.data.status !== 'VERIFIED_DISPATCHED') throw new Error('Dispatch failed');
        if (res.data.data.dispatchedOfficers.length === 0) throw new Error('No officers were dispatched');
      });

      // 7. Stray Cattle Hazard Management (Indian Context)
      await test('Stray Cattle Hazard: Report, Flashing Amber Mitigation & Resolution', async () => {
        let res = await request({
          hostname: 'localhost', port: PORT, path: '/api/hazards', method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, {
          junctionId: 'JUNC001',
          roadId: 'ROAD_S01',
          approach: 'SOUTH',
          animalClass: 'COW',
          confidence: 0.92,
          consecutiveFramesObserved: 14,
          hazardState: 'STATIONARY_OBSTRUCTION'
        });
        if (res.status !== 201 || res.data.data.signalMitigation !== 'FLASHING_AMBER_PROCEED_WITH_CAUTION') {
          throw new Error('Cattle hazard report failed');
        }
        const hazardId = res.data.data.hazardId;

        // Resolve
        res = await request({
          hostname: 'localhost', port: PORT, path: `/api/hazards/${hazardId}/resolve`, method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, { squadNotes: 'Municipal animal rescue squad safely moved cattle to shelter' });
        if (res.status !== 200 || res.data.data.status !== 'RESOLVED') throw new Error('Resolve hazard failed');
      });

      // 8. ANPR & Indian Plate Format Validation
      await test('ANPR & Plate Format Validation (Valid: MH12AB1234, Invalid: 1234XYZ)', async () => {
        // Valid
        let res = await request({
          hostname: 'localhost', port: PORT, path: '/api/anpr', method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, {
          plateText: 'DL01CA9999',
          ocrConfidence: 0.96,
          vehicleTrackId: 105,
          vehicleClass: 'car',
          cameraId: 'CAM001',
          roadId: 'ROAD001'
        });
        if (res.status !== 201 || res.data.data.isFormatValid !== true) throw new Error('Valid plate rejected');

        // Format check endpoint
        res = await request({ hostname: 'localhost', port: PORT, path: '/api/anpr/validate?plate=MH12AB1234', method: 'GET' });
        if (res.status !== 200 || res.data.isValidIndianRegistration !== true) throw new Error('Plate validator failed on valid plate');

        res = await request({ hostname: 'localhost', port: PORT, path: '/api/anpr/validate?plate=INVALID123', method: 'GET' });
        if (res.status !== 200 || res.data.isValidIndianRegistration !== false) throw new Error('Invalid plate wrongly accepted');
      });

      // 9. Traffic Violation Detection & E-Challan Issuance
      await test('Traffic Violations: Red Light Jump & E-Challan generation', async () => {
        let res = await request({
          hostname: 'localhost', port: PORT, path: '/api/violations', method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, {
          violationType: 'RED_LIGHT_JUMP',
          junctionId: 'JUNC001',
          roadId: 'ROAD_N01',
          approach: 'NORTH',
          vehicleTrackId: 44,
          plateNumber: 'DL04MB7788',
          confidence: 0.97,
          fineAmountInr: 2000
        });
        if (res.status !== 201 || !res.data.data.eChallanNumber) throw new Error('E-Challan generation failed');
        const vId = res.data.data.violationId;

        // Review
        res = await request({
          hostname: 'localhost', port: PORT, path: `/api/violations/${vId}/review`, method: 'PUT',
          headers: { 'Content-Type': 'application/json' }
        }, {
          reviewStatus: 'VERIFIED',
          reviewedBy: 'Traffic Police Officer 102',
          notes: 'Clear stop-line crossing during RED phase confirmed.'
        });
        if (res.status !== 200 || res.data.data.reviewStatus !== 'VERIFIED') throw new Error('Violation review failed');
      });

      // 10. Green Corridor Graph Routing (Dijkstra) & Progress Tracking
      await test('Green Corridor: Network Route Planning (Dijkstra) & Multi-Junction Activation', async () => {
        // Plan
        let res = await request({
          hostname: 'localhost', port: PORT, path: '/api/corridors/plan', method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, { startJunctionId: 'JUNC001', destinationJunctionId: 'JUNC002' });
        if (res.status !== 200 || res.data.data.routeJunctions.length < 2) throw new Error('Route planning failed');

        // Activate
        res = await request({
          hostname: 'localhost', port: PORT, path: '/api/corridors/activate', method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, {
          emergencyType: 'AMBULANCE',
          vehicleIdentifier: 'AMB-TEST-99',
          startJunctionId: 'JUNC001',
          destinationJunctionId: 'JUNC002'
        });
        if (res.status !== 201 || res.data.data.status !== 'ACTIVE') throw new Error('Corridor activation failed');
        const cId = res.data.data.corridorId;

        // Advance to next junction
        res = await request({
          hostname: 'localhost', port: PORT, path: `/api/corridors/${cId}/advance`, method: 'POST'
        });
        if (res.status !== 200) throw new Error('Advance corridor failed');
      });

      // 11. AI-Based Traffic Prediction (5, 15, 30 min) & Error Metrics
      await test('Traffic Prediction: 5-, 15-, 30-min Horizons & MAE/RMSE/MAPE', async () => {
        const res = await request({ hostname: 'localhost', port: PORT, path: '/api/predictions?junctionId=JUNC001', method: 'GET' });
        if (res.status !== 200 || res.data.data.length < 3) throw new Error('Missing predictions');
        const p5 = res.data.data.find(p => p.horizonMinutes === 5);
        const p15 = res.data.data.find(p => p.horizonMinutes === 15);
        const p30 = res.data.data.find(p => p.horizonMinutes === 30);
        if (!p5 || !p15 || !p30) throw new Error('Must have 5, 15, and 30 minute horizons');
        if (!p5.metrics || typeof p5.metrics.mae !== 'number' || typeof p5.metrics.rmse !== 'number') {
          throw new Error('Missing accuracy metrics');
        }
      });

      // 12. Live Alerts & Notification Lifecycle
      await test('Live Alerts: Create, Acknowledge, and Resolve workflow', async () => {
        let res = await request({
          hostname: 'localhost', port: PORT, path: '/api/alerts', method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, {
          type: 'CONGESTION',
          severity: 'HIGH',
          title: 'East Flyover Backlog Alert',
          message: 'Queue exceeds 12 vehicles on approach EAST'
        });
        if (res.status !== 201) throw new Error('Alert create failed');
        const alertId = res.data.data.alertId;

        // Acknowledge
        res = await request({
          hostname: 'localhost', port: PORT, path: `/api/alerts/${alertId}/acknowledge`, method: 'PUT',
          headers: { 'Content-Type': 'application/json' }
        }, { acknowledgedBy: 'Dispatcher 07' });
        if (res.status !== 200 || res.data.data.status !== 'ACKNOWLEDGED') throw new Error('Acknowledge failed');

        // Resolve
        res = await request({
          hostname: 'localhost', port: PORT, path: `/api/alerts/${alertId}/resolve`, method: 'PUT'
        });
        if (res.status !== 200 || res.data.data.status !== 'RESOLVED') throw new Error('Resolve failed');
      });

      // 13. Environmental Carbon Offset Telemetry & System Health
      await test('Environmental Telemetry (kg CO2, litres fuel) & System Health', async () => {
        let res = await request({ hostname: 'localhost', port: PORT, path: '/api/telemetry/environmental?junctionId=JUNC001', method: 'GET' });
        if (res.status !== 200 || !res.data.data.cumulative.totalCo2PreventedKg) throw new Error('Environmental metrics missing');

        res = await request({ hostname: 'localhost', port: PORT, path: '/api/telemetry/system-health', method: 'GET' });
        if (res.status !== 200 || !res.data.data.edgeAiDeployment) throw new Error('System health missing');
      });

      console.log('\n=============================================================');
      console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
      console.log('=============================================================\n');

      if (failed > 0) {
        process.exitCode = 1;
      }
    } catch (e) {
      console.error('Fatal Test Runner Error:', e);
      process.exitCode = 1;
    } finally {
      server.close();
    }
  });
}

runTests();
