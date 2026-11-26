require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { User, Visitor, Appointment, Pass, CheckLog } = require('./models/Schemas');
const { verifyToken, authorizeRoles } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

const { getLocalUri } = require('./localDb'); getLocalUri().then(uri => mongoose.connect(uri)).then(() => console.log('MongoDB Connected')).catch(err => console.error('MongoDB Error:', err));

app.get('/', (req, res) => res.json({ message: 'Visitor Pass Management API Running' }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, department, organization } = req.body;
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already registered' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, role: role || 'Visitor', department, organization });
    res.status(201).json({ message: 'Registered successfully', user: { id: user._id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, organization: user.organization } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/hosts', verifyToken, async (req, res) => {
  const hosts = await User.find({ role: { $in: ['Host', 'Admin'] } }).select('name email department');
  res.json(hosts);
});

app.post('/api/appointments', verifyToken, async (req, res) => {
  try {
    const { fullName, email, phone, company, idProof, photoUrl, hostId, purpose, visitDate } = req.body;
    const visitor = await Visitor.create({
      fullName, email, phone, company, idProof,
      photoUrl: photoUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}`
    });
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const autoApprove = req.user.role === 'Host' || req.user.role === 'Admin';
    const appointment = await Appointment.create({
      visitor: visitor._id,
      host: hostId || req.user.id,
      purpose,
      visitDate,
      otpCode,
      otpVerified: autoApprove,
      status: autoApprove ? 'Approved' : 'Pending'
    });

    let pass = null;
    if (autoApprove) {
      const passCode = `VP-${Date.now().toString().slice(-6)}`;
      const qrDataUrl = await QRCode.toDataURL(JSON.stringify({ passCode, visitor: visitor.fullName, date: visitDate }));
      pass = await Pass.create({ passCode, appointment: appointment._id, visitor: visitor._id, qrDataUrl, validUntil: visitDate });
    }
    const populated = await Appointment.findById(appointment._id).populate('visitor').populate('host', 'name department');
    res.status(201).json({ appointment: populated, pass, otpCode });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/appointments/:id/verify-otp', verifyToken, async (req, res) => {
  try {
    const { otp } = req.body;
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({ message: 'Appointment not found' });
    if (appt.otpCode !== otp) return res.status(400).json({ message: 'Invalid OTP code' });
    appt.otpVerified = true;
    await appt.save();
    res.json({ message: 'OTP verified successfully', appointment: appt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/appointments', verifyToken, async (req, res) => {
  const list = await Appointment.find().populate('visitor').populate('host', 'name department').sort({ createdAt: -1 });
  res.json(list);
});

app.patch('/api/appointments/:id/status', verifyToken, authorizeRoles('Admin', 'Host', 'Security'), async (req, res) => {
  try {
    const { status } = req.body;
    const appointment = await Appointment.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate('visitor');
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    let pass = null;
    if (status === 'Approved') {
      const existing = await Pass.findOne({ appointment: appointment._id });
      if (!existing) {
        const passCode = `VP-${Date.now().toString().slice(-6)}`;
        const qrDataUrl = await QRCode.toDataURL(JSON.stringify({ passCode, visitor: appointment.visitor.fullName, date: appointment.visitDate }));
        pass = await Pass.create({ passCode, appointment: appointment._id, visitor: appointment.visitor._id, qrDataUrl, validUntil: appointment.visitDate });
      }
    }
    res.json({ appointment, pass, notification: `Email & SMS alert sent to ${appointment.visitor.email} (${appointment.visitor.phone})` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/passes', verifyToken, async (req, res) => {
  const passes = await Pass.find().populate('visitor').populate({ path: 'appointment', populate: { path: 'host', select: 'name department' } }).sort({ createdAt: -1 });
  res.json(passes);
});

app.post('/api/passes/scan', verifyToken, authorizeRoles('Admin', 'Security'), async (req, res) => {
  try {
    const { passCode, action } = req.body;
    const pass = await Pass.findOne({ passCode: passCode.trim().toUpperCase() }).populate('visitor');
    if (!pass) return res.status(404).json({ message: 'Pass Code not found!' });

    pass.status = action === 'CHECK_IN' ? 'Checked-In' : 'Checked-Out';
    await pass.save();

    const log = await CheckLog.create({
      pass: pass._id,
      visitorName: pass.visitor.fullName,
      passCode: pass.passCode,
      action,
      verifiedBy: req.user.name
    });
    res.json({ message: `${pass.visitor.fullName} marked as ${pass.status}`, pass, log });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/dashboard', verifyToken, async (req, res) => {
  const [totalVisitors, pendingAppointments, activePasses, totalPasses, checkLogs] = await Promise.all([
    Visitor.countDocuments(),
    Appointment.countDocuments({ status: 'Pending' }),
    Pass.countDocuments({ status: 'Checked-In' }),
    Pass.countDocuments(),
    CheckLog.find().sort({ timestamp: -1 }).limit(30)
  ]);
  res.json({ totalVisitors, pendingAppointments, activePasses, totalPasses, checkLogs });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Visitor Pass Server running on http://localhost:${PORT}`));
