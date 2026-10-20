const mongoose = require('mongoose');
const Road = require('../models/Road');
const Camera = require('../models/Camera');
const TrafficReading = require('../models/TrafficReading');
const AnalysisJob = require('../models/AnalysisJob');

// In-Memory Storage Cache for Disconnected Mode
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
    }
  ],
  cameras: [
    {
      cameraId: 'CAM001',
      name: 'Fixed CCTV Junction Cam 01',
      roadId: 'ROAD001',
      sourceType: 'recorded_video',
      sourcePath: 'data/videos/traffic_road_01.mp4',
      resolution: { width: 1280, height: 720 },
      fps: 30,
      status: 'online',
      createdAt: new Date()
    }
  ],
  trafficReadings: [],
  analysisJobs: []
};

const isDbConnected = () => mongoose.connection.readyState === 1;

class DBStore {
  // ROADS
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

  // CAMERAS
  static async getCameras(roadId = null) {
    if (isDbConnected()) {
      const filter = roadId ? { roadId } : {};
      return await Camera.find(filter).sort({ createdAt: -1 });
    }
    if (roadId) {
      return memoryStore.cameras.filter(c => c.roadId === roadId);
    }
    return memoryStore.cameras;
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
    const camera = { ...data, status: data.status || 'online', createdAt: new Date() };
    memoryStore.cameras.unshift(camera);
    return camera;
  }

  // TRAFFIC READINGS
  static async getReadings({ roadId, cameraId, start, end, limit = 100 }) {
    if (isDbConnected()) {
      const filter = {};
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
    if (roadId) list = list.filter(r => r.roadId === roadId);
    if (cameraId) list = list.filter(r => r.cameraId === cameraId);
    return list.slice(-parseInt(limit, 10));
  }

  static async getLatestReading({ roadId, cameraId }) {
    if (isDbConnected()) {
      const filter = {};
      if (roadId) filter.roadId = roadId;
      if (cameraId) filter.cameraId = cameraId;
      return await TrafficReading.findOne(filter).sort({ timestamp: -1 });
    }
    let list = [...memoryStore.trafficReadings];
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

  // ANALYSIS JOBS
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
}

module.exports = DBStore;
