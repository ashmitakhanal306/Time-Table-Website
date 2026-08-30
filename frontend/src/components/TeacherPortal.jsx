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

export default function TeacherPortal({ schoolId, token }) {
  const [config, setConfig] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
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
  }, [selectedTeacherId]);

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
      const data = await api.getEntries(schoolId, null, selectedTeacherId, token);
      setEntries(data);
    } catch (e) {
      setErrorMsg('Failed to load entries: ' + e.message);
    }
  };

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
      // We only count actual entries, not breaks
      counts[e.day_of_week] = (counts[e.day_of_week] || 0) + 1;
    });
    return counts;
  }, [entries]);

  if (!config) return <div>Loading config...</div>;

  const selectedTeacher = teachersById[selectedTeacherId];
  const maxPeriods = selectedTeacher?.max_periods_per_day || 5;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Teacher Portal</h2>
      </div>

      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <label style={{ fontWeight: 500 }}>View As (Teacher):</label>
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

      {selectedTeacher && (
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
          No timetable published yet.
        </div>
      ) : (
        <TimetableGrid 
          periodSlots={periodSlots}
          entries={entries}
          subjectsById={subjectsById}
          activityBlock={null} // Teachers don't see class-specific activity block styling here
          onCellClick={null}   // Read-only
          metaLabel={(entry) => classesById[entry.class_section_id]?.name || 'Unknown Class'}
        />
      )}
    </div>
  );
}
