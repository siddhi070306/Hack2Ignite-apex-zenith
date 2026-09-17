const mongoose = require('mongoose');

const triageSchema = new mongoose.Schema({
  patientName: {
    type: String,
    required: true
  },
  patientAge: Number,
  patientGender: String,
  village: String,
  ashaName: {
    type: String,
    required: true
  },
  urgency: {
    type: String,
    enum: ['Red', 'Yellow', 'Green'],
    required: true
  },
  symptoms: [String],
  keywords: [String],
  advice: String,
  transcript: String,
  translation: String,
  language: String,
  audioUrl: String,
  doctorVerificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'modified'],
    default: 'pending'
  },
  verifiedBy: String,
  verifiedAt: Date,
  doctorUrgency: String,
  doctorSymptoms: [String],
  doctorMessage: String,
  txHash: String,
  blockNumber: Number,
  dataHash: String,
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  followUpDate: Date,
  followUpDone: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Triage', triageSchema);
