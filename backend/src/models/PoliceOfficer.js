const mongoose = require('mongoose');

const policeOfficerSchema = new mongoose.Schema({
  officerId: {
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
  badgeNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  phone: {
    type: String,
    default: ''
  },
  patrolUnit: {
    type: String,
    default: 'Traffic Interceptor'
  },
  assignedZone: {
    type: String,
    default: 'Central District'
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'BUSY', 'OFF_DUTY'],
    default: 'ACTIVE'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      index: '2dsphere'
    }
  },
  lastHeartbeat: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('PoliceOfficer', policeOfficerSchema);
