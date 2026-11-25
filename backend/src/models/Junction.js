const mongoose = require('mongoose');

const approachSchema = new mongoose.Schema({
  direction: {
    type: String,
    enum: ['NORTH', 'SOUTH', 'EAST', 'WEST'],
    required: true
  },
  approachId: {
    type: String,
    required: true,
    trim: true
  },
  roadId: {
    type: String,
    required: true,
    trim: true
  },
  cameraId: {
    type: String,
    required: true,
    trim: true
  },
  streamSource: {
    type: {
      type: String,
      enum: ['RTSP', 'VIDEO_FILE', 'HLS', 'MOBILE_STREAM', 'IP_WEBCAM'],
      default: 'VIDEO_FILE'
    },
    url: {
      type: String,
      default: ''
    }
  },
  signalState: {
    type: String,
    enum: ['RED', 'YELLOW', 'GREEN', 'FLASHING_AMBER'],
    required: true,
    default: 'RED'
  },
  allocatedGreenSeconds: {
    type: Number,
    default: 30,
    min: 5,
    max: 180
  },
  remainingSeconds: {
    type: Number,
    default: 0
  },
  queueCount: {
    type: Number,
    default: 0,
    min: 0
  },
  averageSpeedKmh: {
    type: Number,
    default: 0.0,
    min: 0
  },
  densityLevel: {
    type: String,
    enum: ['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'],
    default: 'LOW'
  },
  pedestriansWaiting: {
    type: Number,
    default: 0
  },
  crosswalkOccupied: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const junctionSchema = new mongoose.Schema({
  junctionId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    city: { type: String, default: '' },
    zone: { type: String, default: '' }
  },
  status: {
    type: String,
    enum: ['OPERATIONAL', 'DEGRADED', 'MAINTENANCE', 'OFFLINE'],
    default: 'OPERATIONAL'
  },
  operatingMode: {
    type: String,
    enum: ['ADAPTIVE', 'FIXED_TIMER', 'EMERGENCY_OVERRIDE', 'HAZARD_CAUTION', 'MANUAL'],
    default: 'ADAPTIVE'
  },
  approaches: {
    type: [approachSchema],
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length === 4;
      },
      message: 'A 4-way junction must have exactly 4 directional approaches (NORTH, SOUTH, EAST, WEST).'
    }
  },
  activeDirection: {
    type: String,
    enum: ['NORTH', 'SOUTH', 'EAST', 'WEST'],
    default: 'NORTH'
  },
  currentPhaseState: {
    type: String,
    enum: [
      'GREEN_ACTIVE',
      'YELLOW_CLEARANCE',
      'ALL_RED_CLEARANCE',
      'EMERGENCY_YELLOW_CLEARANCE',
      'EMERGENCY_ALL_RED',
      'EMERGENCY_GREEN_CORRIDOR',
      'HAZARD_ALL_RED_PAUSE',
      'HAZARD_FLASHING_AMBER'
    ],
    default: 'GREEN_ACTIVE'
  },
  cycleCount: {
    type: Number,
    default: 0
  },
  timingParameters: {
    minGreenSeconds: { type: Number, default: 15 },
    maxGreenSeconds: { type: Number, default: 75 },
    yellowClearanceSeconds: { type: Number, default: 4 },
    allRedClearanceSeconds: { type: Number, default: 2 },
    targetCycleSeconds: { type: Number, default: 120 }
  },
  emergencyOverride: {
    isActive: { type: Boolean, default: false },
    approach: {
      type: String,
      enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', null],
      default: null
    },
    vehicleType: {
      type: String,
      enum: ['AMBULANCE', 'FIRE_TRUCK', 'POLICE', null],
      default: null
    },
    triggeredBy: {
      type: String,
      enum: ['AI_DETECTION', 'MANUAL_DISPATCH', null],
      default: null
    },
    startedAt: { type: Date, default: null },
    clearedAt: { type: Date, default: null }
  },
  pedestrianSafety: {
    crosswalkOccupied: { type: Boolean, default: false },
    activeCrosswalkApproach: { type: String, default: null },
    waitingPedestrians: { type: Number, default: 0 },
    walkPhaseExtended: { type: Boolean, default: false },
    extendedSeconds: { type: Number, default: 0 },
    turningConflictSuppressed: { type: Boolean, default: false }
  },
  cattleHazardMode: {
    isActive: { type: Boolean, default: false },
    approach: { type: String, default: null },
    hazardType: {
      type: String,
      enum: ['MOVING_CROSSING', 'STATIONARY_OBSTRUCTION', null],
      default: null
    },
    mitigation: {
      type: String,
      enum: ['ALL_RED_CAUTION_PAUSE', 'FLASHING_AMBER', 'NORMAL_FLOW'],
      default: 'NORMAL_FLOW'
    },
    startedAt: { type: Date, default: null }
  },
  v2xSpat: {
    broadcastActive: { type: Boolean, default: true },
    currentSignalPhase: { type: String, default: 'NORTH_GREEN' },
    secondsRemainingInPhase: { type: Number, default: 30 },
    recommendedGlosaSpeedKmh: { type: Number, default: 42.5 },
    distanceToStopLineMeters: { type: Number, default: 150.0 },
    lastBroadcastTimestamp: { type: Date, default: Date.now }
  }
}, { timestamps: true });

module.exports = mongoose.model('Junction', junctionSchema);
