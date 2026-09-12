import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import TimetableGrid from './TimetableGrid';
import SchoolSetup, { getSetupSteps } from './SchoolSetup';

export default function AdminPortal({ schoolId, token }) {
  const [config, setConfig]               = useState(null);
  const [entries, setEntries]             = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  
  const [loading, setLoading]             = useState(false);
  const [errorMsg, setErrorMsg]           = useState(null);
  const [successMsg, setSuccessMsg]       = useState(null);
  
  // Modal state
  const [editingCell, setEditingCell]     = useState(null);
  const [editSubjectId, setEditSubjectId] = useState('');
  const [editTeacherId, setEditTeacherId] = useState('');
  const [editRoomName, setEditRoomName]   = useState('');
  const [editError, setEditError]         = useState(null);
  
  // Tab state
  const [portalTab, setPortalTab]         = useState('Timetable');

  // Drawer state
  const [drawerOpen, setDrawerOpen]             = useState(false);
  const [subDate, setSubDate]                   = useState('');
  const [subPeriod, setSubPeriod]               = useState(1);
  const [subAbsentTeacher, setSubAbsentTeacher] = useState('');
  const [subCandidates, setSubCandidates]       = useState([]);
  const [subError, setSubError]                 = useState(null);

  // Track whether we have auto-navigated on first empty config load
  const [hasAutoNavigated, setHasAutoNavigated] = useState(false);

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

  // Re-fetch config when switching back to Timetable tab so any changes
  // made in Setup are immediately reflected.
  useEffect(() => {
    if (portalTab === 'Timetable') {
      loadConfig();
    }
  }, [portalTab]);

  const loadConfig = async () => {
    try {
      const data = await api.getConfig(schoolId, token);
      setConfig(data);

      // Auto-navigate a fresh admin to Setup if nothing is configured yet
      if (
        !hasAutoNavigated &&
        (data.grades?.length === 0 || !data.grades) &&
        (data.classes?.length === 0 || !data.classes) &&
        (data.subjects?.length === 0 || !data.subjects)
      ) {
        setPortalTab('Setup');
        setHasAutoNavigated(true);
      }

      const validIds = new Set((data.classes || []).map(c => c.id.toString()));
      setSelectedClassId(prev => {
        if (prev && validIds.has(prev)) return prev;
        return data.classes?.length > 0 ? data.classes[0].id.toString() : '';
      });
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

  // ── Readiness computation ─────────────────────────────────────────────────
  const setupSteps = useMemo(() => (config ? getSetupSteps(config) : []), [config]);

  const blockingIssues = useMemo(() =>
    setupSteps.filter(s => s.blocking && !s.done).map(s => s.missingMsg),
    [setupSteps]
  );

  const canGenerate = blockingIssues.length === 0;

  const generateTooltip = canGenerate
    ? 'Generate a new timetable from your current configuration'
    : 'Cannot generate yet:\n• ' + blockingIssues.join('\n• ');

  // ─────────────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await api.generateTimetable(schoolId, token);
      if (res.status === 'INFEASIBLE') {
        setErrorMsg('Generation Failed: ' + res.infeasibility_reason);
      } else {
        setSuccessMsg(`Timetable generated successfully (${res.entry_count} entries, status: ${res.status}).`);
        if (selectedClassId) loadEntries();
      }
    } catch (e) {
      setErrorMsg('Generate error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      await api.publishTimetable(schoolId, true, token);
      setSuccessMsg('Timetable published successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e) {
      setErrorMsg('Publish error: ' + e.message);
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
  const selectedTier  = selectedClass ? config?.grades?.find(g => g.id === selectedClass.grade_id)?.tier : null;
  
  const periodSlots = useMemo(() => {
    if (!config?.period_slots || !selectedTier) return [];
    return config.period_slots.filter(p => p.tier === selectedTier && p.day_of_week === 1);
  }, [config, selectedTier]);

  const activityBlock = useMemo(() => {
    if (!config?.activity_blocks || !selectedTier) return null;
    return config.activity_blocks.find(ab => ab.grade_tier === selectedTier);
  }, [config, selectedTier]);

  const onCellClick = (entry, slot, day) => {
    if (!entry) return;
    setEditingCell({ entry, slot, day });
    setEditSubjectId(entry.subject_id.toString());
    setEditTeacherId(entry.teacher_id.toString());
    setEditRoomName(entry.room_name || '');
    setEditError(null);
  };

  const qualifiedTeachers = useMemo(() => {
    if (!config?.teachers || !editSubjectId) return [];
    return config.teachers.filter(t => t.qualified_subject_ids?.includes(parseInt(editSubjectId)));
  }, [config, editSubjectId]);

  useEffect(() => {
    if (editTeacherId && qualifiedTeachers.length > 0) {
      const isValid = qualifiedTeachers.some(t => t.id.toString() === editTeacherId);
      if (!isValid) setEditTeacherId('');
    }
  }, [editSubjectId, qualifiedTeachers]);

  const handleSaveEdit = async () => {
    if (!editTeacherId) { setEditError('Please select a teacher'); return; }
    setEditError(null);
    try {
      await api.overrideEntry(schoolId, editingCell.entry.id, {
        teacher_id: parseInt(editTeacherId),
        room_name:  editRoomName,
      }, token);
      setEditingCell(null);
      loadEntries();
    } catch (e) {
      setEditError(e.message);
    }
  };
  
  const handleRecommendSubs = async () => {
    if (!subDate || !subPeriod || !subAbsentTeacher) { setSubError('Fill all fields'); return; }
    setSubError(null);
    try {
      const candidates = await api.recommendSubstitutes(schoolId, subAbsentTeacher, subDate, subPeriod, token);
      setSubCandidates(Array.isArray(candidates) ? candidates : (candidates?.recommendations || []));
    } catch(e) {
      setSubError(e.message);
    }
  };
  
  const handleAssignSub = async (substituteId) => {
    try {
      await api.assignSubstitute(schoolId, {
        teacher_id:              parseInt(subAbsentTeacher),
        date:                    subDate,
        period_number:           parseInt(subPeriod),
        substitute_teacher_id:   substituteId,
      }, token);
      setSubCandidates([]);
      setDrawerOpen(false);
      setSuccessMsg('Substitute assigned successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch(e) {
      setSubError(e.message);
    }
  };

  if (!config) return <div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Loading config…</div>;

  return (
    <div>
      {/* ── Header bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Admin Portal</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => setDrawerOpen(true)}>Manage Substitutions</button>
          <button className="btn btn-secondary" onClick={() => api.downloadExport(schoolId, 'excel', token)}>Export Excel</button>
          <button className="btn btn-secondary" onClick={() => api.downloadExport(schoolId, 'pdf', token)}>Export PDF</button>
          <button className="btn btn-secondary" onClick={handlePublish}>Publish</button>

          {/* ── Smart Generate Button ── */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={loading || !canGenerate}
              title={generateTooltip}
              style={{
                opacity:    (!canGenerate || loading) ? 0.6 : 1,
                cursor:     (!canGenerate || loading) ? 'not-allowed' : 'pointer',
                position:   'relative',
              }}
            >
              {loading ? 'Generating…' : 'Generate Timetable'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Setup incomplete banner ── */}
      {!canGenerate && portalTab === 'Timetable' && (
        <div style={{
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          color: '#92400e',
          fontSize: '0.875rem',
        }}>
          <strong>⚠️ Setup incomplete — Generate Timetable is disabled.</strong>{' '}
          <button
            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', padding: 0, fontFamily: 'inherit' }}
            onClick={() => setPortalTab('Setup')}
          >
            Go to School Setup →
          </button>
          <ul style={{ marginTop: '0.4rem', paddingLeft: '1.25rem', lineHeight: 1.8 }}>
            {blockingIssues.map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
        </div>
      )}

      {/* ── Portal tab bar ── */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)' }}>
        {['Timetable', 'Setup'].map(tab => (
          <div
            key={tab}
            onClick={() => setPortalTab(tab)}
            style={{
              cursor: 'pointer',
              padding: '0.6rem 1.25rem',
              fontWeight: portalTab === tab ? 700 : 500,
              color: portalTab === tab ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: portalTab === tab ? '2px solid var(--primary-color)' : '2px solid transparent',
              marginBottom: '-2px',
              fontSize: '0.9rem',
              transition: 'color 0.15s',
            }}
          >
            {tab === 'Setup' && !canGenerate
              ? `${tab} ⚠️`
              : tab === 'Setup' && canGenerate
              ? `${tab} ✓`
              : tab}
          </div>
        ))}
      </div>

      {errorMsg   && <div className="error-banner">{errorMsg}</div>}
      {successMsg && <div style={{ padding: '1rem', background: '#dcfce3', color: '#166534', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #86efac' }}>{successMsg}</div>}

      {portalTab === 'Setup' ? (
        <SchoolSetup schoolId={schoolId} token={token} config={config} reloadConfig={loadConfig} />
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Classes</div>
              <div className="stat-value">{config.classes?.length || 0}</div>
            </div>
            <div className="stat-card">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Teachers</div>
              <div className="stat-value">{config.teachers?.length || 0}</div>
            </div>
            <div className="stat-card">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Subjects</div>
              <div className="stat-value">{config.subjects?.length || 0}</div>
            </div>
            <div className="stat-card">
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Requirements</div>
              <div className="stat-value">{config.requirements?.length || 0}</div>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ marginRight: '1rem', fontWeight: 500 }}>Select Class Section:</label>
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

          {config.classes?.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', background: '#f8fafc', border: '1px dashed var(--border-color)', borderRadius: 8 }}>
              No classes configured yet.{' '}
              <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
                onClick={() => setPortalTab('Setup')}>
                Go to School Setup →
              </button>
            </div>
          )}

          {config.classes?.length > 0 && entries.length === 0 && (
            <div style={{ padding: '1.5rem 2rem', textAlign: 'center', color: 'var(--text-secondary)', background: '#f8fafc', border: '1px dashed var(--border-color)', borderRadius: 8, marginTop: '1rem' }}>
              No timetable entries yet for this class.{' '}
              {canGenerate
                ? <span>Click <strong>Generate Timetable</strong> to create one.</span>
                : <span>Complete setup first, then Generate Timetable.</span>}
            </div>
          )}

          <TimetableGrid 
            periodSlots={periodSlots}
            entries={entries}
            subjectsById={subjectsById}
            activityBlock={activityBlock}
            onCellClick={onCellClick}
            metaLabel={(entry) => teachersById[entry.teacher_id]?.name || 'Unknown'}
          />
        </>
      )}

      {/* Edit Modal */}
      {editingCell && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit Entry</h3>
            {editError && <div className="error-banner" style={{ marginTop: '1rem' }}>{editError}</div>}
            
            <div style={{ marginTop: '1.5rem' }}>
              <div className="form-group">
                <label>Subject</label>
                <select className="select" value={editSubjectId} onChange={e => setEditSubjectId(e.target.value)}>
                  {config.subjects?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Teacher (Qualified Only)</label>
                <select className="select" value={editTeacherId} onChange={e => setEditTeacherId(e.target.value)}>
                  <option value="">-- Select Teacher --</option>
                  {qualifiedTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Room Name</label>
                <input className="input" type="text" value={editRoomName} onChange={e => setEditRoomName(e.target.value)} />
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingCell(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Subs Drawer */}
      {drawerOpen && (
        <div className="drawer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2>Substitutions</h2>
            <button className="btn btn-secondary" onClick={() => { setDrawerOpen(false); setSubCandidates([]); }}>Close</button>
          </div>
          
          <div className="form-group">
            <label>Date</label>
            <input type="date" className="input" value={subDate} onChange={e => setSubDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Period Number</label>
            <input type="number" className="input" min="1" value={subPeriod} onChange={e => setSubPeriod(parseInt(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Absent Teacher</label>
            <select className="select" value={subAbsentTeacher} onChange={e => setSubAbsentTeacher(e.target.value)}>
              <option value="">-- Select --</option>
              {config.teachers?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: '2rem' }} onClick={handleRecommendSubs}>Find Substitutes</button>
          
          {subError && <div className="error-banner">{subError}</div>}
          
          <div className="candidates-list">
            {(Array.isArray(subCandidates) ? subCandidates : []).map((c, i) => (
              <div key={c.teacher_id} className={`sub-candidate ${i === 0 ? 'top-pick' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 600 }}>{c.teacher_name} {i === 0 && '(Top Pick)'}</div>
                  <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }} onClick={() => handleAssignSub(c.teacher_id)}>Assign</button>
                </div>
                <div style={{ fontSize: '0.875rem', color: c.qualified ? 'var(--text-secondary)' : 'var(--danger-color)' }}>
                  {c.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
