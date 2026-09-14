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

  if (!config) return <div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Loading configuration...</div>;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Student Portal</h2>
        <div className="btn-group">
          <button className="btn btn-secondary btn-sm" onClick={() => api.downloadExport(schoolId, 'excel', token)}>
            <span>📊</span>
            <span>Export Excel</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => api.downloadExport(schoolId, 'pdf', token)}>
            <span>📄</span>
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      <div style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <label style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Select Class Section:</label>
        <select 
          className="select" 
          style={{ maxWidth: '300px', flex: '1 1 200px' }} 
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
          <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Date:</label>
          <input 
            type="date" 
            className="input" 
            style={{ width: 'auto', minWidth: '135px', padding: '0.35rem 0.6rem' }} 
            value={selectedDate} 
            onChange={e => setSelectedDate(e.target.value)} 
          />
          <div style={{ display: 'inline-flex', gap: '4px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => shiftDate(-1)} title="Previous Day">◀</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDate(getTodayStr())}>Today</button>
            <button className="btn btn-secondary btn-sm" onClick={() => shiftDate(1)} title="Next Day">▶</button>
          </div>
          <span className="date-day-badge">{activeDayInfo.name}</span>
        </div>
        
        <div className="view-mode-toggle">
          <button 
            className={`view-mode-btn ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => setViewMode('day')}
          >
            📅 Day View
          </button>
          <button 
            className={`view-mode-btn ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            🗓️ Week Template
          </button>
        </div>
      </div>

      {viewMode === 'day' && substitutedCount > 0 && (
        <div className="substitution-alert-box">
          <span style={{ fontSize: '1.25rem' }}>🔄</span>
          <div>
            <strong>Teacher Substitution Notice ({activeDayInfo.name}, {selectedDate}):</strong> {substitutedCount} period(s) taught by a substitute teacher today.
          </div>
        </div>
      )}

      {entries.length === 0 && !errorMsg ? (
        <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          {viewMode === 'day' 
            ? `No scheduled periods for ${selectedClass?.name || 'this class'} on ${activeDayInfo.name} (${selectedDate}).` 
            : 'No timetable published yet for this class section.'}
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

