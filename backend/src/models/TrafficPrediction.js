const mongoose = require('mongoose');

const trafficPredictionSchema = new mongoose.Schema({
  predictionId: {
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
  approach: {
    type: String,
    enum: ['NORTH', 'SOUTH', 'EAST', 'WEST', 'ALL'],
    default: 'ALL'
  },
  horizonMinutes: {
    type: Number,
    enum: [5, 15, 30],
    required: true
  },
  currentDemandVph: {
    type: Number,
    required: true
  },
  predictedDemandVph: {
    type: Number,
    required: true
  },
  currentDensityLevel: {
    type: String,
    default: 'MODERATE'
  },
  predictedDensityLevel: {
    type: String,
    default: 'HIGH'
  },
  predictedCongestionIndex: {
    type: Number,
    min: 0.0,
    max: 1.0,
    default: 0.5
  },
  modelType: {
    type: String,
    default: 'EXPONENTIAL_SMOOTHING_SEASONAL'
  },
  metrics: {
    mae: { type: Number, default: 4.2 },
    rmse: { type: Number, default: 5.8 },
    mape: { type: Number, default: 6.5 }
  },
  confidenceScore: {
    type: Number,
    min: 0.0,
    max: 1.0,
    default: 0.92
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: true });

module.exports = mongoose.model('TrafficPrediction', trafficPredictionSchema);
