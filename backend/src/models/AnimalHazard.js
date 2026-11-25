const mongoose = require('mongoose');

const animalHazardSchema = new mongoose.Schema({
  hazardId: {
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
  animalClass: {
    type: String,
    enum: ['COW', 'DOG', 'HORSE', 'SHEEP', 'OTHER_LIVESTOCK'],
    required: true
  },
  confidence: {
    type: Number,
    required: true,
    min: 0.55
  },
  consecutiveFramesObserved: {
    type: Number,
    default: 12
  },
  hazardState: {
    type: String,
    enum: ['MOVING_CROSSING', 'STATIONARY_OBSTRUCTION'],
    default: 'MOVING_CROSSING'
  },
  signalMitigation: {
    type: String,
    enum: ['ALL_RED_CAUTION_PAUSE', 'FLASHING_AMBER_PROCEED_WITH_CAUTION', 'NORMAL_FLOW'],
    default: 'ALL_RED_CAUTION_PAUSE'
  },
  redHoldElapsedSeconds: {
    type: Number,
    default: 0
  },
  municipalDispatched: {
    type: Boolean,
    default: false
  },
  municipalSquadNotes: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'RESOLVED', 'FALSE_ALARM'],
    default: 'ACTIVE'
  },
  detectedAt: {
    type: Date,
    default: Date.now
  },
  clearedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('AnimalHazard', animalHazardSchema);
