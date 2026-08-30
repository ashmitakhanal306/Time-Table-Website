import React, { useState, useEffect } from 'react';
import { api } from './api';
import AdminPortal from './components/AdminPortal';
import TeacherPortal from './components/TeacherPortal';
import StudentPortal from './components/StudentPortal';
import './index.css';

function App() {
  const [token, setToken] = useState(null);
  const [schoolId, setSchoolId] = useState(null);
  const [schoolName, setSchoolName] = useState('');
  const [roleTab, setRoleTab] = useState('Admin'); // 'Admin', 'Teacher', 'Student'
  
  // Login form state
  const [email, setEmail] = useState('admin@springdale.edu');
  const [password, setPassword] = useState('password123');
  const [loginError, setLoginError] = useState(null);

  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regSubdomain, setRegSubdomain] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regError, setRegError] = useState(null);
  const [regSuccess, setRegSuccess] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await api.login(email, password);
      setToken(res.access_token);
      
      // Parse token (dirty but works for extracting school_id without another request)
      const payload = JSON.parse(atob(res.access_token.split('.')[1]));
      const sId = payload.school_id;
      setSchoolId(sId);
      
      // Get school name
      const schools = await api.listSchools();
      const s = schools.find(school => school.id === sId);
      if (s) {
        setSchoolName(s.name);
      }
    } catch (err) {
      setLoginError(err.message);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);
    try {
      await api.createSchool({
        name: regName,
        subdomain: regSubdomain,
        admin_email: regEmail,
        admin_password: regPassword
      });
      setRegSuccess("School created successfully! You can now log in.");
      setEmail(regEmail);
      setIsRegistering(false);
    } catch (err) {
      setRegError(err.message);
    }
  };

  const handleLogout = () => {
    setToken(null);
    setSchoolId(null);
    setSchoolName('');
  };

  if (!token) {
    if (isRegistering) {
      return (
        <div className="login-container">
          <div className="login-box" style={{ maxWidth: '400px' }}>
            <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Register New School</h2>
            {regError && <div className="error-banner">{regError}</div>}
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>School Name</label>
                <input className="input" type="text" value={regName} onChange={e => setRegName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Subdomain (e.g. myschool)</label>
                <input className="input" type="text" value={regSubdomain} onChange={e => setRegSubdomain(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Admin Email</label>
                <input className="input" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Admin Password</label>
                <input className="input" type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%', marginTop: '1rem' }}>
                Register School
              </button>
            </form>
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setIsRegistering(false)} style={{ width: '100%' }}>
                Back to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="login-container">
        <div className="login-box">
          <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Timetable Login</h2>
          {regSuccess && <div style={{ padding: '1rem', background: '#dcfce3', color: '#166534', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #86efac' }}>{regSuccess}</div>}
          {loginError && <div className="error-banner">{loginError}</div>}
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email</label>
              <input 
                className="input" 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input 
                className="input" 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%', marginTop: '1rem' }}>
              Sign In
            </button>
          </form>
          <div style={{ marginTop: '1rem', textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Don't have a school yet?</p>
            <button className="btn btn-secondary" onClick={() => setIsRegistering(true)} style={{ width: '100%' }}>
              Register New School
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="sidebar-header">
          <h3 style={{ margin: 0 }}>{schoolName}</h3>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Timetable System
          </div>
        </div>
        <div className="sidebar-nav">
          <div 
            className={`nav-item ${roleTab === 'Admin' ? 'active' : ''}`}
            onClick={() => setRoleTab('Admin')}
          >
            Admin Portal
          </div>
          <div 
            className={`nav-item ${roleTab === 'Teacher' ? 'active' : ''}`}
            onClick={() => setRoleTab('Teacher')}
          >
            Teacher Portal
          </div>
          <div 
            className={`nav-item ${roleTab === 'Student' ? 'active' : ''}`}
            onClick={() => setRoleTab('Student')}
          >
            Student Portal
          </div>
          <div style={{ padding: '1.5rem', marginTop: 'auto' }}>
            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </div>
      
      <div className="main-content">
        {roleTab === 'Admin' && <AdminPortal schoolId={schoolId} token={token} />}
        {roleTab === 'Teacher' && <TeacherPortal schoolId={schoolId} token={token} />}
        {roleTab === 'Student' && <StudentPortal schoolId={schoolId} token={token} />}
      </div>
    </div>
  );
}

export default App;
