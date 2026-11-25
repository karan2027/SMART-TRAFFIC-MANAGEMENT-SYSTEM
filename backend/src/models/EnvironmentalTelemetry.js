const mongoose = require('mongoose');

const environmentalTelemetrySchema = new mongoose.Schema({
  junctionId: {
    type: String,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  cumulativeIdleTimeReducedSeconds: {
    type: Number,
    default: 0
  },
  co2PreventedKg: {
    type: Number,
    default: 0.0
  },
  fuelSavedLitres: {
    type: Number,
    default: 0.0
  },
  pm25ReducedGrams: {
    type: Number,
    default: 0.0
  },
  vehiclesBenefitedCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('EnvironmentalTelemetry', environmentalTelemetrySchema);
