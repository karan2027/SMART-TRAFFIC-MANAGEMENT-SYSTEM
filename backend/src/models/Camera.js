const mongoose = require('mongoose');

const cameraSchema = new mongoose.Schema({
  cameraId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  roadId: {
    type: String,
    required: true,
    index: true
  },
  junctionId: {
    type: String,
    default: 'JUNC001',
    index: true
  },
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null }
  },
  sourceType: {
    type: String,
    enum: ['recorded_video', 'rtsp_stream', 'mobile_stream', 'ip_webcam', 'mock_stream'],
    default: 'recorded_video'
  },
  sourcePath: {
    type: String,
    default: ''
  },
  streamUrl: {
    type: String,
    default: ''
  },
  ipAddress: {
    type: String,
    default: ''
  },
  port: {
    type: Number,
    default: 8080
  },
  isMobileCamera: {
    type: Boolean,
    default: false
  },
  resolution: {
    width: { type: Number, default: 1280 },
    height: { type: Number, default: 720 }
  },
  fps: {
    type: Number,
    default: 30
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'analyzing', 'connecting', 'error'],
    default: 'online'
  },
  lastHeartbeat: {
    type: Date,
    default: Date.now
  },
  connectionError: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Camera', cameraSchema);
