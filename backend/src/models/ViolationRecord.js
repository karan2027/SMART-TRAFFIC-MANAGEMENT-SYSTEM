const mongoose = require('mongoose');

const violationRecordSchema = new mongoose.Schema({
  violationId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  violationType: {
    type: String,
    enum: [
      'RED_LIGHT_JUMP',
      'WRONG_SIDE_DRIVING',
      'HELMET_VIOLATION',
      'TRIPLE_RIDING',
      'OVERSPEEDING',
      'STOP_LINE_CROSSING'
    ],
    required: true
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
  vehicleTrackId: {
    type: Number,
    required: true
  },
  vehicleClass: {
    type: String,
    default: 'motorcycle'
  },
  plateNumber: {
    type: String,
    trim: true,
    uppercase: true,
    default: 'UNKNOWN'
  },
  plateConfidence: {
    type: Number,
    default: 0.0
  },
  isPlateFormatValidIndian: {
    type: Boolean,
    default: false
  },
  measuredSpeedKmh: {
    type: Number,
    default: 0.0
  },
  speedLimitKmh: {
    type: Number,
    default: 50.0
  },
  evidenceImageUrl: {
    type: String,
    default: ''
  },
  plateCropUrl: {
    type: String,
    default: ''
  },
  confidence: {
    type: Number,
    required: true,
    min: 0.0,
    max: 1.0
  },
  eChallanNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  fineAmountInr: {
    type: Number,
    default: 1000
  },
  reviewStatus: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'REJECTED', 'FALSE_POSITIVE', 'CLOSED'],
    default: 'PENDING'
  },
  reviewedBy: {
    type: String,
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('ViolationRecord', violationRecordSchema);
