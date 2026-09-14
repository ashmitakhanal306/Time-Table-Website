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

    // ── Pre-Generate preflight: check tier-level period slot coverage ─────────
    // Even if the global "Periods" badge looks done, verify each tier individually.
    // This catches the case where PRIMARY has slots but SENIOR has none, which
    // causes a blank grid in the Admin/Teacher/Student portals after generation.
    if (config) {
      const grades = config.grades || [];
      const slots  = config.period_slots || [];
      const activeTiers = [...new Set(grades.map(g => g.tier).filter(Boolean))];
      const missingTiers = activeTiers.filter(
        tier => !slots.some(s => s.tier === tier && !s.is_break)
      );
      if (missingTiers.length > 0) {
        setErrorMsg(
          `Cannot generate: the Period Structure has not been saved for ${missingTiers.join(', ')}. ` +
          `Go to Setup → Period Structure, select the missing tier, add slots, and click Save before generating.`
        );
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

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
    if (!subDate || !subPeriod || !subAbsentTeacher) { setSubError('Please fill all fields'); return; }
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
      setSuccessMsg('Substitute assigned successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch(e) {
      setSubError(e.message);
    }
  };

  if (!config) return <div style={{ padding: '2rem', color: 'var(--text-secondary)' }}>Loading configuration…</div>;

  return (
    <div>
      {/* ── Header bar ── */}
      <div className="page-header">
        <h2 className="page-title">Admin Portal</h2>
        <div className="btn-group">
          <button className="btn btn-secondary btn-sm" onClick={() => setDrawerOpen(true)}>
            <span>🔄</span>
            <span>Substitutions</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => api.downloadExport(schoolId, 'excel', token)}>
            <span>📊</span>
            <span>Excel</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => api.downloadExport(schoolId, 'pdf', token)}>
            <span>📄</span>
            <span>PDF</span>
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handlePublish}>
            <span>🚀</span>
            <span>Publish</span>
          </button>

          {/* ── Smart Generate Button ── */}
          <button
            className="btn btn-primary btn-sm"
            onClick={handleGenerate}
            disabled={loading || !canGenerate}
            title={generateTooltip}
          >
            <span>✨</span>
            <span>{loading ? 'Generating…' : 'Generate Timetable'}</span>
          </button>
        </div>
      </div>

      {/* ── Setup incomplete banner ── */}
      {!canGenerate && portalTab === 'Timetable' && (
        <div style={{
          padding: '0.85rem 1.1rem',
          marginBottom: '1.25rem',
          background: 'var(--warning-bg)',
          border: '1px solid var(--warning-border)',
          borderRadius: '10px',
          color: 'var(--warning-text)',
          fontSize: '0.875rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <strong>⚠️ Setup incomplete — timetable generation requires all required steps.</strong>
            <button
              style={{ background: 'var(--primary-color)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', padding: '0.3rem 0.75rem', borderRadius: '6px', fontFamily: 'inherit' }}
              onClick={() => setPortalTab('Setup')}
            >
              Complete Setup →
            </button>
          </div>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', lineHeight: 1.6, fontSize: '0.82rem' }}>
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
              padding: '0.65rem 1.35rem',
              fontWeight: portalTab === tab ? 700 : 500,
              color: portalTab === tab ? 'var(--primary-color)' : 'var(--text-secondary)',
              borderBottom: portalTab === tab ? '2px solid var(--primary-color)' : '2px solid transparent',
              marginBottom: '-2px',
              fontSize: '0.925rem',
              transition: 'all 0.15s',
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
      {successMsg && <div style={{ padding: '0.85rem 1rem', background: 'var(--success-bg)', color: 'var(--success-text)', borderRadius: '8px', marginBottom: '1.25rem', border: '1px solid var(--success-border)', fontSize: '0.875rem' }}>{successMsg}</div>}

      {portalTab === 'Setup' ? (
        <SchoolSetup schoolId={schoolId} token={token} config={config} reloadConfig={loadConfig} />
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-title">Classes</div>
              <div className="stat-value">{config.classes?.length || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Teachers</div>
              <div className="stat-value">{config.teachers?.length || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Subjects</div>
              <div className="stat-value">{config.subjects?.length || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-title">Requirements</div>
              <div className="stat-value">{config.requirements?.length || 0}</div>
            </div>
          </div>

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

          {config.classes?.length === 0 && (
            <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--surface-color)', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
              No classes configured yet.{' '}
              <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}
                onClick={() => setPortalTab('Setup')}>
                Go to School Setup →
              </button>
            </div>
          )}

          {config.classes?.length > 0 && entries.length === 0 && (
            <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--surface-color)', border: '1px dashed var(--border-color)', borderRadius: '12px', marginTop: '1rem' }}>
              No timetable entries yet for this class section.{' '}
              {canGenerate
                ? <span>Click <strong>Generate Timetable</strong> to automatically generate a schedule.</span>
                : <span>Complete the setup steps first, then click Generate Timetable.</span>}
            </div>
          )}

          <TimetableGrid 
            periodSlots={periodSlots}
            entries={entries}
            subjectsById={subjectsById}
            teachersById={teachersById}
            activityBlock={activityBlock}
            onCellClick={onCellClick}
            metaLabel={(entry) => teachersById[entry.teacher_id]?.name || 'Unknown'}
          />
        </>
      )}

      {/* Edit Modal */}
      {editingCell && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditingCell(null); }}>
          <div className="modal-content">
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Edit Timetable Slot</h3>
            {editError && <div className="error-banner" style={{ marginTop: '1rem' }}>{editError}</div>}
            
            <div style={{ marginTop: '1.25rem' }}>
              <div className="form-group">
                <label>Subject</label>
                <select className="select" value={editSubjectId} onChange={e => setEditSubjectId(e.target.value)}>
                  {config.subjects?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              
              <div className="form-group">
                <label>Teacher (Qualified Only)</label>
                <select className="select" value={editTeacherId} onChange={e => setEditTeacherId(e.target.value)}>
                  <option value="">-- Select Teacher --</option>
                  {qualifiedTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              
              <div className="form-group">
                <label>Room Name</label>
                <input className="input" type="text" placeholder="e.g. Lab 1, Room 204" value={editRoomName} onChange={e => setEditRoomName(e.target.value)} />
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingCell(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Subs Drawer Backdrop and Drawer */}
      {drawerOpen && (
        <>
          <div 
            className="modal-overlay"
            style={{ zIndex: 48 }}
            onClick={() => setDrawerOpen(false)}
          />
          <div className="drawer">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Substitutions</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => { setDrawerOpen(false); setSubCandidates([]); }}>✕ Close</button>
            </div>
            
            <div className="form-group">
              <label>Date</label>
              <input type="date" className="input" value={subDate} onChange={e => setSubDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Period Number</label>
              <input type="number" className="input" min="0" max="12" value={subPeriod} onChange={e => setSubPeriod(parseInt(e.target.value) || 1)} />
            </div>
            <div className="form-group">
              <label>Absent Teacher</label>
              <select className="select" value={subAbsentTeacher} onChange={e => setSubAbsentTeacher(e.target.value)}>
                <option value="">-- Select Absent Teacher --</option>
                {config.teachers?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '1.5rem' }} onClick={handleRecommendSubs}>
              Find Substitutes
            </button>
            
            {subError && <div className="error-banner">{subError}</div>}
            
            <div className="candidates-list" style={{ flex: 1, overflowY: 'auto' }}>
              {(Array.isArray(subCandidates) ? subCandidates : []).map((c, i) => (
                <div key={c.teacher_id} className={`sub-candidate ${i === 0 ? 'top-pick' : ''}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{c.teacher_name} {i === 0 && '🌟 Top Pick'}</div>
                    <button className="btn btn-primary btn-sm" onClick={() => handleAssignSub(c.teacher_id)}>Assign</button>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: c.qualified ? 'var(--text-secondary)' : 'var(--danger-text)' }}>
                    {c.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

