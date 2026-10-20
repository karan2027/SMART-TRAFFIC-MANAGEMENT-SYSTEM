const mongoose = require('mongoose');

const analysisJobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  videoPath: {
    type: String,
    required: true
  },
  videoFilename: {
    type: String,
    default: ''
  },
  cameraId: {
    type: String,
    required: true
  },
  roadId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['queued', 'processing', 'completed', 'failed'],
    default: 'queued'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  stageMessage: {
    type: String,
    default: 'Queued for processing'
  },
  currentFrame: {
    type: Number,
    default: 0
  },
  totalFrames: {
    type: Number,
    default: 0
  },
  resultSummary: {
    type: Object,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  },
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('AnalysisJob', analysisJobSchema);
