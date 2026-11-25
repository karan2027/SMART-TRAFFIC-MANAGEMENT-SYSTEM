const mongoose = require('mongoose');
const EventEmitter = require('events');

const Road = require('../models/Road');
const Camera = require('../models/Camera');
const TrafficReading = require('../models/TrafficReading');
const AnalysisJob = require('../models/AnalysisJob');
const Junction = require('../models/Junction');
const AccidentEvent = require('../models/AccidentEvent');
const PoliceOfficer = require('../models/PoliceOfficer');
const AnimalHazard = require('../models/AnimalHazard');
const ViolationRecord = require('../models/ViolationRecord');
const ANPRRecord = require('../models/ANPRRecord');
const GreenCorridor = require('../models/GreenCorridor');
const TrafficPrediction = require('../models/TrafficPrediction');
const Alert = require('../models/Alert');
const EnvironmentalTelemetry = require('../models/EnvironmentalTelemetry');

// Global event bus for real-time SSE alerts & telemetry updates
const alertEmitter = new EventEmitter();
alertEmitter.setMaxListeners(50);

// Helper: Haversine distance in km between two GPS coordinates
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180.0;
  const dLon = (lon2 - lon1) * Math.PI / 180.0;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180.0) * Math.cos(lat2 * Math.PI / 180.0) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// In-Memory Storage Cache for Disconnected / Automated Test Mode
