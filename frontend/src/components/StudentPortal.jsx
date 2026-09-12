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

export default function StudentPortal({ schoolId, token }) {
  const [config, setConfig] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week'
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    loadConfig();
  }, [schoolId]);

  useEffect(() => {
    if (selectedClassId) {
      loadEntries();
    } else {
      setEntries([]);
    }
  }, [selectedClassId, selectedDate, viewMode]);

  const loadConfig = async () => {
    try {
      const data = await api.getConfig(schoolId, token);
      setConfig(data);
      if (data.classes?.length > 0) {
        setSelectedClassId(data.classes[0].id.toString());
      }
    } catch (e) {
      setErrorMsg('Failed to load config: ' + e.message);
    }
  };

  const loadEntries = async () => {
    try {
      setErrorMsg(null);
      if (viewMode === 'day') {
        const data = await api.getEffectiveTimetable(schoolId, selectedDate, selectedClassId, null, token);
        setEntries(data || []);
      } else {
        const data = await api.getEntries(schoolId, selectedClassId, null, token);
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

  const teachersById = useMemo(() => {
    const map = {};
    config?.teachers?.forEach(t => map[t.id] = t);
    return map;
  }, [config]);

  const classesById = useMemo(() => {
    const map = {};
    config?.classes?.forEach(c => map[c.id] = c);
    return map;
  }, [config]);

  // Derived Grid Props
  const selectedClass = classesById[selectedClassId];
  const selectedTier = selectedClass ? config?.grades?.find(g => g.id === selectedClass.grade_id)?.tier : null;
  
  // Use the exact tier's period slots for students
  const periodSlots = useMemo(() => {
    if (!config?.period_slots || !selectedTier) return [];
    return config.period_slots.filter(p => p.tier === selectedTier && p.day_of_week === 1);
  }, [config, selectedTier]);

  const activityBlock = useMemo(() => {
    if (!config?.activity_blocks || !selectedTier) return null;
    return config.activity_blocks.find(ab => ab.grade_tier === selectedTier);
  }, [config, selectedTier]);

  const substitutedCount = useMemo(() => {
    return entries.filter(e => e.is_substituted).length;
  }, [entries]);

  if (!config) return <div>Loading config...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ margin: 0 }}>Student Portal</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => api.downloadExport(schoolId, 'excel', token)}>Export Excel</button>
          <button className="btn btn-secondary" onClick={() => api.downloadExport(schoolId, 'pdf', token)}>Export PDF</button>
        </div>
      </div>

      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600 }}>View As (Class Section):</label>
        <select 
          className="select" 
          style={{ width: '250px' }} 
          value={selectedClassId} 
          onChange={e => setSelectedClassId(e.target.value)}
        >
          {config.classes?.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
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
            <strong>Teacher Substitution Notice ({activeDayInfo.name}, {selectedDate}):</strong> {substitutedCount} period(s) will be taught by a substitute teacher today, highlighted in orange below.
          </div>
        </div>
      )}

      {entries.length === 0 && !errorMsg ? (
        <div style={{ padding: '2rem', textAlign: 'center', background: 'white', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          {viewMode === 'day' 
            ? `No scheduled periods for ${selectedClass?.name || 'this class'} on ${activeDayInfo.name} (${selectedDate}).` 
            : 'No timetable published yet.'}
        </div>
      ) : (
        <TimetableGrid 
          periodSlots={periodSlots}
          entries={entries}
          subjectsById={subjectsById}
          teachersById={teachersById}
          activityBlock={activityBlock}
          onCellClick={null} // Read-only
          viewDate={viewMode === 'day' ? selectedDate : null}
          activeDayId={activeDayInfo.id}
          singleDay={viewMode === 'day'}
          metaLabel={(entry) => teachersById[entry.teacher_id]?.name || 'Unknown Teacher'}
        />
      )}
    </div>
  );
}
