const mongoose = require('mongoose');

const roadSchema = new mongoose.Schema({
  roadId: {
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
  description: {
    type: String,
    default: ''
  },
  lanes: {
    type: Number,
    default: 2
  },
  direction: {
    type: String,
    default: 'Two-Way'
  },
  location: {
    startPoint: { type: String, default: null },
    endPoint: { type: String, default: null }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active'
  }
}, { timestamps: true });

module.exports = mongoose.model('Road', roadSchema);