const memoryStore = {
  roads: [
    {
      roadId: 'ROAD001',
      name: 'Grand Trunk Express Avenue (Road-001)',
      description: 'Primary 4-lane arterial road fixed-camera monitor',
      lanes: 4,
      direction: 'Two-Way',
      status: 'active',
      createdAt: new Date()
    },
    {
      roadId: 'ROAD_N01',
      name: 'Northbound Arterial Link (Road-N01)',
      description: 'North corridor approach to Grand Cross Junction',
      lanes: 3,
      direction: 'One-Way Inbound',
      status: 'active',
      createdAt: new Date()
    },
    {
      roadId: 'ROAD_S01',
      name: 'Southbound Commercial Corridor (Road-S01)',
      description: 'South corridor approach to Grand Cross Junction',
      lanes: 3,
      direction: 'One-Way Inbound',
      status: 'active',
      createdAt: new Date()
    },
    {
      roadId: 'ROAD_E01',
      name: 'Eastbound Ring Link (Road-E01)',
      description: 'East corridor approach to Grand Cross Junction',
      lanes: 2,
      direction: 'One-Way Inbound',
      status: 'active',
      createdAt: new Date()
    },
    {
      roadId: 'ROAD_W01',
      name: 'Westbound Downtown Link (Road-W01)',
      description: 'West corridor approach to Grand Cross Junction',
      lanes: 2,
      direction: 'One-Way Inbound',
      status: 'active',
      createdAt: new Date()
    },
    // Junction 2 Roads
    {
      roadId: 'ROAD_N02',
      name: 'Metro Hub North Gateway (Road-N02)',
      description: 'North access connecting Ring Road to Metro Hub',
      lanes: 3,
      direction: 'One-Way Inbound',
      status: 'active',
      createdAt: new Date()
    },
    {
      roadId: 'ROAD_S02',
      name: 'Metro Hub South Access (Road-S02)',
      description: 'South commercial link entering Metro Hub',
      lanes: 3,
      direction: 'One-Way Inbound',
      status: 'active',
      createdAt: new Date()
    },
    {
      roadId: 'ROAD_E02',
      name: 'Metro Hub East Flyover (Road-E02)',
      description: 'East flyover feeding inter-city traffic',
      lanes: 2,
      direction: 'One-Way Inbound',
      status: 'active',
      createdAt: new Date()
    },
    {
      roadId: 'ROAD_W02',
      name: 'Metro Hub West Transit (Road-W02)',
      description: 'West bus rapid transit corridor',
      lanes: 2,
      direction: 'One-Way Inbound',
      status: 'active',
      createdAt: new Date()
    }
  ],
  cameras: [
    {
      cameraId: 'CAM001',
      name: 'Fixed CCTV Junction Cam 01',
      roadId: 'ROAD001',
      junctionId: 'JUNC001',
      sourceType: 'recorded_video',
      sourcePath: 'data/videos/traffic_road_01.mp4',
      streamUrl: '',
      isMobileCamera: false,
      resolution: { width: 1280, height: 720 },
      fps: 30,
      status: 'online',
      lastHeartbeat: new Date(),
      createdAt: new Date()
    },
    {
      cameraId: 'CAM_NORTH',
      name: 'North Approach 4K CCTV',
      roadId: 'ROAD_N01',
      junctionId: 'JUNC001',
      sourceType: 'recorded_video',
      sourcePath: 'data/videos/traffic_road_01.mp4',
      streamUrl: '',
      isMobileCamera: false,
      resolution: { width: 1920, height: 1080 },
      fps: 30,
      status: 'online',
      lastHeartbeat: new Date(),
      createdAt: new Date()
    },
    {
      cameraId: 'CAM_SOUTH',
      name: 'South Approach 4K CCTV',
      roadId: 'ROAD_S01',
      junctionId: 'JUNC001',
      sourceType: 'recorded_video',
      sourcePath: 'data/videos/v3.mp4',
      streamUrl: '',
      isMobileCamera: false,
      resolution: { width: 1920, height: 1080 },
      fps: 30,
      status: 'online',
      lastHeartbeat: new Date(),
      createdAt: new Date()
    },
    {
      cameraId: 'CAM_EAST',
      name: 'East Approach 4K CCTV',
      roadId: 'ROAD_E01',
      junctionId: 'JUNC001',
      sourceType: 'recorded_video',
      sourcePath: 'data/videos/tv2.mp4',
      streamUrl: '',
      isMobileCamera: false,
      resolution: { width: 1920, height: 1080 },
      fps: 30,
      status: 'online',
      lastHeartbeat: new Date(),
      createdAt: new Date()
    },
    {
      cameraId: 'CAM_WEST',
      name: 'West Approach 4K CCTV',
      roadId: 'ROAD_W01',
      junctionId: 'JUNC001',
      sourceType: 'recorded_video',
      sourcePath: 'data/videos/v4.mp4',
      streamUrl: '',
      isMobileCamera: false,
      resolution: { width: 1920, height: 1080 },
      fps: 30,
      status: 'online',
      lastHeartbeat: new Date(),
      createdAt: new Date()
    },
    // Mobile Stream Camera Example
    {
      cameraId: 'CAM_MOBILE_01',
      name: 'Android Mobile Field Unit #1 (IP Webcam)',
      roadId: 'ROAD_N01',
      junctionId: 'JUNC001',
      sourceType: 'mobile_stream',
      sourcePath: '',
      streamUrl: 'http://192.168.1.105:8080/video',
      ipAddress: '192.168.1.105',
      port: 8080,
      isMobileCamera: true,
      resolution: { width: 1280, height: 720 },
      fps: 25,
      status: 'online',
      lastHeartbeat: new Date(),
      createdAt: new Date()
    },
    // Junction 2 Cameras
    {
      cameraId: 'CAM_J2_NORTH',
      name: 'Metro Hub North Cam',
      roadId: 'ROAD_N02',
      junctionId: 'JUNC002',
      sourceType: 'recorded_video',
      sourcePath: 'data/videos/traffic_road_01.mp4',
      streamUrl: '',
      isMobileCamera: false,
      resolution: { width: 1920, height: 1080 },
      fps: 30,
      status: 'online',
      lastHeartbeat: new Date(),
      createdAt: new Date()
    },
    {
      cameraId: 'CAM_J2_SOUTH',
      name: 'Metro Hub South Cam',
      roadId: 'ROAD_S02',
      junctionId: 'JUNC002',
      sourceType: 'recorded_video',
      sourcePath: 'data/videos/v3.mp4',
      streamUrl: '',
      isMobileCamera: false,
      resolution: { width: 1920, height: 1080 },
      fps: 30,
      status: 'online',
      lastHeartbeat: new Date(),
      createdAt: new Date()
    }
  ],
  junctions: [
    {
      junctionId: 'JUNC001',
      name: 'Grand Cross Arterial Intersection (Junction-001)',
      description: 'Primary 4-approach urban junction connecting arterial avenues with adaptive signal actuation',
      location: {
        latitude: 28.6139,
        longitude: 77.2090,
        city: 'Metro City',
        zone: 'Sector 4 Central'
      },
      status: 'OPERATIONAL',
      operatingMode: 'ADAPTIVE',
      activeDirection: 'NORTH',
      currentPhaseState: 'GREEN_ACTIVE',
      cycleCount: 0,
      timingParameters: {
        minGreenSeconds: 15,
        maxGreenSeconds: 75,
        yellowClearanceSeconds: 4,
        allRedClearanceSeconds: 2,
        targetCycleSeconds: 120
      },
      emergencyOverride: {
        isActive: false,
        approach: null,
        vehicleType: null,
        triggeredBy: null,
        startedAt: null,
        clearedAt: null
      },
      pedestrianSafety: {
        crosswalkOccupied: false,
        activeCrosswalkApproach: null,
        waitingPedestrians: 0,
        walkPhaseExtended: false,
        extendedSeconds: 0,
        turningConflictSuppressed: false
      },
      cattleHazardMode: {
        isActive: false,
        approach: null,
        hazardType: null,
        mitigation: 'NORMAL_FLOW',
        startedAt: null
      },
      v2xSpat: {
        broadcastActive: true,
        currentSignalPhase: 'NORTH_GREEN',
        secondsRemainingInPhase: 35,
        recommendedGlosaSpeedKmh: 42.0,
        distanceToStopLineMeters: 140.0,
        lastBroadcastTimestamp: new Date()
      },
      approaches: [
        {
          direction: 'NORTH',
          approachId: 'APP_NORTH',
          roadId: 'ROAD_N01',
          cameraId: 'CAM_NORTH',
          streamSource: { type: 'VIDEO_FILE', url: 'data/videos/traffic_road_01.mp4' },
          signalState: 'GREEN',
          allocatedGreenSeconds: 35,
          remainingSeconds: 35,
          queueCount: 4,
          averageSpeedKmh: 32.5,
          densityLevel: 'MODERATE',
          pedestriansWaiting: 2,
          crosswalkOccupied: false
        },
        {
          direction: 'SOUTH',
          approachId: 'APP_SOUTH',
          roadId: 'ROAD_S01',
          cameraId: 'CAM_SOUTH',
          streamSource: { type: 'VIDEO_FILE', url: 'data/videos/v3.mp4' },
          signalState: 'RED',
          allocatedGreenSeconds: 30,
          remainingSeconds: 0,
          queueCount: 8,
          averageSpeedKmh: 18.2,
          densityLevel: 'HIGH',
          pedestriansWaiting: 0,
          crosswalkOccupied: false
        },
        {
          direction: 'EAST',
          approachId: 'APP_EAST',
          roadId: 'ROAD_E01',
          cameraId: 'CAM_EAST',
          streamSource: { type: 'VIDEO_FILE', url: 'data/videos/tv2.mp4' },
          signalState: 'RED',
          allocatedGreenSeconds: 25,
          remainingSeconds: 0,
          queueCount: 3,
          averageSpeedKmh: 28.0,
          densityLevel: 'LOW',
          pedestriansWaiting: 1,
          crosswalkOccupied: false
        },
        {
          direction: 'WEST',
          approachId: 'APP_WEST',
          roadId: 'ROAD_W01',
          cameraId: 'CAM_WEST',
          streamSource: { type: 'VIDEO_FILE', url: 'data/videos/v4.mp4' },
          signalState: 'RED',
          allocatedGreenSeconds: 20,
          remainingSeconds: 0,
          queueCount: 2,
          averageSpeedKmh: 35.1,
          densityLevel: 'LOW',
          pedestriansWaiting: 0,
          crosswalkOccupied: false
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    },
    // Junction 2 (Metro Hub Plaza)
    {
      junctionId: 'JUNC002',
      name: 'Metro Hub Plaza Intersection (Junction-002)',
      description: 'Secondary busy intersection connecting commercial district and transit hub',
      location: {
        latitude: 28.6250,
        longitude: 77.2185,
        city: 'Metro City',
        zone: 'Sector 7 Transit Plaza'
      },
      status: 'OPERATIONAL',
      operatingMode: 'ADAPTIVE',
      activeDirection: 'EAST',
      currentPhaseState: 'GREEN_ACTIVE',
      cycleCount: 0,
      timingParameters: {
        minGreenSeconds: 15,
        maxGreenSeconds: 70,
        yellowClearanceSeconds: 4,
        allRedClearanceSeconds: 2,
        targetCycleSeconds: 110
      },
      emergencyOverride: {
        isActive: false,
        approach: null,
        vehicleType: null,
        triggeredBy: null,
        startedAt: null,
        clearedAt: null
      },
      pedestrianSafety: {
        crosswalkOccupied: false,
        activeCrosswalkApproach: null,
        waitingPedestrians: 0,
        walkPhaseExtended: false,
        extendedSeconds: 0,
        turningConflictSuppressed: false
      },
      cattleHazardMode: {
        isActive: false,
        approach: null,
        hazardType: null,
        mitigation: 'NORMAL_FLOW',
        startedAt: null
      },
      v2xSpat: {
        broadcastActive: true,
        currentSignalPhase: 'EAST_GREEN',
        secondsRemainingInPhase: 28,
        recommendedGlosaSpeedKmh: 45.0,
        distanceToStopLineMeters: 180.0,
        lastBroadcastTimestamp: new Date()
      },
      approaches: [
        {
          direction: 'NORTH',
          approachId: 'APP_J2_NORTH',
          roadId: 'ROAD_N02',
          cameraId: 'CAM_J2_NORTH',
          streamSource: { type: 'VIDEO_FILE', url: 'data/videos/traffic_road_01.mp4' },
          signalState: 'RED',
          allocatedGreenSeconds: 25,
          remainingSeconds: 0,
          queueCount: 5,
          averageSpeedKmh: 24.0,
          densityLevel: 'MODERATE',
          pedestriansWaiting: 3,
          crosswalkOccupied: false
        },
        {
          direction: 'SOUTH',
          approachId: 'APP_J2_SOUTH',
          roadId: 'ROAD_S02',
          cameraId: 'CAM_J2_SOUTH',
          streamSource: { type: 'VIDEO_FILE', url: 'data/videos/v3.mp4' },
          signalState: 'RED',
          allocatedGreenSeconds: 25,
          remainingSeconds: 0,
          queueCount: 4,
          averageSpeedKmh: 26.5,
          densityLevel: 'MODERATE',
          pedestriansWaiting: 0,
          crosswalkOccupied: false
        },
        {
          direction: 'EAST',
          approachId: 'APP_J2_EAST',
          roadId: 'ROAD_E02',
          cameraId: 'CAM_EAST',
          streamSource: { type: 'VIDEO_FILE', url: 'data/videos/tv2.mp4' },
          signalState: 'GREEN',
          allocatedGreenSeconds: 30,
          remainingSeconds: 28,
          queueCount: 6,
          averageSpeedKmh: 31.0,
          densityLevel: 'MODERATE',
          pedestriansWaiting: 1,
          crosswalkOccupied: false
        },
        {
          direction: 'WEST',
          approachId: 'APP_J2_WEST',
          roadId: 'ROAD_W02',
          cameraId: 'CAM_WEST',
          streamSource: { type: 'VIDEO_FILE', url: 'data/videos/v4.mp4' },
          signalState: 'RED',
          allocatedGreenSeconds: 20,
          remainingSeconds: 0,
          queueCount: 2,
          averageSpeedKmh: 38.0,
          densityLevel: 'LOW',
          pedestriansWaiting: 0,
          crosswalkOccupied: false
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ],
  policeOfficers: [
    {
      officerId: 'OFF_001',
      name: 'Inspector Rajesh Kumar',
      badgeNumber: 'DL-TP-4091',
      phone: '+91 98765 43210',
      patrolUnit: 'Interceptor Alpha-1',
      assignedZone: 'Sector 4 Central',
      status: 'ACTIVE',
      location: {
        type: 'Point',
        coordinates: [77.2105, 28.6152] // ~0.2 km from JUNC001
      },
      lastHeartbeat: new Date()
    },
    {
      officerId: 'OFF_002',
      name: 'Sub-Inspector Priya Sharma',
      badgeNumber: 'DL-TP-5122',
      phone: '+91 98111 22334',
      patrolUnit: 'PCR Mobile-7',
      assignedZone: 'Sector 4 Central',
      status: 'ACTIVE',
      location: {
        type: 'Point',
        coordinates: [77.2150, 28.6180] // ~0.8 km from JUNC001
      },
      lastHeartbeat: new Date()
    },
    {
      officerId: 'OFF_003',
      name: 'Head Constable Vikram Singh',
      badgeNumber: 'DL-TP-3874',
      phone: '+91 98222 33445',
      patrolUnit: 'Highway Patrol Bravo',
      assignedZone: 'Outer Ring Corridor',
      status: 'ACTIVE',
      location: {
        type: 'Point',
        coordinates: [77.2250, 28.6280] // ~2.1 km from JUNC001, close to JUNC002
      },
      lastHeartbeat: new Date()
    },
    {
      officerId: 'OFF_004',
      name: 'Assistant Sub-Inspector Amit Patel',
      badgeNumber: 'DL-TP-6201',
      phone: '+91 98333 44556',
      patrolUnit: 'Rapid Response Unit 3',
      assignedZone: 'Far Sector West',
      status: 'ACTIVE',
      location: {
        type: 'Point',
        coordinates: [77.2800, 28.6900] // >8 km away (outside 2.5 km threshold)
      },
      lastHeartbeat: new Date()
    }
  ],
  accidents: [],
  animalHazards: [],
  violations: [],
  anprRecords: [],
  greenCorridors: [],
  predictions: [],
  alerts: [
    {
      alertId: 'ALT_INIT_01',
      type: 'CONGESTION',
      severity: 'HIGH',
      title: 'South Corridor Surge Detected',
      message: 'Approaching Southbound lane has 8 queuing vehicles; average speed dropped to 18 km/h.',
      junctionId: 'JUNC001',
      roadId: 'ROAD_S01',
      cameraId: 'CAM_SOUTH',
      status: 'NEW',
      metadata: { queueCount: 8, avgSpeed: 18.2 },
      timestamp: new Date()
    }
  ],
  environmentalTelemetry: [
    {
      junctionId: 'JUNC001',
      timestamp: new Date(),
      cumulativeIdleTimeReducedSeconds: 14250,
      co2PreventedKg: 11.52,
      fuelSavedLitres: 4.98,
      pm25ReducedGrams: 5.70,
      vehiclesBenefitedCount: 842
    }
  ],
  trafficReadings: [],
  analysisJobs: []
};

const isDbConnected = () => mongoose.connection.readyState === 1;

class DBStore {
  static alertEmitter = alertEmitter;

  // ==========================================
  // ROADS
  // ==========================================
  static async getRoads() {
    if (isDbConnected()) {
      return await Road.find().sort({ createdAt: -1 });
    }
    return memoryStore.roads;
  }

  static async getRoadById(roadId) {
    if (isDbConnected()) {
      return await Road.findOne({ roadId });
    }
    return memoryStore.roads.find(r => r.roadId === roadId) || null;
  }

  static async createRoad(data) {
    if (isDbConnected()) {
      return await Road.create(data);
    }
    const road = { ...data, status: data.status || 'active', createdAt: new Date() };
    memoryStore.roads.unshift(road);
    return road;
  }

  // ==========================================
  // CAMERAS & MOBILE STREAM
  // ==========================================
  static async getCameras(roadId = null, junctionId = null) {
    if (isDbConnected()) {
      const filter = {};
      if (roadId) filter.roadId = roadId;
      if (junctionId) filter.junctionId = junctionId;
      return await Camera.find(filter).sort({ createdAt: -1 });
    }
    let list = [...memoryStore.cameras];
    if (roadId) list = list.filter(c => c.roadId === roadId);
    if (junctionId) list = list.filter(c => c.junctionId === junctionId);
    return list;
  }

  static async getCameraById(cameraId) {
    if (isDbConnected()) {
      return await Camera.findOne({ cameraId });
    }
    return memoryStore.cameras.find(c => c.cameraId === cameraId) || null;
  }

  static async createCamera(data) {
    if (isDbConnected()) {
      return await Camera.create(data);
    }
    const camera = {
      ...data,
      status: data.status || 'online',
      lastHeartbeat: new Date(),
      createdAt: new Date()
    };
    memoryStore.cameras.unshift(camera);
    return camera;
  }

  static async updateCamera(cameraId, updates) {
    if (isDbConnected()) {
      const cam = await Camera.findOne({ cameraId });
      if (cam) {
        Object.assign(cam, updates);
        await cam.save();
        return cam;
      }
      return null;
    }
    const cam = memoryStore.cameras.find(c => c.cameraId === cameraId);
    if (cam) {
      Object.assign(cam, updates, { updatedAt: new Date() });
      return cam;
    }
    return null;
  }

  static async deleteCamera(cameraId) {
    if (isDbConnected()) {
      const res = await Camera.deleteOne({ cameraId });
      return res.deletedCount > 0;
    }
    const idx = memoryStore.cameras.findIndex(c => c.cameraId === cameraId);
    if (idx !== -1) {
      memoryStore.cameras.splice(idx, 1);
      return true;
    }
    return false;
  }

  // ==========================================
  // TRAFFIC READINGS & ANALYSIS JOBS
  // ==========================================
  static async getReadings({ roadId, cameraId, jobId, start, end, limit = 100 }) {
    if (isDbConnected()) {
      const filter = {};
      if (jobId) filter.jobId = jobId;
      if (roadId) filter.roadId = roadId;
      if (cameraId) filter.cameraId = cameraId;
      if (start || end) {
        filter.timestamp = {};
        if (start) filter.timestamp.$gte = new Date(start);
        if (end) filter.timestamp.$lte = new Date(end);
      }
      const docs = await TrafficReading.find(filter).sort({ timestamp: -1 }).limit(parseInt(limit, 10));
      return docs.reverse();
    }
    let list = [...memoryStore.trafficReadings];
    if (jobId) list = list.filter(r => r.jobId === jobId);
    if (roadId) list = list.filter(r => r.roadId === roadId);
    if (cameraId) list = list.filter(r => r.cameraId === cameraId);
    return list.slice(-parseInt(limit, 10));
  }

  static async getLatestReading({ roadId, cameraId, jobId }) {
    if (isDbConnected()) {
      const filter = {};
      if (jobId) filter.jobId = jobId;
      if (roadId) filter.roadId = roadId;
      if (cameraId) filter.cameraId = cameraId;
      return await TrafficReading.findOne(filter).sort({ timestamp: -1 });
    }
    let list = [...memoryStore.trafficReadings];
    if (jobId) list = list.filter(r => r.jobId === jobId);
    if (roadId) list = list.filter(r => r.roadId === roadId);
    if (cameraId) list = list.filter(r => r.cameraId === cameraId);
    return list.length > 0 ? list[list.length - 1] : null;
  }

  static async insertReadings(readings) {
    if (!readings || readings.length === 0) return [];
    if (isDbConnected()) {
      return await TrafficReading.insertMany(readings);
    }
    memoryStore.trafficReadings.push(...readings);
    return readings;
  }

  static async getJobs() {
    if (isDbConnected()) {
      return await AnalysisJob.find().sort({ createdAt: -1 });
    }
    return memoryStore.analysisJobs;
  }

  static async getJobById(jobId) {
    if (isDbConnected()) {
      return await AnalysisJob.findOne({ jobId });
    }
    return memoryStore.analysisJobs.find(j => j.jobId === jobId) || null;
  }

  static async getLatestCompletedJob({ roadId, cameraId, jobId } = {}) {
    if (isDbConnected()) {
      const filter = { status: 'completed' };
      if (jobId) filter.jobId = jobId;
      if (roadId) filter.roadId = roadId;
      if (cameraId) filter.cameraId = cameraId;
      return await AnalysisJob.findOne(filter).sort({ completedAt: -1, createdAt: -1 });
    }
    let list = memoryStore.analysisJobs.filter(j => j.status === 'completed');
    if (jobId) list = list.filter(j => j.jobId === jobId);
    if (roadId) list = list.filter(j => j.roadId === roadId);
    if (cameraId) list = list.filter(j => j.cameraId === cameraId);
    return list.length > 0 ? list[0] : null;
  }

  static async createJob(data) {
    if (isDbConnected()) {
      return await AnalysisJob.create(data);
    }
    const job = { ...data, progress: 0, status: 'processing', createdAt: new Date() };
    memoryStore.analysisJobs.unshift(job);
    return job;
  }

  static async updateJob(jobId, updates) {
    if (isDbConnected()) {
      const job = await AnalysisJob.findOne({ jobId });
      if (job) {
        Object.assign(job, updates);
        await job.save();
        return job;
      }
      return null;
    }
    const job = memoryStore.analysisJobs.find(j => j.jobId === jobId);
    if (job) {
      Object.assign(job, updates);
    }
    return job;
  }

  // ==========================================
  // JUNCTIONS & ADAPTIVE SIGNAL CONTROL
  // ==========================================
  static async getJunctions() {
    if (isDbConnected()) {
      return await Junction.find().sort({ createdAt: -1 });
    }
    return memoryStore.junctions;
  }

  static async getJunctionById(junctionId) {
    const formattedId = junctionId ? junctionId.toUpperCase() : '';
    if (isDbConnected()) {
      return await Junction.findOne({ junctionId: formattedId });
    }
    return memoryStore.junctions.find(j => j.junctionId === formattedId) || null;
  }

  static async createJunction(data) {
    const formattedData = {
      ...data,
      junctionId: data.junctionId ? data.junctionId.toUpperCase() : `JUNC_${Date.now()}`
    };

    if (isDbConnected()) {
      return await Junction.create(formattedData);
    }

    const junction = {
      ...formattedData,
      status: formattedData.status || 'OPERATIONAL',
      operatingMode: formattedData.operatingMode || 'ADAPTIVE',
      activeDirection: formattedData.activeDirection || 'NORTH',
      currentPhaseState: formattedData.currentPhaseState || 'GREEN_ACTIVE',
      cycleCount: formattedData.cycleCount || 0,
      emergencyOverride: formattedData.emergencyOverride || {
        isActive: false,
        approach: null,
        vehicleType: null,
        triggeredBy: null,
        startedAt: null,
        clearedAt: null
      },
      pedestrianSafety: formattedData.pedestrianSafety || {
        crosswalkOccupied: false,
        activeCrosswalkApproach: null,
        waitingPedestrians: 0,
        walkPhaseExtended: false,
        extendedSeconds: 0,
        turningConflictSuppressed: false
      },
      cattleHazardMode: formattedData.cattleHazardMode || {
        isActive: false,
        approach: null,
        hazardType: null,
        mitigation: 'NORMAL_FLOW',
        startedAt: null
      },
      v2xSpat: formattedData.v2xSpat || {
        broadcastActive: true,
        currentSignalPhase: `${formattedData.activeDirection || 'NORTH'}_GREEN`,
        secondsRemainingInPhase: 30,
        recommendedGlosaSpeedKmh: 40.0,
        distanceToStopLineMeters: 150.0,
        lastBroadcastTimestamp: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    memoryStore.junctions.unshift(junction);
    return junction;
  }

  static async updateJunction(junctionId, updates) {
    const formattedId = junctionId ? junctionId.toUpperCase() : '';
    if (isDbConnected()) {
      const junction = await Junction.findOne({ junctionId: formattedId });
      if (junction) {
        Object.assign(junction, updates);
        await junction.save();
        return junction;
      }
      return null;
    }
    const junction = memoryStore.junctions.find(j => j.junctionId === formattedId);
    if (junction) {
      Object.assign(junction, updates, { updatedAt: new Date() });
      return junction;
    }
    return null;
  }

  static async updateSignalPhase(junctionId, {
    activeDirection,
    phaseState = 'GREEN_ACTIVE',
    signalStates = null,
    remainingSeconds = null,
    allocatedGreenSeconds = null
  }) {
    const formattedId = junctionId ? junctionId.toUpperCase() : '';
    const dir = activeDirection ? activeDirection.toUpperCase() : 'NORTH';

    const updateApproachList = (approaches) => {
      return approaches.map(app => {
        const isTarget = app.direction === dir;
        let newState = 'RED';

        if (signalStates && signalStates[app.direction]) {
          newState = signalStates[app.direction];
        } else {
          if (phaseState === 'GREEN_ACTIVE') {
            newState = isTarget ? 'GREEN' : 'RED';
          } else if (phaseState === 'YELLOW_CLEARANCE' || phaseState === 'EMERGENCY_YELLOW_CLEARANCE') {
            newState = isTarget ? 'YELLOW' : 'RED';
          } else if (phaseState === 'ALL_RED_CLEARANCE' || phaseState === 'EMERGENCY_ALL_RED' || phaseState === 'HAZARD_ALL_RED_PAUSE') {
            newState = 'RED';
          } else if (phaseState === 'HAZARD_FLASHING_AMBER') {
            newState = isTarget ? 'FLASHING_AMBER' : 'RED';
          }
        }

        const appObj = app.toObject ? app.toObject() : { ...app };
        appObj.signalState = newState;

        if (isTarget) {
          if (typeof remainingSeconds === 'number') {
            appObj.remainingSeconds = remainingSeconds;
          }
          if (typeof allocatedGreenSeconds === 'number') {
            appObj.allocatedGreenSeconds = allocatedGreenSeconds;
          }
        } else {
          appObj.remainingSeconds = 0;
        }

        return appObj;
      });
    };

    if (isDbConnected()) {
      const junction = await Junction.findOne({ junctionId: formattedId });
      if (!junction) return null;

      junction.activeDirection = dir;
      junction.currentPhaseState = phaseState;
      junction.approaches = updateApproachList(junction.approaches);

      // Update SPaT packet
      junction.v2xSpat = {
        broadcastActive: true,
        currentSignalPhase: `${dir}_${phaseState}`,
        secondsRemainingInPhase: remainingSeconds || 30,
        recommendedGlosaSpeedKmh: 42.0,
        distanceToStopLineMeters: 140.0,
        lastBroadcastTimestamp: new Date()
      };

      await junction.save();
      return junction;
    }

    const junction = memoryStore.junctions.find(j => j.junctionId === formattedId);
    if (!junction) return null;

    junction.activeDirection = dir;
    junction.currentPhaseState = phaseState;
    junction.approaches = updateApproachList(junction.approaches);
    junction.v2xSpat = {
      broadcastActive: true,
      currentSignalPhase: `${dir}_${phaseState}`,
      secondsRemainingInPhase: remainingSeconds || 30,
      recommendedGlosaSpeedKmh: 42.0,
      distanceToStopLineMeters: 140.0,
      lastBroadcastTimestamp: new Date()
    };
    junction.updatedAt = new Date();

    return junction;
  }

  static async setEmergencyOverride(junctionId, { approach, vehicleType = 'AMBULANCE', triggeredBy = 'AI_DETECTION' }) {
    const formattedId = junctionId ? junctionId.toUpperCase() : '';
    const dir = approach ? approach.toUpperCase() : 'NORTH';

    const updateApproaches = (approaches) => {
      return approaches.map(app => {
        const appObj = app.toObject ? app.toObject() : { ...app };
        if (app.direction === dir) {
          appObj.signalState = 'GREEN';
          appObj.remainingSeconds = 60;
        } else {
          appObj.signalState = 'RED';
          appObj.remainingSeconds = 0;
        }
        return appObj;
      });
    };

    const overridePayload = {
      isActive: true,
      approach: dir,
      vehicleType,
      triggeredBy,
      startedAt: new Date(),
      clearedAt: null
    };

    if (isDbConnected()) {
      const junction = await Junction.findOne({ junctionId: formattedId });
      if (!junction) return null;

      junction.operatingMode = 'EMERGENCY_OVERRIDE';
      junction.activeDirection = dir;
      junction.currentPhaseState = 'GREEN_ACTIVE';
      junction.emergencyOverride = overridePayload;
      junction.approaches = updateApproaches(junction.approaches);

      await junction.save();
      return junction;
    }

    const junction = memoryStore.junctions.find(j => j.junctionId === formattedId);
    if (!junction) return null;

    junction.operatingMode = 'EMERGENCY_OVERRIDE';
    junction.activeDirection = dir;
    junction.currentPhaseState = 'GREEN_ACTIVE';
    junction.emergencyOverride = overridePayload;
    junction.approaches = updateApproaches(junction.approaches);
    junction.updatedAt = new Date();

    return junction;
  }

  static async clearEmergencyOverride(junctionId) {
    const formattedId = junctionId ? junctionId.toUpperCase() : '';
    const clearPayload = {
      isActive: false,
      approach: null,
      vehicleType: null,
      triggeredBy: null,
      clearedAt: new Date()
    };

    if (isDbConnected()) {
      const junction = await Junction.findOne({ junctionId: formattedId });
      if (!junction) return null;

      junction.operatingMode = 'ADAPTIVE';
      if (junction.emergencyOverride) {
        Object.assign(junction.emergencyOverride, clearPayload);
      }
      await junction.save();
      return junction;
    }

    const junction = memoryStore.junctions.find(j => j.junctionId === formattedId);
    if (!junction) return null;

    junction.operatingMode = 'ADAPTIVE';
    junction.emergencyOverride = {
      ...junction.emergencyOverride,
      ...clearPayload
    };
    junction.updatedAt = new Date();

    return junction;
  }

  // ==========================================
  // STAGE 3: ACCIDENTS & POLICE GEOSPATIAL DISPATCH
  // ==========================================
  static async getAccidents({ junctionId, status, limit = 50 } = {}) {
    if (isDbConnected()) {
      const filter = {};
      if (junctionId) filter.junctionId = junctionId.toUpperCase();
      if (status) filter.status = status;
      return await AccidentEvent.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit, 10));
    }
    let list = [...memoryStore.accidents];
    if (junctionId) list = list.filter(a => a.junctionId === junctionId.toUpperCase());
    if (status) list = list.filter(a => a.status === status);
    return list.slice(0, parseInt(limit, 10));
  }

  static async getAccidentById(incidentId) {
    if (isDbConnected()) {
      return await AccidentEvent.findOne({ incidentId });
    }
    return memoryStore.accidents.find(a => a.incidentId === incidentId) || null;
  }

  static async createAccident(data) {
    const incidentId = data.incidentId || `INC_${Date.now()}`;
    const payload = {
      ...data,
      incidentId,
      status: data.status || 'PENDING_VERIFICATION',
      timestamp: data.timestamp || new Date(),
      createdAt: new Date()
    };

    if (isDbConnected()) {
      const doc = await AccidentEvent.create(payload);
      // Emit real-time alert
      DBStore.createAlert({
        type: 'ACCIDENT_DETECTED',
        severity: 'CRITICAL',
        title: `🚨 Severe Accident Detected at ${data.junctionId}`,
        message: `Collision detected on approach ${data.approach || 'NORTH'} with confidence ${(data.confidence * 100).toFixed(1)}%. Immediate control room verification required.`,
        junctionId: data.junctionId,
        roadId: data.roadId,
        metadata: { incidentId, evidenceVideoUrl: data.evidenceVideoUrl }
      });
      return doc;
    }

    memoryStore.accidents.unshift(payload);
    DBStore.createAlert({
      type: 'ACCIDENT_DETECTED',
      severity: 'CRITICAL',
      title: `🚨 Severe Accident Detected at ${data.junctionId}`,
      message: `Collision detected on approach ${data.approach || 'NORTH'} with confidence ${(data.confidence * 100).toFixed(1)}%. Immediate control room verification required.`,
      junctionId: data.junctionId,
      roadId: data.roadId,
      metadata: { incidentId, evidenceVideoUrl: data.evidenceVideoUrl }
    });
    return payload;
  }

  static async getOfficersNearLocation(lon, lat, radiusKm = 2.5) {
    if (isDbConnected()) {
      try {
        const radiusMeters = radiusKm * 1000;
        const docs = await PoliceOfficer.find({
          status: 'ACTIVE',
          location: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [parseFloat(lon), parseFloat(lat)]
              },
              $maxDistance: radiusMeters
            }
          }
        });
        return docs.map(doc => {
          const coords = doc.location.coordinates;
          const dist = calculateHaversineKm(lat, lon, coords[1], coords[0]);
          return {
            ...doc.toObject(),
            distanceKm: parseFloat(dist.toFixed(2)),
            etaMinutes: Math.max(1, Math.round(dist * 3.5))
          };
        });
      } catch (err) {
        console.warn('[DBStore] $near query fallback to in-memory filter:', err.message);
      }
    }

    // In-Memory Haversine fallback for active officers within radiusKm
    const activeOfficers = memoryStore.policeOfficers.filter(o => o.status === 'ACTIVE');
    const withinRadius = [];

    for (const off of activeOfficers) {
      const [oLon, oLat] = off.location.coordinates;
      const dist = calculateHaversineKm(lat, lon, oLat, oLon);
      if (dist <= radiusKm) {
        withinRadius.push({
          ...off,
          distanceKm: parseFloat(dist.toFixed(2)),
          etaMinutes: Math.max(1, Math.round(dist * 3.5))
        });
      }
    }

    return withinRadius.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  static async verifyAccidentAndDispatch(incidentId, { verifiedBy = 'Operator', notes = '', autoDispatch = false } = {}) {
    const accident = await DBStore.getAccidentById(incidentId);
    if (!accident) return null;

    // Lookup junction GPS coordinates for dispatch
    const junction = await DBStore.getJunctionById(accident.junctionId) || memoryStore.junctions[0];
    const jLat = junction.location?.latitude || 28.6139;
    const jLon = junction.location?.longitude || 77.2090;

    const nearbyOfficers = await DBStore.getOfficersNearLocation(jLon, jLat, 2.5);

    const dispatchedList = nearbyOfficers.map(off => ({
      officerId: off.officerId,
      name: off.name,
      badgeNumber: off.badgeNumber,
      distanceKm: off.distanceKm,
      etaMinutes: off.etaMinutes,
      notifiedAt: new Date(),
      status: 'DISPATCHED'
    }));

    const updates = {
      status: 'VERIFIED_DISPATCHED',
      autoDispatchTriggered: autoDispatch,
      operatorAction: {
        verifiedBy,
        actionTakenAt: new Date(),
        notes: notes || (autoDispatch ? 'Auto-dispatched via 30s timeout safety fallback' : 'Verified by human control operator')
      },
      dispatchedOfficers: dispatchedList
    };

    if (isDbConnected()) {
      const doc = await AccidentEvent.findOne({ incidentId });
      if (doc) {
        Object.assign(doc, updates);
        await doc.save();
        return doc;
      }
    }

    Object.assign(accident, updates);
    return accident;
  }

  static async markAccidentFalsePositive(incidentId, { operator = 'Operator', reason = 'Normal queuing/shadow' } = {}) {
    const accident = await DBStore.getAccidentById(incidentId);
    if (!accident) return null;

    const updates = {
      status: 'FALSE_POSITIVE',
      operatorAction: {
        verifiedBy: operator,
        actionTakenAt: new Date(),
        notes: reason
      }
    };

    if (isDbConnected()) {
      const doc = await AccidentEvent.findOne({ incidentId });
      if (doc) {
        Object.assign(doc, updates);
        await doc.save();
        return doc;
      }
    }

    Object.assign(accident, updates);
    return accident;
  }

  // ==========================================
  // STAGE 3: STRAY ANIMAL & CATTLE HAZARD
  // ==========================================
  static async getAnimalHazards({ junctionId, status = 'ACTIVE' } = {}) {
    if (isDbConnected()) {
      const filter = {};
      if (junctionId) filter.junctionId = junctionId.toUpperCase();
      if (status) filter.status = status;
      return await AnimalHazard.find(filter).sort({ createdAt: -1 });
    }
    let list = [...memoryStore.animalHazards];
    if (junctionId) list = list.filter(h => h.junctionId === junctionId.toUpperCase());
    if (status) list = list.filter(h => h.status === status);
    return list;
  }

  static async createAnimalHazard(data) {
    const hazardId = data.hazardId || `HAZ_${Date.now()}`;
    const payload = {
      ...data,
      hazardId,
      status: data.status || 'ACTIVE',
      detectedAt: new Date(),
      createdAt: new Date()
    };

    if (isDbConnected()) {
      const doc = await AnimalHazard.create(payload);
      DBStore.createAlert({
        type: 'ROAD_HAZARD_ANIMAL',
        severity: 'HIGH',
        title: `🐄 Stray ${data.animalClass || 'Cattle'} Obstruction on ${data.junctionId}`,
        message: `${data.animalClass} detected on approach ${data.approach} (${data.hazardState}). Mitigation: ${data.signalMitigation}.`,
        junctionId: data.junctionId,
        roadId: data.roadId
      });
      return doc;
    }

    memoryStore.animalHazards.unshift(payload);
    DBStore.createAlert({
      type: 'ROAD_HAZARD_ANIMAL',
      severity: 'HIGH',
      title: `🐄 Stray ${data.animalClass || 'Cattle'} Obstruction on ${data.junctionId}`,
      message: `${data.animalClass} detected on approach ${data.approach} (${data.hazardState}). Mitigation: ${data.signalMitigation}.`,
      junctionId: data.junctionId,
      roadId: data.roadId
    });
    return payload;
  }

  static async resolveAnimalHazard(hazardId, municipalSquadNotes = 'Cattle cleared by squad') {
    if (isDbConnected()) {
      const doc = await AnimalHazard.findOne({ hazardId });
      if (doc) {
        doc.status = 'RESOLVED';
        doc.clearedAt = new Date();
        doc.municipalSquadNotes = municipalSquadNotes;
        await doc.save();
        return doc;
      }
      return null;
    }
    const h = memoryStore.animalHazards.find(x => x.hazardId === hazardId);
    if (h) {
      h.status = 'RESOLVED';
      h.clearedAt = new Date();
      h.municipalSquadNotes = municipalSquadNotes;
      return h;
    }
    return null;
  }

  // ==========================================
  // STAGE 3: PEDESTRIAN SAFETY & CROSSWALKS
  // ==========================================
  static async updatePedestrianSafety(junctionId, {
    approach = 'NORTH',
    crosswalkOccupied = false,
    waitingPedestrians = 0,
    extendSeconds = 0,
    turningConflictSuppressed = false
  }) {
    const formattedId = junctionId ? junctionId.toUpperCase() : '';
    const payload = {
      crosswalkOccupied,
      activeCrosswalkApproach: crosswalkOccupied ? approach : null,
      waitingPedestrians,
      walkPhaseExtended: extendSeconds > 0,
      extendedSeconds: extendSeconds,
      turningConflictSuppressed
    };

    if (isDbConnected()) {
      const junction = await Junction.findOne({ junctionId: formattedId });
      if (junction) {
        junction.pedestrianSafety = payload;
        await junction.save();
        return junction;
      }
      return null;
    }

    const junction = memoryStore.junctions.find(j => j.junctionId === formattedId);
    if (junction) {
      junction.pedestrianSafety = payload;
      junction.updatedAt = new Date();
      return junction;
    }
    return null;
  }

  // ==========================================
  // STAGE 3: ANPR & VIOLATIONS & E-CHALLAN
  // ==========================================
  static validateIndianPlate(plateText) {
    if (!plateText || typeof plateText !== 'string') return false;
    // Standard Indian plate regex e.g. DL01CA1234, MH12AB9876, KA05MB4321
    const clean = plateText.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const indianPlateRegex = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;
    return indianPlateRegex.test(clean);
  }

  static async getANPRRecords({ plateNumber, limit = 50 } = {}) {
    if (isDbConnected()) {
      const filter = {};
      if (plateNumber) filter.plateText = new RegExp(plateNumber, 'i');
      return await ANPRRecord.find(filter).sort({ timestamp: -1 }).limit(parseInt(limit, 10));
    }
    let list = [...memoryStore.anprRecords];
    if (plateNumber) {
      list = list.filter(r => r.plateText.includes(plateNumber.toUpperCase()));
    }
    return list.slice(0, parseInt(limit, 10));
  }

  static async createANPRRecord(data) {
    const recordId = data.recordId || `ANPR_${Date.now()}`;
    const cleanPlate = (data.plateText || 'UNKNOWN').toUpperCase();
    const isValid = DBStore.validateIndianPlate(cleanPlate);

    const payload = {
      ...data,
      recordId,
      plateText: cleanPlate,
      isFormatValid: isValid,
      timestamp: data.timestamp || new Date(),
      createdAt: new Date()
    };

    if (isDbConnected()) {
      return await ANPRRecord.create(payload);
    }
    memoryStore.anprRecords.unshift(payload);
    return payload;
  }

  static async getViolations({ junctionId, violationType, reviewStatus, limit = 50 } = {}) {
    if (isDbConnected()) {
      const filter = {};
      if (junctionId) filter.junctionId = junctionId.toUpperCase();
      if (violationType) filter.violationType = violationType;
      if (reviewStatus) filter.reviewStatus = reviewStatus;
      return await ViolationRecord.find(filter).sort({ timestamp: -1 }).limit(parseInt(limit, 10));
    }
    let list = [...memoryStore.violations];
    if (junctionId) list = list.filter(v => v.junctionId === junctionId.toUpperCase());
    if (violationType) list = list.filter(v => v.violationType === violationType);
    if (reviewStatus) list = list.filter(v => v.reviewStatus === reviewStatus);
    return list.slice(0, parseInt(limit, 10));
  }

  static async createViolation(data) {
    const violationId = data.violationId || `VIOL_${Date.now()}`;
    const eChallanNumber = `ECH-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const payload = {
      ...data,
      violationId,
      eChallanNumber,
      reviewStatus: data.reviewStatus || 'PENDING',
      timestamp: data.timestamp || new Date(),
      createdAt: new Date()
    };

    if (isDbConnected()) {
      const doc = await ViolationRecord.create(payload);
      DBStore.createAlert({
        type: 'VIOLATION_CANDIDATE',
        severity: 'MEDIUM',
        title: `🚦 Traffic Violation: ${data.violationType}`,
        message: `Plate: ${data.plateNumber || 'UNKNOWN'} at ${data.junctionId} (${data.approach}). E-Challan #${eChallanNumber} queued.`,
        junctionId: data.junctionId,
        roadId: data.roadId
      });
      return doc;
    }

    memoryStore.violations.unshift(payload);
    DBStore.createAlert({
      type: 'VIOLATION_CANDIDATE',
      severity: 'MEDIUM',
      title: `🚦 Traffic Violation: ${data.violationType}`,
      message: `Plate: ${data.plateNumber || 'UNKNOWN'} at ${data.junctionId} (${data.approach}). E-Challan #${eChallanNumber} queued.`,
      junctionId: data.junctionId,
      roadId: data.roadId
    });
    return payload;
  }

  static async updateViolationReview(violationId, { reviewStatus, reviewedBy = 'Traffic Officer', notes = '' }) {
    if (isDbConnected()) {
      const doc = await ViolationRecord.findOne({ violationId });
      if (doc) {
        doc.reviewStatus = reviewStatus;
        doc.reviewedBy = reviewedBy;
        doc.reviewedAt = new Date();
        doc.notes = notes;
        await doc.save();
        return doc;
      }
      return null;
    }
    const v = memoryStore.violations.find(x => x.violationId === violationId);
    if (v) {
      v.reviewStatus = reviewStatus;
      v.reviewedBy = reviewedBy;
      v.reviewedAt = new Date();
      v.notes = notes;
      return v;
    }
    return null;
  }

  // ==========================================
  // STAGE 3: GREEN CORRIDOR MANAGEMENT
  // ==========================================
  static async getCorridors({ status } = {}) {
    if (isDbConnected()) {
      const filter = status ? { status } : {};
      return await GreenCorridor.find(filter).sort({ createdAt: -1 });
    }
    if (status) {
      return memoryStore.greenCorridors.filter(c => c.status === status);
    }
    return memoryStore.greenCorridors;
  }

  static async getCorridorById(corridorId) {
    if (isDbConnected()) {
      return await GreenCorridor.findOne({ corridorId });
    }
    return memoryStore.greenCorridors.find(c => c.corridorId === corridorId) || null;
  }

  static async createCorridor(data) {
    const corridorId = data.corridorId || `GC_${Date.now()}`;
    const payload = {
      ...data,
      corridorId,
      status: 'ACTIVE',
      currentJunctionIndex: 0,
      startedAt: new Date(),
      createdAt: new Date()
    };

    if (isDbConnected()) {
      const doc = await GreenCorridor.create(payload);
      DBStore.createAlert({
        type: 'GREEN_CORRIDOR_ACTIVE',
        severity: 'CRITICAL',
        title: `🚑 Green Wave Corridor Activated`,
        message: `Route: ${payload.startJunctionId} -> ${payload.destinationJunctionId} for ${payload.emergencyType}. Coordinated signal pre-emption enabled.`,
        junctionId: payload.startJunctionId
      });
      return doc;
    }

    memoryStore.greenCorridors.unshift(payload);
    DBStore.createAlert({
      type: 'GREEN_CORRIDOR_ACTIVE',
      severity: 'CRITICAL',
      title: `🚑 Green Wave Corridor Activated`,
      message: `Route: ${payload.startJunctionId} -> ${payload.destinationJunctionId} for ${payload.emergencyType}. Coordinated signal pre-emption enabled.`,
      junctionId: payload.startJunctionId
    });
    return payload;
  }

  static async advanceCorridor(corridorId) {
    const corridor = await DBStore.getCorridorById(corridorId);
    if (!corridor) return null;

    const nextIndex = corridor.currentJunctionIndex + 1;
    const isCompleted = nextIndex >= corridor.routeJunctions.length;

    const updates = {
      currentJunctionIndex: nextIndex,
      status: isCompleted ? 'COMPLETED' : 'ACTIVE',
      completedAt: isCompleted ? new Date() : null
    };

    if (isDbConnected()) {
      const doc = await GreenCorridor.findOne({ corridorId });
      if (doc) {
        Object.assign(doc, updates);
        await doc.save();
        return doc;
      }
    }

    Object.assign(corridor, updates);
    return corridor;
  }

  // ==========================================
  // TRAFFIC PREDICTION & AI TELEMETRY
  // ==========================================
  static async getPredictions({ junctionId, horizonMinutes } = {}) {
    if (isDbConnected()) {
      const filter = {};
      if (junctionId) filter.junctionId = junctionId.toUpperCase();
      if (horizonMinutes) filter.horizonMinutes = parseInt(horizonMinutes, 10);
      return await TrafficPrediction.find(filter).sort({ timestamp: -1 }).limit(30);
    }
    let list = [...memoryStore.predictions];
    if (junctionId) list = list.filter(p => p.junctionId === junctionId.toUpperCase());
    if (horizonMinutes) list = list.filter(p => p.horizonMinutes === parseInt(horizonMinutes, 10));
    return list;
  }

  static async createPrediction(data) {
    const predictionId = data.predictionId || `PRED_${Date.now()}`;
    const payload = {
      ...data,
      predictionId,
      timestamp: new Date(),
      createdAt: new Date()
    };

    if (isDbConnected()) {
      return await TrafficPrediction.create(payload);
    }
    memoryStore.predictions.unshift(payload);
    return payload;
  }

  // ==========================================
  // LIVE ALERTS & NOTIFICATIONS
  // ==========================================
  static async getAlerts({ status, severity, limit = 50 } = {}) {
    if (isDbConnected()) {
      const filter = {};
      if (status) filter.status = status;
      if (severity) filter.severity = severity;
      return await Alert.find(filter).sort({ timestamp: -1 }).limit(parseInt(limit, 10));
    }
    let list = [...memoryStore.alerts];
    if (status) list = list.filter(a => a.status === status);
    if (severity) list = list.filter(a => a.severity === severity);
    return list.slice(0, parseInt(limit, 10));
  }

  static async createAlert(data) {
    const alertId = data.alertId || `ALT_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const payload = {
      ...data,
      alertId,
      status: 'NEW',
      timestamp: new Date(),
      createdAt: new Date()
    };

    if (isDbConnected()) {
      const doc = await Alert.create(payload);
      alertEmitter.emit('alert', doc);
      return doc;
    }

    memoryStore.alerts.unshift(payload);
    alertEmitter.emit('alert', payload);
    return payload;
  }

  static async acknowledgeAlert(alertId, acknowledgedBy = 'Operator') {
    const updates = {
      status: 'ACKNOWLEDGED',
      acknowledgedBy,
      acknowledgedAt: new Date()
    };

    if (isDbConnected()) {
      const doc = await Alert.findOne({ alertId });
      if (doc) {
        Object.assign(doc, updates);
        await doc.save();
        return doc;
      }
      return null;
    }

    const alt = memoryStore.alerts.find(a => a.alertId === alertId);
    if (alt) {
      Object.assign(alt, updates);
      return alt;
    }
    return null;
  }

  static async resolveAlert(alertId) {
    const updates = {
      status: 'RESOLVED',
      resolvedAt: new Date()
    };

    if (isDbConnected()) {
      const doc = await Alert.findOne({ alertId });
      if (doc) {
        Object.assign(doc, updates);
        await doc.save();
        return doc;
      }
      return null;
    }

    const alt = memoryStore.alerts.find(a => a.alertId === alertId);
    if (alt) {
      Object.assign(alt, updates);
      return alt;
    }
    return null;
  }

  // ==========================================
  // ENVIRONMENTAL TELEMETRY & CARBON SAVINGS
  // ==========================================
  static async getEnvironmentalTelemetry(junctionId = 'JUNC001') {
    if (isDbConnected()) {
      return await EnvironmentalTelemetry.find({ junctionId }).sort({ timestamp: -1 }).limit(10);
    }
    return memoryStore.environmentalTelemetry.filter(e => e.junctionId === junctionId);
  }

  static async recordEnvironmentalTelemetry(data) {
    if (isDbConnected()) {
      return await EnvironmentalTelemetry.create(data);
    }
    const item = { ...data, timestamp: new Date() };
    memoryStore.environmentalTelemetry.unshift(item);
    return item;
  }
}

module.exports = DBStore;
