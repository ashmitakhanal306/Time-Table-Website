import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import TimetableGrid from './TimetableGrid';

const DAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
];

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function TeacherPortal({ schoolId, token }) {
  const [config, setConfig] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    loadConfig();
  }, [schoolId]);

  useEffect(() => {
    if (selectedTeacherId) {
      loadEntries();
    } else {
      setEntries([]);
    }
  }, [selectedTeacherId, selectedDate, viewMode]);

  const loadConfig = async () => {
    try {
      const data = await api.getConfig(schoolId, token);
      setConfig(data);
      if (data.teachers?.length > 0) {
        setSelectedTeacherId(data.teachers[0].id.toString());
      }
    } catch (e) {
      setErrorMsg('Failed to load config: ' + e.message);
    }
  };

  const loadEntries = async () => {
    try {
      setErrorMsg(null);
      if (viewMode === 'day') {
        const data = await api.getEffectiveTimetable(schoolId, selectedDate, null, selectedTeacherId, token);
        setEntries(data || []);
      } else {
        const data = await api.getEntries(schoolId, null, selectedTeacherId, token);
        setEntries(data || []);
      }
    } catch (e) {
      setErrorMsg('Failed to load entries: ' + e.message);
    }
  };

  const shiftDate = (days) => {
    const dt = new Date(selectedDate + 'T00:00:00');
    dt.setDate(dt.getDate() + days);
    const year = dt.getFullYear();
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const day = String(dt.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  const activeDayInfo = useMemo(() => {
    if (!selectedDate) return { id: 1, name: 'Monday' };
    const dt = new Date(selectedDate + 'T00:00:00');
    const jsDay = dt.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const isoDay = jsDay === 0 ? 7 : jsDay;
    const dayObj = DAYS.find(d => d.id === isoDay) || { id: isoDay, name: dt.toLocaleDateString('en-US', { weekday: 'long' }) };
    return dayObj;
  }, [selectedDate]);

  // Maps
  const subjectsById = useMemo(() => {
    const map = {};
    config?.subjects?.forEach(s => map[s.id] = s);
    return map;
  }, [config]);

  const classesById = useMemo(() => {
    const map = {};
    config?.classes?.forEach(c => map[c.id] = c);
    return map;
  }, [config]);

  const teachersById = useMemo(() => {
    const map = {};
    config?.teachers?.forEach(t => map[t.id] = t);
    return map;
  }, [config]);

  // Use SENIOR tier period slots for teachers (superset of primary)
  const periodSlots = useMemo(() => {
    if (!config?.period_slots) return [];
    return config.period_slots.filter(p => p.tier === 'SENIOR' && p.day_of_week === 1);
  }, [config]);

  // Compute workload per day
  const workloadByDay = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    entries.forEach(e => {
      counts[e.day_of_week] = (counts[e.day_of_week] || 0) + 1;
    });
    return counts;
  }, [entries]);

  const substitutedCount = useMemo(() => {
    return entries.filter(e => e.is_substituted).length;
  }, [entries]);

  if (!config) return <div>Loading config...</div>;

  const selectedTeacher = teachersById[selectedTeacherId];
  const maxPeriods = selectedTeacher?.max_periods_per_day || 5;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Teacher Portal</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => api.downloadExport(schoolId, 'excel', token)}>Export Excel</button>
          <button className="btn btn-secondary" onClick={() => api.downloadExport(schoolId, 'pdf', token)}>Export PDF</button>
        </div>
      </div>

      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600 }}>View As (Teacher):</label>
        <select 
          className="select" 
          style={{ width: '250px' }} 
          value={selectedTeacherId} 
          onChange={e => setSelectedTeacherId(e.target.value)}
        >
          {config.teachers?.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Date-Aware Controls */}
      <div className="date-controls-bar">
        <div className="date-picker-group">
          <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Schedule Date:</label>
          <input 
            type="date" 
            className="input" 
            style={{ width: '160px', padding: '0.35rem 0.6rem' }} 
            value={selectedDate} 
            onChange={e => setSelectedDate(e.target.value)} 
          />
          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }} onClick={() => shiftDate(-1)} title="Previous Day">◀ Prev</button>
          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }} onClick={() => setSelectedDate(getTodayStr())}>Today</button>
          <button className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }} onClick={() => shiftDate(1)} title="Next Day">Next ▶</button>
          <span className="date-day-badge">{activeDayInfo.name}</span>
        </div>
        
        <div className="view-mode-toggle">
          <button 
            className={`view-mode-btn ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => setViewMode('day')}
          >
            📅 Day Schedule (Date-Aware)
          </button>
          <button 
            className={`view-mode-btn ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            🗓️ Full Week Template
          </button>
        </div>
      </div>

      {viewMode === 'day' && substitutedCount > 0 && (
        <div className="substitution-alert-box">
          <span style={{ fontSize: '1.25rem' }}>🔄</span>
          <div>
            <strong>Substitution Active Today ({activeDayInfo.name}, {selectedDate}):</strong> You are assigned as a substitute teacher for {substitutedCount} period(s) marked in orange below.
          </div>
        </div>
      )}

      {selectedTeacher && viewMode === 'week' && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {DAYS.map(day => {
            const count = workloadByDay[day.id] || 0;
            const ratio = Math.min(100, (count / maxPeriods) * 100);
            return (
              <div key={day.id} className="stat-card" style={{ padding: '1rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{day.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <span>{count} / {maxPeriods} periods</span>
                </div>
                <div style={{ height: '8px', background: 'var(--bg-color)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${ratio}%`, 
                    background: count > maxPeriods ? 'var(--danger-color)' : 'var(--primary-color)',
                    transition: 'width 0.3s ease'
                  }}></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {entries.length === 0 && !errorMsg ? (
        <div style={{ padding: '2rem', textAlign: 'center', background: 'white', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          {viewMode === 'day' 
            ? `No scheduled periods for ${selectedTeacher?.name || 'teacher'} on ${activeDayInfo.name} (${selectedDate}).` 
            : 'No timetable published yet.'}
        </div>
      ) : (
        <TimetableGrid 
          periodSlots={periodSlots}
          entries={entries}
          subjectsById={subjectsById}
          teachersById={teachersById}
          activityBlock={null} // Teachers don't see class-specific activity block styling here
          onCellClick={null}   // Read-only
          viewDate={viewMode === 'day' ? selectedDate : null}
          activeDayId={activeDayInfo.id}
          singleDay={viewMode === 'day'}
          metaLabel={(entry) => classesById[entry.class_section_id]?.name || 'Unknown Class'}
        />
      )}
    </div>
  );
}
