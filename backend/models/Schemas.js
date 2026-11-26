const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Security', 'Host', 'Visitor'], default: 'Visitor' },
  department: { type: String, default: 'General' },
  organization: { type: String, default: 'Main Campus' }
}, { timestamps: true });

const visitorSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  company: { type: String, default: 'Individual' },
  idProof: { type: String, required: true },
  photoUrl: { type: String, default: 'https://api.dicebear.com/7.x/initials/svg?seed=VP' }
}, { timestamps: true });

const appointmentSchema = new mongoose.Schema({
  visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', required: true },
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, required: true },
  visitDate: { type: String, required: true },
  otpCode: { type: String },
  otpVerified: { type: Boolean, default: false },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' }
}, { timestamps: true });

const passSchema = new mongoose.Schema({
  passCode: { type: String, required: true, unique: true },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', required: true },
  qrDataUrl: { type: String, required: true },
  validUntil: { type: String, required: true },
  status: { type: String, enum: ['Issued', 'Checked-In', 'Checked-Out', 'Expired'], default: 'Issued' }
}, { timestamps: true });

const checkLogSchema = new mongoose.Schema({
  pass: { type: mongoose.Schema.Types.ObjectId, ref: 'Pass', required: true },
  visitorName: String,
  passCode: String,
  action: { type: String, enum: ['CHECK_IN', 'CHECK_OUT'], required: true },
  verifiedBy: { type: String, default: 'Security Desk' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = {
  User: mongoose.model('User', userSchema),
  Visitor: mongoose.model('Visitor', visitorSchema),
  Appointment: mongoose.model('Appointment', appointmentSchema),
  Pass: mongoose.model('Pass', passSchema),
  CheckLog: mongoose.model('CheckLog', checkLogSchema)
};
