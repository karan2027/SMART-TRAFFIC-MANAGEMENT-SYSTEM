const mongoose = require('mongoose');

const cameraSchema = new mongoose.Schema({
  cameraId: {
    type: String,
    required: true,
    unique: true,
    trim: true
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
  location: {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null }
  },
  sourceType: {
    type: String,
    enum: ['recorded_video', 'rtsp_stream', 'mock_stream'],
    default: 'recorded_video'
  },
  sourcePath: {
    type: String,
    default: ''
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
    enum: ['online', 'offline', 'analyzing'],
    default: 'online'
  }
}, { timestamps: true });

module.exports = mongoose.model('Camera', cameraSchema);
