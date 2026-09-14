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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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
      
      // Parse token (for extracting school_id)
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
    setMobileMenuOpen(false);
  };

  const selectTab = (tab) => {
    setRoleTab(tab);
    setMobileMenuOpen(false);
  };

  if (!token) {
    if (isRegistering) {
      return (
        <div className="login-container">
          <div className="login-box">
            <h2 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Register New School</h2>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Create your organization account
            </p>
            {regError && <div className="error-banner">{regError}</div>}
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label>School Name</label>
                <input className="input" type="text" placeholder="e.g. Springdale High" value={regName} onChange={e => setRegName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Subdomain (e.g. springdale)</label>
                <input className="input" type="text" placeholder="springdale" value={regSubdomain} onChange={e => setRegSubdomain(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Admin Email</label>
                <input className="input" type="email" placeholder="admin@springdale.edu" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Admin Password</label>
                <input className="input" type="password" placeholder="••••••••" value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit" style={{ width: '100%', marginTop: '0.5rem' }}>
                Register School
              </button>
            </form>
            <div style={{ marginTop: '1.25rem', textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
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
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '2rem' }}>🏫</span>
            <h2 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>Timetable System</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Sign in to manage and view schedules
            </p>
          </div>
          
          {regSuccess && <div style={{ padding: '0.85rem 1rem', background: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #86efac', fontSize: '0.875rem' }}>{regSuccess}</div>}
          {loginError && <div className="error-banner">{loginError}</div>}
          
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                className="input" 
                type="email" 
                placeholder="admin@springdale.edu"
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
                placeholder="••••••••"
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: '100%', marginTop: '0.5rem' }}>
              Sign In
            </button>
          </form>
          <div style={{ marginTop: '1.25rem', textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Don't have a school registered?</p>
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
      {/* Backdrop for mobile drawer */}
      <div 
        className={`sidebar-backdrop ${mobileMenuOpen ? 'mobile-open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={schoolName || 'School'}>
              {schoolName || 'School'}
            </h3>
            {mobileMenuOpen && (
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
                aria-label="Close menu"
              >
                ✕
              </button>
            )}
          </div>
          <div className="sidebar-brand-badge">
            <span>📅</span>
            <span>Timetable Suite</span>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <div 
            className={`nav-item ${roleTab === 'Admin' ? 'active' : ''}`}
            onClick={() => selectTab('Admin')}
          >
            <span className="nav-icon">⚙️</span>
            <span>Admin Portal</span>
          </div>
          <div 
            className={`nav-item ${roleTab === 'Teacher' ? 'active' : ''}`}
            onClick={() => selectTab('Teacher')}
          >
            <span className="nav-icon">👨‍🏫</span>
            <span>Teacher Portal</span>
          </div>
          <div 
            className={`nav-item ${roleTab === 'Student' ? 'active' : ''}`}
            onClick={() => selectTab('Student')}
          >
            <span className="nav-icon">🎓</span>
            <span>Student Portal</span>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleLogout}>
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className="main-wrapper">
        {/* Mobile Header Bar */}
        <header className="mobile-top-bar">
          <button 
            className="mobile-nav-toggle"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open Navigation"
          >
            ☰
          </button>
          
          <div style={{ textAlign: 'center', flex: 1, padding: '0 0.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {schoolName || 'School Timetable'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--primary-color)', fontWeight: 600 }}>
              {roleTab === 'Admin' ? 'Admin Portal' : roleTab === 'Teacher' ? 'Teacher Portal' : 'Student Portal'}
            </div>
          </div>

          <button 
            onClick={handleLogout} 
            className="btn btn-secondary btn-sm"
            title="Log out"
            style={{ padding: '0.25rem 0.5rem' }}
          >
            🚪
          </button>
        </header>

        {/* Content Area */}
        <main className="main-content">
          <div className="page-container">
            {roleTab === 'Admin' && <AdminPortal schoolId={schoolId} token={token} />}
            {roleTab === 'Teacher' && <TeacherPortal schoolId={schoolId} token={token} />}
            {roleTab === 'Student' && <StudentPortal schoolId={schoolId} token={token} />}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="mobile-bottom-nav">
          <button 
            className={`mobile-bottom-nav-item ${roleTab === 'Admin' ? 'active' : ''}`}
            onClick={() => selectTab('Admin')}
          >
            <span className="icon">⚙️</span>
            <span>Admin</span>
          </button>
          <button 
            className={`mobile-bottom-nav-item ${roleTab === 'Teacher' ? 'active' : ''}`}
            onClick={() => selectTab('Teacher')}
          >
            <span className="icon">👨‍🏫</span>
            <span>Teacher</span>
          </button>
          <button 
            className={`mobile-bottom-nav-item ${roleTab === 'Student' ? 'active' : ''}`}
            onClick={() => selectTab('Student')}
          >
            <span className="icon">🎓</span>
            <span>Student</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

export default App;

