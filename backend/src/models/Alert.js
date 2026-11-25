const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  alertId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'CONGESTION',
      'CAMERA_DISCONNECTED',
      'CAMERA_RECONNECTED',
      'ACCIDENT_DETECTED',
      'EMERGENCY_PRIORITY',
      'GREEN_CORRIDOR_ACTIVE',
      'VIOLATION_CANDIDATE',
      'ROAD_HAZARD_ANIMAL',
      'PEDESTRIAN_SURGE',
      'SYSTEM_FAILURE',
      'AI_FAILURE'
    ],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['INFO', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  junctionId: {
    type: String,
    default: ''
  },
  roadId: {
    type: String,
    default: ''
  },
  cameraId: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['NEW', 'ACKNOWLEDGED', 'RESOLVED'],
    default: 'NEW',
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  acknowledgedBy: {
    type: String,
    default: null
  },
  acknowledgedAt: {
    type: Date,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Alert', alertSchema);
