require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');
const { User, Visitor, Appointment, Pass, CheckLog } = require('./models/Schemas');

async function seed() {
  const { getLocalUri } = require('./localDb'); const uri = await getLocalUri(); await mongoose.connect(uri);
  await Promise.all([User.deleteMany(), Visitor.deleteMany(), Appointment.deleteMany(), Pass.deleteMany(), CheckLog.deleteMany()]);

  const pw = await bcrypt.hash('123456', 10);
  const [admin, security, host] = await User.insertMany([
    { name: 'Fahad Admin', email: 'admin@vpms.com', password: pw, role: 'Admin', department: 'IT', organization: 'TechPark HQ' },
    { name: 'Raju Security', email: 'security@vpms.com', password: pw, role: 'Security', department: 'Gate 1', organization: 'TechPark HQ' },
    { name: 'Priya Host', email: 'host@vpms.com', password: pw, role: 'Host', department: 'Engineering', organization: 'TechPark HQ' },
    { name: 'Amit Visitor', email: 'visitor@vpms.com', password: pw, role: 'Visitor', department: 'External', organization: 'ClientCorp' }
  ]);

  const v1 = await Visitor.create({
    fullName: 'Amit Sharma', email: 'visitor@vpms.com', phone: '9876543210',
    company: 'ClientCorp India', idProof: 'AADHAAR-8842',
    photoUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Amit%20Sharma'
  });

  const appt = await Appointment.create({
    visitor: v1._id, host: host._id, purpose: 'MERN Capstone Review',
    visitDate: '2026-11-27', otpCode: '482910', otpVerified: true, status: 'Approved'
  });

  const qr = await QRCode.toDataURL(JSON.stringify({ passCode: 'VP-100101', visitor: 'Amit Sharma', date: '2026-11-27' }));
  const pass = await Pass.create({
    passCode: 'VP-100101', appointment: appt._id, visitor: v1._id, qrDataUrl: qr, validUntil: '2026-11-27', status: 'Checked-In'
  });

  await CheckLog.create({ pass: pass._id, visitorName: v1.fullName, passCode: 'VP-100101', action: 'CHECK_IN', verifiedBy: security.name });
  console.log('Seeded! Demo users (password: 123456): admin@vpms.com, security@vpms.com, host@vpms.com, visitor@vpms.com');
  process.exit();
}

seed();
