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

  if (!config) return <div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Loading configuration...</div>;

  const selectedTeacher = teachersById[selectedTeacherId];
  const maxPeriods = selectedTeacher?.max_periods_per_day || 5;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Teacher Portal</h2>
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
        <label style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>View As Teacher:</label>
        <select 
          className="select" 
          style={{ maxWidth: '300px', flex: '1 1 200px' }} 
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
            <strong>Substitution Active Today ({activeDayInfo.name}, {selectedDate}):</strong> You are assigned as a substitute teacher for {substitutedCount} period(s).
          </div>
        </div>
      )}

      {selectedTeacher && viewMode === 'week' && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          {DAYS.map(day => {
            const count = workloadByDay[day.id] || 0;
            const ratio = Math.min(100, (count / maxPeriods) * 100);
            return (
              <div key={day.id} className="stat-card" style={{ padding: '0.85rem 1rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.35rem' }}>{day.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>{count} / {maxPeriods} periods</span>
                </div>
                <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
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
        <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          {viewMode === 'day' 
            ? `No scheduled teaching periods for ${selectedTeacher?.name || 'teacher'} on ${activeDayInfo.name} (${selectedDate}).` 
            : 'No timetable entries published yet.'}
        </div>
      ) : (
        <TimetableGrid 
          periodSlots={periodSlots}
          entries={entries}
          subjectsById={subjectsById}
          teachersById={teachersById}
          activityBlock={null}
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

