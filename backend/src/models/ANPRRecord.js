const mongoose = require('mongoose');

const anprRecordSchema = new mongoose.Schema({
  recordId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  plateText: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true
  },
  ocrConfidence: {
    type: Number,
    required: true,
    min: 0.0,
    max: 1.0
  },
  isFormatValid: {
    type: Boolean,
    default: false
  },
  stateCode: {
    type: String,
    default: ''
  },
  rtoCode: {
    type: String,
    default: ''
  },
  vehicleTrackId: {
    type: Number,
    required: true
  },
  vehicleClass: {
    type: String,
    default: 'car'
  },
  cameraId: {
    type: String,
    required: true,
    index: true
  },
  roadId: {
    type: String,
    required: true
  },
  junctionId: {
    type: String,
    default: 'JUNC001'
  },
  cropImageUrl: {
    type: String,
    default: ''
  },
  sceneImageUrl: {
    type: String,
    default: ''
  },
  verificationStatus: {
    type: String,
    enum: ['AUTOMATIC_MATCH', 'MANUAL_VERIFIED', 'FLAGGED_UNCERTAIN'],
    default: 'AUTOMATIC_MATCH'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('ANPRRecord', anprRecordSchema);
