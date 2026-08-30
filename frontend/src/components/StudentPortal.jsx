import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import TimetableGrid from './TimetableGrid';

export default function StudentPortal({ schoolId, token }) {
  const [config, setConfig] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
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
  }, [selectedClassId]);

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
      const data = await api.getEntries(schoolId, selectedClassId, null, token);
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

  if (!config) return <div>Loading config...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Student Portal</h2>
      </div>

      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <label style={{ fontWeight: 500 }}>View As (Class Section):</label>
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

      {entries.length === 0 && !errorMsg ? (
        <div style={{ padding: '2rem', textAlign: 'center', background: 'white', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          No timetable published yet.
        </div>
      ) : (
        <TimetableGrid 
          periodSlots={periodSlots}
          entries={entries}
          subjectsById={subjectsById}
          activityBlock={activityBlock}
          onCellClick={null} // Read-only
          metaLabel={(entry) => teachersById[entry.teacher_id]?.name || 'Unknown Teacher'}
        />
      )}
    </div>
  );
}
