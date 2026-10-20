const mongoose = require('mongoose');

const trafficReadingSchema = new mongoose.Schema({
  cameraId: {
    type: String,
    required: true,
    index: true
  },
  roadId: {
    type: String,
    required: true,
    index: true
  },
  jobId: {
    type: String,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  vehicleCounts: {
    total: { type: Number, default: 0 },
    cars: { type: Number, default: 0 },
    motorcycles: { type: Number, default: 0 },
    buses: { type: Number, default: 0 },
    trucks: { type: Number, default: 0 }
  },
  corridorCounts: {
    total: { type: Number, default: 0 },
    cars: { type: Number, default: 0 },
    motorcycles: { type: Number, default: 0 },
    buses: { type: Number, default: 0 },
    trucks: { type: Number, default: 0 }
  },
  stationaryCount: {
    type: Number,
    default: 0
  },
  activeInRoi: {
    type: Number,
    default: 0
  },
  averageSpeedKmh: {
    type: Number,
    default: 0.0
  },
  trafficFlowVehiclesPerHour: {
    type: Number,
    default: 0.0
  },
  densityLevel: {
    type: String,
    enum: ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'],
    default: 'LOW'
  },
  congestionLevel: {
    type: String,
    enum: ['LOW', 'MODERATE', 'HIGH', 'SEVERE'],
    default: 'LOW'
  },
  directionData: {
    directionA: { type: Number, default: 0 },
    directionB: { type: Number, default: 0 }
  },
  source: {
    type: String,
    default: 'video'
  },
  analysisVersion: {
    type: String,
    default: '1.0.0'
  }
}, { timestamps: true });

// Compound index for time-series queries
trafficReadingSchema.index({ roadId: 1, cameraId: 1, timestamp: -1 });

module.exports = mongoose.model('TrafficReading', trafficReadingSchema);
