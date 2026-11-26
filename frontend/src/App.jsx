import React, { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('vp_token') || '');
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('vp_user') || 'null'));
  const [tab, setTab] = useState('dashboard');
  const [isRegister, setIsRegister] = useState(false);
  const [authForm, setAuthForm] = useState({ name: '', email: 'admin@vpms.com', password: '123456', role: 'Visitor', department: 'General' });
  const [msg, setMsg] = useState('');

  const [stats, setStats] = useState({ totalVisitors: 0, pendingAppointments: 0, activePasses: 0, totalPasses: 0, checkLogs: [] });
  const [appointments, setAppointments] = useState([]);
  const [passes, setPasses] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [apptForm, setApptForm] = useState({ fullName: '', email: '', phone: '', company: '', idProof: '', photoUrl: '', hostId: '', purpose: '', visitDate: '2026-11-27' });
  const [otpVerify, setOtpVerify] = useState({ id: '', code: '' });
  const [scanCode, setScanCode] = useState('VP-100101');

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const loadAll = async () => {
    if (!token) return;
    try {
      const [d, a, p, h] = await Promise.all([
        fetch(`${API}/api/dashboard`, { headers }).then(r => r.json()),
        fetch(`${API}/api/appointments`, { headers }).then(r => r.json()),
        fetch(`${API}/api/passes`, { headers }).then(r => r.json()),
        fetch(`${API}/api/hosts`, { headers }).then(r => r.json())
      ]);
      if (d.totalVisitors !== undefined) setStats(d);
      if (Array.isArray(a)) setAppointments(a);
      if (Array.isArray(p)) setPasses(p);
      if (Array.isArray(h)) {
        setHosts(h);
        if (h[0] && !apptForm.hostId) setApptForm(f => ({ ...f, hostId: h[0]._id }));
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadAll(); }, [token]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setMsg('');
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authForm)
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.message || 'Auth failed');
    if (isRegister) {
      setIsRegister(false);
      setMsg('Registered! Please log in.');
    } else {
      localStorage.setItem('vp_token', data.token);
      localStorage.setItem('vp_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
    }
  };

  const logout = () => {
    localStorage.removeItem('vp_token');
    localStorage.removeItem('vp_user');
    setToken('');
    setUser(null);
  };

  const createAppointment = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API}/api/appointments`, { method: 'POST', headers, body: JSON.stringify(apptForm) });
    const data = await res.json();
    if (res.ok) {
      setMsg(`Appointment created! Verification OTP: ${data.otpCode}`);
      setOtpVerify({ id: data.appointment._id, code: data.otpCode });
      setApptForm({ ...apptForm, fullName: '', email: '', phone: '', company: '', idProof: '', purpose: '' });
      loadAll();
    } else setMsg(data.message);
  };

  const verifyOtp = async () => {
    const res = await fetch(`${API}/api/appointments/${otpVerify.id}/verify-otp`, {
      method: 'POST', headers, body: JSON.stringify({ otp: otpVerify.code })
    });
    const data = await res.json();
    setMsg(data.message);
    loadAll();
  };

  const updateApptStatus = async (id, status) => {
    const res = await fetch(`${API}/api/appointments/${id}/status`, {
      method: 'PATCH', headers, body: JSON.stringify({ status })
    });
    const data = await res.json();
    setMsg(data.notification || data.message);
    loadAll();
  };

  const handleScan = async (action) => {
    const res = await fetch(`${API}/api/passes/scan`, {
      method: 'POST', headers, body: JSON.stringify({ passCode: scanCode, action })
    });
    const data = await res.json();
    setMsg(data.message);
    loadAll();
  };

  const exportCsv = () => {
    const rows = [['Visitor', 'Company', 'Host', 'Date', 'Status'], ...appointments.map(a => [a.visitor?.fullName, a.visitor?.company, a.host?.name, a.visitDate, a.status])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'visitor_report.csv'; a.click();
  };

  if (!token) {
    return (
      <div className="container" style={{ maxWidth: 440, marginTop: 60 }}>
        <div className="card">
          <h2>Visitor Pass Portal (MERN)</h2>
          <p style={{ color: '#64748b', fontSize: 14, margin: '6px 0 16px' }}>Role-Based Digital Pass & Gate Security</p>
          {msg && <div className="alert">{msg}</div>}
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isRegister && (
              <>
                <input placeholder="Full Name" required value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} />
                <select value={authForm.role} onChange={e => setAuthForm({ ...authForm, role: e.target.value })}>
                  <option value="Visitor">Visitor</option>
                  <option value="Host">Employee / Host</option>
                  <option value="Security">Security / Frontdesk</option>
                  <option value="Admin">Admin</option>
                </select>
              </>
            )}
            <input type="email" placeholder="Email" required value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} />
            <input type="password" placeholder="Password" required value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
            <button className="btn" type="submit">{isRegister ? 'Create Account' : 'Sign In'}</button>
          </form>
          <p style={{ marginTop: 12, fontSize: 13 }}>
            {isRegister ? 'Already have an account?' : 'New visitor or staff?'}{' '}
            <a href="#toggle" onClick={(e) => { e.preventDefault(); setIsRegister(!isRegister); }}>{isRegister ? 'Login' : 'Register'}</a>
          </p>
          <div className="demo-pills">
            {['admin@vpms.com', 'security@vpms.com', 'host@vpms.com', 'visitor@vpms.com'].map(em => (
              <button key={em} type="button" onClick={() => setAuthForm({ ...authForm, email: em, password: '123456' })}>{em.split('@')[0]}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const filteredAppts = appointments.filter(a => {
    const matchText = (a.visitor?.fullName || '').toLowerCase().includes(search.toLowerCase()) || (a.visitor?.company || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchText && matchStatus;
  });

  return (
    <div>
      <nav className="nav no-print">
        <div><strong>VPMS</strong> <span style={{ fontSize: 13, color: '#94a3b8' }}>| {user?.name} ({user?.role})</span></div>
        <div className="nav-tabs">
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Dashboard & Reports</button>
          <button className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>Pre-Register Visitor</button>
          <button className={tab === 'passes' ? 'active' : ''} onClick={() => setTab('passes')}>QR Badges ({passes.length})</button>
          {(user?.role === 'Admin' || user?.role === 'Security') && (
            <button className={tab === 'scanner' ? 'active' : ''} onClick={() => setTab('scanner')}>Gate Check-In/Out</button>
          )}
          <button className="logout" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="container">
        {msg && <div className="alert no-print">{msg}</div>}

        {tab === 'dashboard' && (
          <>
            <div className="grid-4">
              <div className="stat"><span>Total Visitors</span><h3>{stats.totalVisitors}</h3></div>
              <div className="stat"><span>Pending Approvals</span><h3>{stats.pendingAppointments}</h3></div>
              <div className="stat"><span>Currently Checked-In</span><h3>{stats.activePasses}</h3></div>
              <div className="stat"><span>Issued QR Passes</span><h3>{stats.totalPasses}</h3></div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <h3>Appointments & Visitor Directory</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input placeholder="Search visitor or company..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 210 }} />
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 130 }}>
                    <option value="ALL">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                  <button className="btn btn-outline" onClick={exportCsv}>Export CSV</button>
                </div>
              </div>
              <table>
                <thead>
                  <tr><th>Visitor</th><th>Company & ID</th><th>Host</th><th>Date & Purpose</th><th>OTP</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {filteredAppts.map(a => (
                    <tr key={a._id}>
                      <td><strong>{a.visitor?.fullName}</strong><br /><small>{a.visitor?.email}</small></td>
                      <td>{a.visitor?.company}<br /><small>{a.visitor?.idProof}</small></td>
                      <td>{a.host?.name}</td>
                      <td>{a.visitDate}<br /><small>{a.purpose}</small></td>
                      <td>{a.otpVerified ? 'Verified' : `OTP: ${a.otpCode}`}</td>
                      <td><span className={`badge ${a.status}`}>{a.status}</span></td>
                      <td>
                        {a.status === 'Pending' && ['Admin', 'Host', 'Security'].includes(user?.role) && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-green" style={{ padding: '5px 10px' }} onClick={() => updateApptStatus(a._id, 'Approved')}>Approve</button>
                            <button className="btn btn-red" style={{ padding: '5px 10px' }} onClick={() => updateApptStatus(a._id, 'Rejected')}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h3>Recent Gate Check-In / Check-Out Audit Logs</h3>
              <table>
                <thead><tr><th>Pass Code</th><th>Visitor</th><th>Action</th><th>Verified By</th><th>Timestamp</th></tr></thead>
                <tbody>
                  {stats.checkLogs?.map(l => (
                    <tr key={l._id}>
                      <td><strong>{l.passCode}</strong></td><td>{l.visitorName}</td>
                      <td><span className={`badge ${l.action === 'CHECK_IN' ? 'Checked-In' : 'Checked-Out'}`}>{l.action}</span></td>
                      <td>{l.verifiedBy}</td><td>{new Date(l.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'register' && (
          <div className="card">
            <h3>Visitor Pre-Registration & Appointment Request</h3>
            <form onSubmit={createAppointment}>
              <div className="form-grid">
                <input placeholder="Visitor Full Name" required value={apptForm.fullName} onChange={e => setApptForm({ ...apptForm, fullName: e.target.value })} />
                <input type="email" placeholder="Visitor Email" required value={apptForm.email} onChange={e => setApptForm({ ...apptForm, email: e.target.value })} />
                <input placeholder="Phone Number" required value={apptForm.phone} onChange={e => setApptForm({ ...apptForm, phone: e.target.value })} />
                <input placeholder="Company / Organization" value={apptForm.company} onChange={e => setApptForm({ ...apptForm, company: e.target.value })} />
                <input placeholder="Govt ID Proof (e.g. AADHAAR-1234)" required value={apptForm.idProof} onChange={e => setApptForm({ ...apptForm, idProof: e.target.value })} />
                <input placeholder="Photo URL (Optional)" value={apptForm.photoUrl} onChange={e => setApptForm({ ...apptForm, photoUrl: e.target.value })} />
                <select value={apptForm.hostId} onChange={e => setApptForm({ ...apptForm, hostId: e.target.value })}>
                  {hosts.map(h => <option key={h._id} value={h._id}>Host: {h.name} ({h.department})</option>)}
                </select>
                <input type="date" required value={apptForm.visitDate} onChange={e => setApptForm({ ...apptForm, visitDate: e.target.value })} />
                <input placeholder="Purpose of Visit" required value={apptForm.purpose} onChange={e => setApptForm({ ...apptForm, purpose: e.target.value })} />
              </div>
              <button className="btn" style={{ marginTop: 14 }} type="submit">Submit Registration</button>
            </form>

            {otpVerify.id && (
              <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10, alignItems: 'center' }}>
                <strong>OTP Verification:</strong>
                <input style={{ width: 150 }} value={otpVerify.code} onChange={e => setOtpVerify({ ...otpVerify, code: e.target.value })} />
                <button className="btn btn-green" type="button" onClick={verifyOtp}>Verify OTP</button>
              </div>
            )}
          </div>
        )}

        {tab === 'passes' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }} className="no-print">
              <h3>Digital Visitor Passes (QR + Printable PDF Badge)</h3>
              <button className="btn" onClick={() => window.print()}>Print / Save PDF Badges</button>
            </div>
            <div className="pass-grid">
              {passes.map(p => (
                <div className="pass-card" key={p._id}>
                  <div>
                    <span className={`badge ${p.status}`}>{p.status}</span>
                    <h3 style={{ marginTop: 8 }}>{p.visitor?.fullName}</h3>
                    <p style={{ fontSize: 13, color: '#475569' }}>{p.visitor?.company} | ID: {p.visitor?.idProof}</p>
                    <p style={{ fontSize: 13, marginTop: 4 }}><strong>Code:</strong> {p.passCode}</p>
                    <p style={{ fontSize: 13 }}><strong>Valid Date:</strong> {p.validUntil}</p>
                    <p style={{ fontSize: 13 }}><strong>Host:</strong> {p.appointment?.host?.name}</p>
                  </div>
                  <img src={p.qrDataUrl} alt="QR Pass" style={{ width: 110, height: 110 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'scanner' && (
          <div className="card" style={{ maxWidth: 520 }}>
            <h3>Security Gate QR / Pass Scanner</h3>
            <p style={{ fontSize: 14, color: '#64748b', margin: '6px 0 14px' }}>Enter or scan a Visitor Pass Code (e.g., VP-100101) to log entry or exit.</p>
            <input value={scanCode} onChange={e => setScanCode(e.target.value)} placeholder="Enter Pass Code (VP-XXXXXX)" />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button className="btn btn-green" onClick={() => handleScan('CHECK_IN')}>Verify & Check-In</button>
              <button className="btn btn-red" onClick={() => handleScan('CHECK_OUT')}>Verify & Check-Out</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
