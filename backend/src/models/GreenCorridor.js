const mongoose = require('mongoose');

const greenCorridorSchema = new mongoose.Schema({
  corridorId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  emergencyType: {
    type: String,
    enum: ['AMBULANCE', 'FIRE_BRIGADE', 'POLICE_ESCORT', 'ORGAN_TRANSPORT'],
    default: 'AMBULANCE'
  },
  vehicleIdentifier: {
    type: String,
    default: 'EMERGENCY-01'
  },
  startJunctionId: {
    type: String,
    required: true
  },
  destinationJunctionId: {
    type: String,
    required: true
  },
  routeJunctions: [{
    type: String // Sequence of junctionIds e.g. ['JUNC001', 'JUNC002']
  }],
  routeRoads: [{
    type: String // Sequence of roadIds e.g. ['ROAD_E01', 'ROAD_N02']
  }],
  currentJunctionIndex: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['PLANNED', 'ACTIVE', 'COMPLETED', 'ABORTED'],
    default: 'PLANNED'
  },
  estimatedTravelTimeSeconds: {
    type: Number,
    default: 0
  },
  timeSavedSeconds: {
    type: Number,
    default: 0
  },
  junctionSteps: [{
    junctionId: String,
    incomingApproach: String,
    outgoingApproach: String,
    clearedAt: Date,
    preemptionActive: Boolean
  }],
  startedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('GreenCorridor', greenCorridorSchema);
