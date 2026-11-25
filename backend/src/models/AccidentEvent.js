const mongoose = require('mongoose');

const accidentEventSchema = new mongoose.Schema({
  incidentId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  junctionId: {
    type: String,
    required: true,
    index: true
  },
  roadId: {
    type: String,
    required: true,
    index: true
  },
  cameraId: {
    type: String,
    default: ''
  },
  approach: {
    type: String,
    enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'UNKNOWN'],
    default: 'NORTH'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  confidence: {
    type: Number,
    required: true,
    min: 0.0,
    max: 1.0
  },
  severity: {
    type: String,
    enum: ['LOW', 'MODERATE', 'CRITICAL'],
    default: 'CRITICAL'
  },
  collisionType: {
    type: String,
    enum: ['VEHICLE_COLLISION', 'OVERTURNED_TWO_WHEELER', 'SUDDEN_DECELERATION_IMPACT', 'MULTI_VEHICLE_PILEUP'],
    default: 'VEHICLE_COLLISION'
  },
  involvedTrackIds: [{
    type: Number
  }],
  velocitiesAtImpactKmh: [{
    type: Number
  }],
  iouOverlap: {
    type: Number,
    default: 0.0
  },
  evidenceVideoUrl: {
    type: String,
    default: ''
  },
  keyframeImageUrl: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['PENDING_VERIFICATION', 'VERIFIED_DISPATCHED', 'FALSE_POSITIVE', 'RESOLVED'],
    default: 'PENDING_VERIFICATION'
  },
  operatorAction: {
    verifiedBy: { type: String, default: null },
    actionTakenAt: { type: Date, default: null },
    notes: { type: String, default: '' }
  },
  dispatchedOfficers: [{
    officerId: String,
    name: String,
    badgeNumber: String,
    distanceKm: Number,
    etaMinutes: Number,
    notifiedAt: Date,
    status: { type: String, default: 'DISPATCHED' }
  }],
  autoDispatchTriggered: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('AccidentEvent', accidentEventSchema);
