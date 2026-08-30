import React, { useState } from 'react';
import { api } from '../api';

// ─── Progress Checklist ──────────────────────────────────────────────────────
// Returns an array of step descriptors used both for the checklist strip and
// for computing whether the Generate button should be enabled.
export function getSetupSteps(config) {
  const grades     = config?.grades     || [];
  const classes    = config?.classes    || [];
  const subjects   = config?.subjects   || [];
  const teachers   = config?.teachers   || [];
  const reqs       = config?.requirements || [];
  const slots      = config?.period_slots || [];
  const blocks     = config?.activity_blocks || [];

  const nonBreakSlots = slots.filter(s => !s.is_break);

  return [
    {
      key:    'grades',
      label:  '1. Grades',
      short:  'Grades',
      done:   grades.length > 0,
      count:  grades.length,
      unit:   'grade',
      blocking: true,
      missingMsg: 'No grade tiers defined',
    },
    {
      key:    'classes',
      label:  '2. Classes',
      short:  'Classes',
      done:   classes.length > 0,
      count:  classes.length,
      unit:   'class',
      blocking: true,
      depUnmet: grades.length === 0,
      depLabel: 'Add at least one grade first',
      missingMsg: 'No class sections defined',
    },
    {
      key:    'subjects',
      label:  '3. Subjects',
      short:  'Subjects',
      done:   subjects.length > 0,
      count:  subjects.length,
      unit:   'subject',
      blocking: true,
      missingMsg: 'No subjects defined',
    },
    {
      key:    'teachers',
      label:  '4. Teachers',
      short:  'Teachers',
      done:   teachers.length > 0,
      count:  teachers.length,
      unit:   'teacher',
      blocking: true,
      depUnmet: subjects.length === 0,
      depLabel: 'Add subjects first so teachers can have qualifications',
      missingMsg: 'No teachers defined',
    },
    {
      key:    'requirements',
      label:  '5. Requirements',
      short:  'Requirements',
      done:   reqs.length > 0,
      count:  reqs.length,
      unit:   'requirement',
      blocking: true,
      depUnmet: classes.length === 0 || subjects.length === 0,
      depLabel: 'Add classes and subjects first',
      missingMsg: 'No subject requirements defined for any class',
    },
    {
      key:    'period_structure',
      label:  '7. Period Structure',
      short:  'Periods',
      done:   nonBreakSlots.length > 0,
      count:  nonBreakSlots.length,
      unit:   'teaching slot',
      blocking: true,
      missingMsg: 'No period structure saved (need at least one non-break slot)',
    },
    {
      key:    'activity_blocks',
      label:  '6. Activity Blocks',
      short:  'Activities',
      done:   blocks.length > 0,
      count:  blocks.length,
      unit:   'block',
      blocking: false,
      depUnmet: subjects.filter(s => s.is_activity).length === 0,
      depLabel: 'Add an activity subject first',
      missingMsg: 'No activity blocks (optional)',
    },
  ];
}

function SetupProgress({ config, activeTab, onTabClick }) {
  const steps = getSetupSteps(config);
  // Map step keys to tab names
  const keyToTab = {
    grades:           'Grades',
    classes:          'Classes',
    subjects:         'Subjects',
    teachers:         'Teachers',
    requirements:     'Requirements',
    activity_blocks:  'Activity Blocks',
    period_structure: 'Period Structure',
  };

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.4rem',
      marginBottom: '1.25rem',
      padding: '0.75rem 1rem',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '10px',
    }}>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', alignSelf: 'center', marginRight: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Setup:
      </span>
      {steps.map(step => {
        const tabName = keyToTab[step.key];
        const isActive = activeTab === tabName;
        const bg   = step.done ? '#dcfce7' : step.blocking ? '#fef9c3' : '#f1f5f9';
        const border = step.done ? '#86efac' : step.blocking ? '#fde68a' : '#e2e8f0';
        const textColor = step.done ? '#166534' : step.blocking ? '#92400e' : '#64748b';
        const icon = step.done ? '✓' : step.blocking ? '!' : '○';
        return (
          <button
            key={step.key}
            onClick={() => onTabClick(tabName)}
            title={step.done
              ? `${step.count} ${step.unit}${step.count !== 1 ? 's' : ''} configured`
              : step.blocking ? step.missingMsg : step.missingMsg}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.25rem 0.6rem',
              borderRadius: '20px',
              border: `1px solid ${border}`,
              background: isActive ? (step.done ? '#bbf7d0' : '#fef08a') : bg,
              color: textColor,
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: isActive ? `2px solid ${step.done ? '#16a34a' : '#ca8a04'}` : 'none',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
          >
            <span>{icon}</span>
            <span>{step.short}</span>
            {step.done && (
              <span style={{ fontWeight: 400 }}>({step.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Dependency Warning Banner ────────────────────────────────────────────────
function DepWarning({ message }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.6rem 1rem',
      marginBottom: '1rem',
      background: '#fffbeb',
      border: '1px solid #fde68a',
      borderRadius: '8px',
      color: '#92400e',
      fontSize: '0.875rem',
    }}>
      <span style={{ fontSize: '1rem' }}>⚠️</span>
      <span>{message}</span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SchoolSetup({ schoolId, token, config, reloadConfig }) {
  const [activeTab, setActiveTab] = useState('Grades');
  const [errorMsg, setErrorMsg]   = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Tab definitions — ordered by dependency
  const tabs = [
    'Grades',
    'Classes',
    'Subjects',
    'Teachers',
    'Requirements',
    'Activity Blocks',
    'Period Structure',
  ];

  const tabLabels = {
    'Grades':           '1 · Grades',
    'Classes':          '2 · Classes',
    'Subjects':         '3 · Subjects',
    'Teachers':         '4 · Teachers',
    'Requirements':     '5 · Requirements',
    'Activity Blocks':  '6 · Activity Blocks',
    'Period Structure': '7 · Period Structure',
  };

  const wrapAction = async (actionFn) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await actionFn();
      setSuccessMsg('Saved successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
      reloadConfig();
    } catch (e) {
      setErrorMsg(e.message);
    }
  };

  const deleteEntity = (entityType, id) => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    wrapAction(() => api.deleteConfigEntity(schoolId, entityType, id, token));
  };

  // ── Form State ──
  const [gradeForm, setGradeForm] = useState({ name: '', tier: 'PRIMARY', day_end_time: '15:00' });

  // Classes: split into gradeId + section for clarity; combined on submit
  const [classGradeId, setClassGradeId] = useState('');
  const [classSection, setClassSection] = useState('');

  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', is_activity: false, weekly_frequency_default: 5 });

  const [teacherForm, setTeacherForm] = useState({ name: '', email: '', max_periods_per_day: 5, qualified_subject_ids: [] });
  const [editingTeacherId, setEditingTeacherId] = useState(null);
  const [editTeacherForm, setEditTeacherForm] = useState({ name: '', email: '', max_periods_per_day: 5, qualified_subject_ids: [] });

  const [reqForm, setReqForm] = useState({ class_section_id: '', subject_id: '', weekly_frequency: 5 });

  const [abForm, setAbForm] = useState({ grade_tier: 'PRIMARY', day_of_week: 1, start_period: 1, end_period: 2, activity_types: [] });

  // Period structure
  const DEFAULT_PERIOD_ROWS = [
    { period_number: 0,  start_time: '07:30', end_time: '08:00', is_break: false, slot_type: 'ZERO' },
    { period_number: 1,  start_time: '08:00', end_time: '08:40', is_break: false, slot_type: 'REGULAR' },
    { period_number: 2,  start_time: '08:40', end_time: '09:20', is_break: false, slot_type: 'REGULAR' },
    { period_number: 3,  start_time: '09:20', end_time: '09:35', is_break: true,  slot_type: 'SHORT_BREAK' },
    { period_number: 4,  start_time: '09:35', end_time: '10:15', is_break: false, slot_type: 'REGULAR' },
    { period_number: 5,  start_time: '10:15', end_time: '10:55', is_break: false, slot_type: 'REGULAR' },
    { period_number: 6,  start_time: '10:55', end_time: '11:25', is_break: true,  slot_type: 'LUNCH' },
    { period_number: 7,  start_time: '11:25', end_time: '12:05', is_break: false, slot_type: 'REGULAR' },
  ];
  const [periodTier, setPeriodTier]   = useState('PRIMARY');
  const [periodRows, setPeriodRows]   = useState(DEFAULT_PERIOD_ROWS);

  // ── Helpers ──
  const toggleSubjectInForm = (formState, setFormState, subjectId) => {
    const ids    = formState.qualified_subject_ids;
    const newIds = ids.includes(subjectId) ? ids.filter(id => id !== subjectId) : [...ids, subjectId];
    setFormState({ ...formState, qualified_subject_ids: newIds });
  };

  const startEditTeacher = (t) => {
    setEditingTeacherId(t.id);
    setEditTeacherForm({
      name:                  t.name,
      email:                 t.email,
      max_periods_per_day:   t.max_periods_per_day,
      qualified_subject_ids: [...(t.qualified_subject_ids || [])],
    });
  };

  const saveEditTeacher = (teacherId) => {
    wrapAction(() => api.updateConfigEntity(schoolId, 'teachers', teacherId, editTeacherForm, token));
    setEditingTeacherId(null);
  };

  const updatePeriodRow = (idx, field, value) => {
    setPeriodRows(rows => rows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addPeriodRow = () => {
    const last   = periodRows[periodRows.length - 1];
    const lastEnd = last?.end_time || '08:00';
    const [h, m] = lastEnd.split(':').map(Number);
    const newStart    = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const newEndMins  = h * 60 + m + 40;
    const newEnd      = `${String(Math.floor(newEndMins / 60)).padStart(2, '0')}:${String(newEndMins % 60).padStart(2, '0')}`;
    const nextNum     = (last?.period_number ?? -1) + 1;
    setPeriodRows(rows => [...rows, { period_number: nextNum, start_time: newStart, end_time: newEnd, is_break: false, slot_type: 'REGULAR' }]);
  };

  const removePeriodRow = (idx) => {
    setPeriodRows(rows => rows.filter((_, i) => i !== idx));
  };

  const slotTypeOptions = ['ZERO', 'REGULAR', 'SHORT_BREAK', 'LUNCH'];

  const SLOT_TYPE_LABELS = {
    ZERO:        { label: '⭕ Zero Period',   hint: 'Before school starts (assembly, optional)' },
    REGULAR:     { label: '📚 Teaching',      hint: 'Regular teaching period' },
    SHORT_BREAK: { label: '☕ Short Break',   hint: 'Mid-morning recess — no teaching' },
    LUNCH:       { label: '🍽️ Lunch Break',   hint: 'Lunch — no teaching' },
  };

  const SLOT_TYPE_COLORS = {
    ZERO:        { bg: '#f0f4ff', border: '#c7d2fe', text: '#3730a3' },
    REGULAR:     { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
    SHORT_BREAK: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    LUNCH:       { bg: '#fff1f2', border: '#fecdd3', text: '#9f1239' },
  };

  // ── Derived helpers for lookup ──
  const classesById   = Object.fromEntries((config?.classes   || []).map(c => [c.id, c]));
  const subjectsById  = Object.fromEntries((config?.subjects  || []).map(s => [s.id, s]));

  // ── Steps for per-tab dependency checks ──
  const steps         = getSetupSteps(config);
  const stepByKey     = Object.fromEntries(steps.map(s => [s.key, s]));

  // ── Renderers ───────────────────────────────────────────────────────────────

  const renderGrades = () => (
    <div>
      <h3 style={{ marginBottom: '0.4rem' }}>Grade Tiers</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
        A <strong>Grade Tier</strong> groups related grades and controls which timetable structure they use.
        <span style={{ display: 'block', marginTop: '0.4rem' }}>
          🔵 <strong>Primary</strong> — younger classes, typically a shorter school day (e.g. ends at noon).<br/>
          🟣 <strong>Senior</strong> — older classes, longer day with more periods (e.g. ends at 2 pm).
        </span>
      </p>

      <table className="table" style={{ width: '100%', marginBottom: '1.5rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Grade Tier</th>
            <th>School day ends at</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {(config?.grades || []).map(g => (
            <tr key={g.id}>
              <td style={{ fontWeight: 600 }}>{g.name}</td>
              <td>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '3px 12px', borderRadius: '12px',
                  background: g.tier === 'PRIMARY' ? '#dbeafe' : '#ede9fe',
                  color: g.tier === 'PRIMARY' ? '#1d4ed8' : '#7c3aed',
                  fontSize: '0.8rem', fontWeight: 700,
                }}>
                  {g.tier === 'PRIMARY' ? '🔵' : '🟣'} {g.tier === 'PRIMARY' ? 'Primary' : 'Senior'}
                </span>
              </td>
              <td style={{ fontWeight: 500 }}>
                🕐 {g.day_end_time}
                <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  ({g.tier === 'PRIMARY' ? 'shorter day' : 'full day'})
                </span>
              </td>
              <td>
                <button className="btn btn-secondary" style={{ color: 'var(--danger-color)', fontSize: '0.85rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => deleteEntity('grades', g.id)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {(config?.grades || []).length === 0 && (
            <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem' }}>No grades yet — add one below.</td></tr>
          )}
        </tbody>
      </table>

      <h4 style={{ marginBottom: '0.75rem' }}>Add Grade</h4>
      <div style={{ background: '#f9fafb', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 560 }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={labelStyle}>Grade Name</label>
            <input className="input" style={{ width: '100%' }} placeholder="e.g. Grade 5 or Primary A"
              value={gradeForm.name}
              onChange={e => setGradeForm({ ...gradeForm, name: e.target.value })} />
          </div>

          <div style={{ minWidth: 200 }}>
            <label style={labelStyle}>Grade Tier</label>
            <select className="select" style={{ width: '100%' }} value={gradeForm.tier}
              onChange={e => setGradeForm({ ...gradeForm, tier: e.target.value, day_end_time: e.target.value === 'PRIMARY' ? '12:00' : '14:00' })}>
              <option value="PRIMARY">🔵 Primary — shorter day</option>
              <option value="SENIOR">🟣 Senior — full/longer day</option>
            </select>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0', lineHeight: 1.4 }}>
              {gradeForm.tier === 'PRIMARY'
                ? 'Primary tiers get their own shorter period structure.'
                : 'Senior tiers run later in the day with more periods.'}
            </p>
          </div>
        </div>

        <div>
          <label style={labelStyle}>School day ends at</label>
          <input type="time" className="input" value={gradeForm.day_end_time}
            onChange={e => setGradeForm({ ...gradeForm, day_end_time: e.target.value })} style={{ width: 140 }} />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0', lineHeight: 1.4 }}>
            This marks when this tier's school day finishes — e.g. 12:00 for Primary, 14:00 for Senior.
          </p>
        </div>

        <div>
          <button className="btn btn-primary"
            onClick={() => wrapAction(() =>
              api.createConfigEntity(schoolId, 'grades', gradeForm, token)
                .then(() => setGradeForm({ name: '', tier: 'PRIMARY', day_end_time: '12:00' }))
            )}>
            Add Grade
          </button>
        </div>
      </div>
    </div>
  );

  const renderClasses = () => {
    const depStep = stepByKey['classes'];
    const gradesMap = Object.fromEntries((config?.grades || []).map(g => [g.id, g]));

    const handleAddClass = () => {
      if (!classGradeId) return;
      const grade = gradesMap[parseInt(classGradeId)];
      const section = classSection.trim();
      // Combine: if grade name already ends with section don't double-append
      const combinedName = section ? `${grade?.name ?? classGradeId}${section}` : grade?.name ?? String(classGradeId);
      wrapAction(() =>
        api.createConfigEntity(schoolId, 'classes', { name: combinedName, grade_id: parseInt(classGradeId) }, token)
          .then(() => { setClassGradeId(''); setClassSection(''); })
      );
    };

    // Preview name
    const previewGrade = classGradeId ? gradesMap[parseInt(classGradeId)] : null;
    const previewName = previewGrade
      ? (classSection.trim() ? `${previewGrade.name}${classSection.trim()}` : previewGrade.name)
      : '';

    return (
      <div>
        <h3 style={{ marginBottom: '0.4rem' }}>Class Sections</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          A class section is a single group of students (e.g. <strong>Grade 5 — Section A</strong>).
          Pick the grade it belongs to, then give the section a letter. You'll set which subjects each class has in the <em>Requirements</em> step.
        </p>
        {depStep.depUnmet && <DepWarning message={depStep.depLabel} />}

        <table className="table" style={{ width: '100%', marginBottom: '1.5rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Class Name</th>
              <th>Grade</th>
              <th>Tier</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(config?.classes || []).map(c => {
              const grade = gradesMap[c.grade_id];
              return (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{grade?.name ?? `#${c.grade_id}`}</td>
                  <td>
                    {grade ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        padding: '2px 10px', borderRadius: '12px',
                        background: grade.tier === 'PRIMARY' ? '#dbeafe' : '#ede9fe',
                        color: grade.tier === 'PRIMARY' ? '#1d4ed8' : '#7c3aed',
                        fontSize: '0.78rem', fontWeight: 700,
                      }}>
                        {grade.tier === 'PRIMARY' ? '🔵' : '🟣'} {grade.tier === 'PRIMARY' ? 'Primary' : 'Senior'}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <button className="btn btn-secondary" style={{ color: 'var(--danger-color)', fontSize: '0.85rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => deleteEntity('classes', c.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
            {(config?.classes || []).length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem' }}>No classes yet — add one below.</td></tr>
            )}
          </tbody>
        </table>

        <h4 style={{ marginBottom: '0.75rem' }}>Add Class Section</h4>
        <div style={{ background: '#f9fafb', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1.25rem', maxWidth: 520 }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div style={{ flex: 2, minWidth: 180 }}>
              <label style={labelStyle}>Grade</label>
              <select className="select" style={{ width: '100%' }} value={classGradeId}
                onChange={e => setClassGradeId(e.target.value)}
                disabled={depStep.depUnmet}>
                <option value="">— Select a grade —</option>
                {(config?.grades || []).map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.tier === 'PRIMARY' ? 'Primary' : 'Senior'})
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>Which grade does this class belong to?</p>
            </div>

            <div style={{ flex: 1, minWidth: 100 }}>
              <label style={labelStyle}>Section</label>
              <input className="input" style={{ width: '100%' }} placeholder="e.g. A, B, C"
                value={classSection}
                onChange={e => setClassSection(e.target.value.toUpperCase())}
                disabled={depStep.depUnmet} />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>Section letter (or leave blank).</p>
            </div>
          </div>

          {previewName && (
            <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '0.875rem' }}>
              📋 Class will be saved as: <strong>{previewName}</strong>
            </div>
          )}

          <button className="btn btn-primary"
            disabled={depStep.depUnmet || !classGradeId}
            title={depStep.depUnmet ? depStep.depLabel : !classGradeId ? 'Select a grade first' : undefined}
            onClick={handleAddClass}>
            Add Class Section
          </button>
        </div>
      </div>
    );
  };

  const renderSubjects = () => (
    <div>
      <h3 style={{ marginBottom: '1rem' }}>Subjects</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
        Mark a subject as <strong>Activity</strong> if it's used in activity blocks (e.g., PT, Music). Activity subjects use their code in Activity Block configuration.
      </p>
      <table className="table" style={{ width: '100%', marginBottom: '1.5rem', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th>Name</th><th>Code</th><th>Activity?</th><th>Default Freq/Week</th><th>Action</th></tr>
        </thead>
        <tbody>
          {(config?.subjects || []).map(s => (
            <tr key={s.id}>
              <td style={{ fontWeight: 500 }}>{s.name}</td>
              <td><code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, fontSize: '0.85rem' }}>{s.code}</code></td>
              <td style={{ textAlign: 'center' }}>
                {s.is_activity
                  ? <span style={{ padding: '2px 8px', borderRadius: 12, background: '#fef9c3', color: '#92400e', fontSize: '0.8rem', fontWeight: 600 }}>Activity</span>
                  : <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>—</span>}
              </td>
              <td style={{ textAlign: 'center' }}>{s.weekly_frequency_default}</td>
              <td>
                <button className="btn btn-secondary" style={{ color: 'var(--danger-color)', fontSize: '0.85rem', padding: '0.3rem 0.6rem' }}
                  onClick={() => deleteEntity('subjects', s.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {(config?.subjects || []).length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem' }}>No subjects yet — add one below.</td></tr>
          )}
        </tbody>
      </table>

      <h4 style={{ marginBottom: '0.75rem' }}>Add Subject</h4>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap', background: '#f9fafb', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
        <div>
          <label style={labelStyle}>Subject Name</label>
          <input className="input" placeholder="e.g. Mathematics" value={subjectForm.name}
            onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })} style={{ width: 160 }} />
        </div>
        <div>
          <label style={labelStyle}>Code (short)</label>
          <input className="input" placeholder="e.g. MATH" value={subjectForm.code}
            onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })} style={{ width: 100 }} />
        </div>
        <div>
          <label style={labelStyle}>Default Freq/Week</label>
          <input type="number" className="input" min={0} max={10} value={subjectForm.weekly_frequency_default}
            onChange={e => setSubjectForm({ ...subjectForm, weekly_frequency_default: parseInt(e.target.value) || 0 })} style={{ width: 90 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingBottom: '0.25rem' }}>
          <input type="checkbox" id="is_activity_chk" checked={subjectForm.is_activity}
            onChange={e => setSubjectForm({ ...subjectForm, is_activity: e.target.checked })} style={{ width: 16, height: 16 }} />
          <label htmlFor="is_activity_chk" style={{ fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>Activity subject</label>
        </div>
        <button className="btn btn-primary"
          onClick={() => wrapAction(() =>
            api.createConfigEntity(schoolId, 'subjects', subjectForm, token)
              .then(() => setSubjectForm({ name: '', code: '', is_activity: false, weekly_frequency_default: 5 }))
          )}>
          Add Subject
        </button>
      </div>
    </div>
  );

  const renderTeachers = () => {
    const depStep = stepByKey['teachers'];
    return (
      <div>
        <h3 style={{ marginBottom: '1rem' }}>Teachers</h3>
        {depStep.depUnmet && <DepWarning message={depStep.depLabel} />}
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Assign which subjects each teacher can teach. The solver only assigns a teacher to a class-period if they are qualified for that subject.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', marginBottom: '1.5rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 40 }}>ID</th>
                <th style={{ minWidth: 140 }}>Name</th>
                <th style={{ minWidth: 180 }}>Email</th>
                <th style={{ minWidth: 100 }}>Max/Day</th>
                <th style={{ minWidth: 220 }}>Qualified Subjects</th>
                <th style={{ minWidth: 160 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(config?.teachers || []).map(t => (
                editingTeacherId === t.id ? (
                  <tr key={t.id} style={{ background: '#f0f7ff' }}>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t.id}</td>
                    <td>
                      <input className="input" style={{ width: '100%', minWidth: 120 }}
                        value={editTeacherForm.name}
                        onChange={e => setEditTeacherForm({ ...editTeacherForm, name: e.target.value })} />
                    </td>
                    <td>
                      <input className="input" style={{ width: '100%', minWidth: 160 }}
                        value={editTeacherForm.email}
                        onChange={e => setEditTeacherForm({ ...editTeacherForm, email: e.target.value })} />
                    </td>
                    <td>
                      <input type="number" className="input" style={{ width: 70 }} min={1} max={10}
                        value={editTeacherForm.max_periods_per_day}
                        onChange={e => setEditTeacherForm({ ...editTeacherForm, max_periods_per_day: parseInt(e.target.value) || 1 })} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {(config?.subjects || []).map(s => (
                          <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', background: editTeacherForm.qualified_subject_ids.includes(s.id) ? '#dbeafe' : '#f3f4f6', border: editTeacherForm.qualified_subject_ids.includes(s.id) ? '1px solid #93c5fd' : '1px solid #e5e7eb' }}>
                            <input type="checkbox"
                              checked={editTeacherForm.qualified_subject_ids.includes(s.id)}
                              onChange={() => toggleSubjectInForm(editTeacherForm, setEditTeacherForm, s.id)} />
                            {s.name}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => saveEditTeacher(t.id)}>Save</button>
                        <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => setEditingTeacherId(null)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id}>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t.id}</td>
                    <td style={{ fontWeight: 500 }}>{t.name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{t.email}</td>
                    <td style={{ textAlign: 'center' }}>{t.max_periods_per_day}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {(t.qualified_subject_ids || []).map(sid => {
                          const subj = subjectsById[sid];
                          return subj ? (
                            <span key={sid} style={{ padding: '2px 8px', borderRadius: '12px', background: '#e0f2fe', color: '#0369a1', fontSize: '0.8rem', fontWeight: 500 }}>
                              {subj.name}
                            </span>
                          ) : null;
                        })}
                        {(t.qualified_subject_ids || []).length === 0 && (
                          <span style={{ color: 'var(--danger-color)', fontSize: '0.8rem', fontStyle: 'italic' }}>No subjects — teacher can't be assigned!</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => startEditTeacher(t)}>Edit</button>
                        <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', color: 'var(--danger-color)' }} onClick={() => deleteEntity('teachers', t.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
              {(config?.teachers || []).length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem' }}>No teachers yet — add one below.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <h4 style={{ marginBottom: '0.75rem' }}>Add New Teacher</h4>
        <div style={{ background: '#f9fafb', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 620 }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={labelStyle}>Full Name</label>
              <input className="input" style={{ width: '100%' }} placeholder="e.g. Priya Sharma"
                value={teacherForm.name}
                onChange={e => setTeacherForm({ ...teacherForm, name: e.target.value })} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={labelStyle}>Email</label>
              <input className="input" style={{ width: '100%' }} placeholder="e.g. priya@school.edu"
                value={teacherForm.email}
                onChange={e => setTeacherForm({ ...teacherForm, email: e.target.value })} />
            </div>
            <div style={{ minWidth: 130 }}>
              <label style={labelStyle}>Max Periods/Day</label>
              <input type="number" className="input" style={{ width: '100%' }} min={1} max={10}
                value={teacherForm.max_periods_per_day}
                onChange={e => setTeacherForm({ ...teacherForm, max_periods_per_day: parseInt(e.target.value) || 1 })} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Qualified Subjects <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(check all they can teach)</span></label>
            {(config?.subjects || []).length === 0
              ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontStyle: 'italic' }}>No subjects yet — add subjects first.</p>
              : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                  {(config?.subjects || []).map(s => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem', cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', background: teacherForm.qualified_subject_ids.includes(s.id) ? '#dbeafe' : '#f3f4f6', border: teacherForm.qualified_subject_ids.includes(s.id) ? '1px solid #93c5fd' : '1px solid #e5e7eb', transition: 'all 0.15s' }}>
                      <input type="checkbox"
                        checked={teacherForm.qualified_subject_ids.includes(s.id)}
                        onChange={() => toggleSubjectInForm(teacherForm, setTeacherForm, s.id)} />
                      {s.name}
                    </label>
                  ))}
                </div>
              )}
          </div>
          <div>
            <button className="btn btn-primary"
              onClick={() => wrapAction(() =>
                api.createConfigEntity(schoolId, 'teachers', teacherForm, token)
                  .then(() => setTeacherForm({ name: '', email: '', max_periods_per_day: 5, qualified_subject_ids: [] }))
              )}>
              Add Teacher
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── FIX 1: Requirements now iterates config.requirements directly ──────────
  const renderRequirements = () => {
    const depStep = stepByKey['requirements'];
    const reqs    = config?.requirements || [];

    return (
      <div>
        <h3 style={{ marginBottom: '1rem' }}>Subject Requirements</h3>
        {depStep.depUnmet && <DepWarning message={depStep.depLabel} />}
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          For each class, specify how many periods per week each subject should be taught.
          The solver uses these requirements to build the timetable. You must have at least one requirement before generating.
        </p>

        <table className="table" style={{ width: '100%', marginBottom: '1.5rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Class</th>
              <th>Subject</th>
              <th style={{ textAlign: 'center' }}>Periods/Week</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reqs.map(r => {
              const cls  = classesById[r.class_section_id];
              const subj = subjectsById[r.subject_id];
              return (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500 }}>{cls?.name ?? `Class #${r.class_section_id}`}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      {subj?.name ?? `Subject #${r.subject_id}`}
                      {subj?.is_activity && (
                        <span style={{ padding: '1px 6px', borderRadius: 10, background: '#fef9c3', color: '#92400e', fontSize: '0.75rem', fontWeight: 600 }}>Activity</span>
                      )}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.weekly_frequency}</td>
                  <td>
                    <button className="btn btn-secondary"
                      style={{ color: 'var(--danger-color)', fontSize: '0.85rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => deleteEntity('requirements', r.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {reqs.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem' }}>
                  No requirements yet — add one below.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <h4 style={{ marginBottom: '0.75rem' }}>Add Requirement</h4>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap', background: '#f9fafb', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
          <div>
            <label style={labelStyle}>Class Section</label>
            <select className="select" value={reqForm.class_section_id} style={{ width: 160 }}
              onChange={e => setReqForm({ ...reqForm, class_section_id: parseInt(e.target.value) || '' })}>
              <option value="">Select Class</option>
              {(config?.classes || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Subject</label>
            <select className="select" value={reqForm.subject_id} style={{ width: 180 }}
              onChange={e => setReqForm({ ...reqForm, subject_id: parseInt(e.target.value) || '' })}>
              <option value="">Select Subject</option>
              {(config?.subjects || []).map(s => <option key={s.id} value={s.id}>{s.name}{s.is_activity ? ' (Activity)' : ''}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Periods/Week</label>
            <input type="number" className="input" min={1} max={10} value={reqForm.weekly_frequency} style={{ width: 90 }}
              onChange={e => setReqForm({ ...reqForm, weekly_frequency: parseInt(e.target.value) || 1 })} />
          </div>
          <button className="btn btn-primary"
            disabled={depStep.depUnmet}
            title={depStep.depUnmet ? depStep.depLabel : undefined}
            onClick={() => wrapAction(() =>
              api.createConfigEntity(schoolId, 'requirements', reqForm, token)
                .then(() => setReqForm({ class_section_id: '', subject_id: '', weekly_frequency: 5 }))
            )}>
            Add Requirement
          </button>
        </div>

        {/* Summary grouping by class */}
        {reqs.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Summary by Class</h4>
            {(config?.classes || []).map(cls => {
              const clsReqs = reqs.filter(r => r.class_section_id === cls.id);
              if (clsReqs.length === 0) return (
                <div key={cls.id} style={{ padding: '0.5rem 0.75rem', marginBottom: '0.5rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, fontSize: '0.875rem', color: '#9a3412' }}>
                  <strong>{cls.name}</strong>: ⚠️ No requirements — this class won't appear in the timetable.
                </div>
              );
              const totalPeriods = clsReqs.reduce((sum, r) => sum + r.weekly_frequency, 0);
              return (
                <div key={cls.id} style={{ padding: '0.5rem 0.75rem', marginBottom: '0.5rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: '0.875rem' }}>
                  <strong>{cls.name}</strong>: {clsReqs.map(r => `${subjectsById[r.subject_id]?.name ?? r.subject_id} ×${r.weekly_frequency}`).join(' · ')}{' '}
                  <span style={{ color: 'var(--text-secondary)' }}>({totalPeriods} periods/week total)</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderActivityBlocks = () => {
    const depStep = stepByKey['activity_blocks'];
    const activitySubjects = (config?.subjects || []).filter(s => s.is_activity);
    return (
      <div>
        <h3 style={{ marginBottom: '1rem' }}>Activity Blocks</h3>
        {depStep.depUnmet && <DepWarning message={depStep.depLabel} />}
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Activity blocks define fixed time windows for activities (PT, Music, etc.) by tier. Use subject codes from Activity subjects.
          {activitySubjects.length > 0 && (
            <span> Available activity codes: {activitySubjects.map(s => <code key={s.id} style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 3, marginLeft: 4, fontSize: '0.8rem' }}>{s.code}</code>)}</span>
          )}
        </p>
        <table className="table" style={{ width: '100%', marginBottom: '1.5rem', borderCollapse: 'collapse' }}>
          <thead>
            <tr><th>Tier</th><th>Day</th><th>Start Period</th><th>End Period</th><th>Activity Types</th><th>Action</th></tr>
          </thead>
          <tbody>
            {(config?.activity_blocks || []).map(ab => (
              <tr key={ab.id}>
                <td><span style={{ padding: '2px 8px', borderRadius: 12, background: ab.grade_tier === 'PRIMARY' ? '#dbeafe' : '#ede9fe', color: ab.grade_tier === 'PRIMARY' ? '#1d4ed8' : '#7c3aed', fontSize: '0.8rem', fontWeight: 600 }}>{ab.grade_tier === 'PRIMARY' ? '🔵 Primary' : '🟣 Senior'}</span></td>
                <td>{['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'][ab.day_of_week] || ab.day_of_week}</td>
                <td style={{ textAlign: 'center' }}>{ab.start_period}</td>
                <td style={{ textAlign: 'center' }}>{ab.end_period}</td>
                <td>
                  {(ab.activity_types || []).map(code => (
                    <code key={code} style={{ background: '#fef9c3', padding: '1px 6px', borderRadius: 4, marginRight: 4, fontSize: '0.8rem' }}>{code}</code>
                  ))}
                </td>
                <td>
                  <button className="btn btn-secondary" style={{ color: 'var(--danger-color)', fontSize: '0.85rem', padding: '0.3rem 0.6rem' }}
                    onClick={() => deleteEntity('activity-blocks', ab.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {(config?.activity_blocks || []).length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '1rem' }}>No activity blocks yet.</td></tr>
            )}
          </tbody>
        </table>

        <h4 style={{ marginBottom: '0.75rem' }}>Add Activity Block</h4>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap', background: '#f9fafb', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
          <div>
            <label style={labelStyle}>Grade Tier</label>
            <select className="select" value={abForm.grade_tier} style={{ width: 130 }}
              onChange={e => setAbForm({ ...abForm, grade_tier: e.target.value })}>
              <option value="PRIMARY">PRIMARY</option>
              <option value="SENIOR">SENIOR</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Day of Week</label>
            <select className="select" value={abForm.day_of_week} style={{ width: 110 }}
              onChange={e => setAbForm({ ...abForm, day_of_week: parseInt(e.target.value) || 1 })}>
              {[['1','Monday'],['2','Tuesday'],['3','Wednesday'],['4','Thursday'],['5','Friday']].map(([v,l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Start Period #</label>
            <input type="number" className="input" min={0} value={abForm.start_period} style={{ width: 90 }}
              onChange={e => setAbForm({ ...abForm, start_period: parseInt(e.target.value) || 1 })} />
          </div>
          <div>
            <label style={labelStyle}>End Period #</label>
            <input type="number" className="input" min={0} value={abForm.end_period} style={{ width: 90 }}
              onChange={e => setAbForm({ ...abForm, end_period: parseInt(e.target.value) || 2 })} />
          </div>
          <div>
            <label style={labelStyle}>Activity Codes <span style={{ fontWeight: 400 }}>(comma-sep)</span></label>
            <input className="input" placeholder="e.g. PT,MUS" value={abForm.activity_types.join(',')} style={{ width: 160 }}
              onChange={e => setAbForm({ ...abForm, activity_types: e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) })} />
          </div>
          <button className="btn btn-primary"
            onClick={() => wrapAction(() =>
              api.createConfigEntity(schoolId, 'activity-blocks', abForm, token)
                .then(() => setAbForm({ grade_tier: 'PRIMARY', day_of_week: 1, start_period: 1, end_period: 2, activity_types: [] }))
            )}>
            Add Block
          </button>
        </div>
      </div>
    );
  };

  const renderPeriodStructure = () => {
    const existingSlots = config?.period_slots || [];
    const savedTeaching = existingSlots.filter(s => !s.is_break);
    const savedBreaks   = existingSlots.filter(s => s.is_break);

    // Group saved slots by tier for display
    const savedTiers = [...new Set(existingSlots.map(s => s.tier))];

    return (
      <div>
        <h3 style={{ marginBottom: '0.4rem' }}>Period Structure</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
          Define the daily schedule for one tier — which periods teach, when breaks happen, and when lunch is.
          The structure you save here is automatically applied to <strong>every working day</strong> for that tier.
          <br/><span style={{ marginTop: '0.3rem', display: 'block' }}>⚠️ Saving <strong>replaces</strong> the existing structure for that tier.</span>
        </p>

        {/* Visual legend */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {Object.entries(SLOT_TYPE_LABELS).map(([key, { label, hint }]) => {
            const col = SLOT_TYPE_COLORS[key];
            return (
              <span key={key} title={hint} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                padding: '3px 10px', borderRadius: '20px',
                background: col.bg, border: `1px solid ${col.border}`, color: col.text,
                fontSize: '0.78rem', fontWeight: 600, cursor: 'default',
              }}>
                {label}
              </span>
            );
          })}
        </div>

        {existingSlots.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>
              Currently Saved
              <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
                {savedTeaching.length} teaching · {savedBreaks.length} break slots
              </span>
            </h4>
            {savedTiers.map(tier => {
              const tierSlots = existingSlots
                .filter(ps => ps.tier === tier && ps.day_of_week === 1)
                .sort((a, b) => a.period_number - b.period_number);
              return (
                <div key={tier} style={{ marginBottom: '1.25rem' }}>
                  <div style={{ marginBottom: '0.4rem' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      padding: '3px 12px', borderRadius: '12px',
                      background: tier === 'PRIMARY' ? '#dbeafe' : '#ede9fe',
                      color: tier === 'PRIMARY' ? '#1d4ed8' : '#7c3aed',
                      fontSize: '0.82rem', fontWeight: 700,
                    }}>
                      {tier === 'PRIMARY' ? '🔵' : '🟣'} {tier === 'PRIMARY' ? 'Primary' : 'Senior'} tier
                    </span>
                    <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      (Monday preview — same pattern repeats Mon–Fri)
                    </span>
                  </div>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ width: 80 }}>Period #</th>
                        <th>What is it?</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tierSlots.map(ps => {
                        const colors = SLOT_TYPE_COLORS[ps.slot_type] || {};
                        const slotLabel = SLOT_TYPE_LABELS[ps.slot_type]?.label ?? ps.slot_type;
                        // compute duration
                        const [sh, sm] = ps.start_time.split(':').map(Number);
                        const [eh, em] = ps.end_time.split(':').map(Number);
                        const dur = (eh * 60 + em) - (sh * 60 + sm);
                        return (
                          <tr key={ps.id} style={{ background: colors.bg }}>
                            <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: colors.text }}>
                              {ps.period_number === 0 ? '0 (zero)' : ps.period_number}
                            </td>
                            <td>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                padding: '2px 10px', borderRadius: '12px',
                                background: colors.bg, border: `1px solid ${colors.border}`,
                                color: colors.text, fontSize: '0.8rem', fontWeight: 700,
                              }}>
                                {slotLabel}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ps.start_time}</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ps.end_time}</td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{dur} min</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}

        <h4 style={{ marginBottom: '0.75rem' }}>Define / Update Structure</h4>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle}>Which tier are you editing?</label>
            <select className="select" value={periodTier} style={{ width: 200 }}
              onChange={e => setPeriodTier(e.target.value)}>
              <option value="PRIMARY">🔵 Primary tier</option>
              <option value="SENIOR">🟣 Senior tier</option>
            </select>
          </div>
          <button className="btn btn-secondary" style={{ marginTop: '1.1rem', fontSize: '0.85rem' }}
            onClick={() => setPeriodRows(DEFAULT_PERIOD_ROWS)}>
            Reset to sample defaults
          </button>
        </div>

        <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '0.5rem 0.4rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, minWidth: 72 }}>Period #</th>
                <th style={{ padding: '0.5rem 0.4rem', fontSize: '0.8rem', fontWeight: 600 }}>What is this slot?</th>
                <th style={{ padding: '0.5rem 0.4rem', fontSize: '0.8rem', fontWeight: 600 }}>Starts at</th>
                <th style={{ padding: '0.5rem 0.4rem', fontSize: '0.8rem', fontWeight: 600 }}>Ends at</th>
                <th style={{ padding: '0.5rem 0.4rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {periodRows.map((row, idx) => {
                const colors = SLOT_TYPE_COLORS[row.slot_type] || {};
                return (
                  <tr key={idx} style={{ background: colors.bg, borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.4rem', textAlign: 'center' }}>
                      <input type="number" className="input" style={{ width: 64, textAlign: 'center' }} min={0}
                        value={row.period_number}
                        onChange={e => updatePeriodRow(idx, 'period_number', parseInt(e.target.value) || 0)} />
                    </td>
                    <td style={{ padding: '0.4rem', minWidth: 200 }}>
                      <select className="select"
                        style={{ fontSize: '0.875rem', background: colors.bg, borderColor: colors.border, color: colors.text, fontWeight: 600, width: '100%' }}
                        value={row.slot_type}
                        onChange={e => {
                          const st = e.target.value;
                          const isBreakType = st === 'SHORT_BREAK' || st === 'LUNCH';
                          updatePeriodRow(idx, 'slot_type', st);
                          updatePeriodRow(idx, 'is_break', isBreakType);
                        }}>
                        {slotTypeOptions.map(o => (
                          <option key={o} value={o}>{SLOT_TYPE_LABELS[o]?.label ?? o}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <input type="time" className="input" style={{ width: 110 }} value={row.start_time}
                        onChange={e => updatePeriodRow(idx, 'start_time', e.target.value)} />
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <input type="time" className="input" style={{ width: 110 }} value={row.end_time}
                        onChange={e => updatePeriodRow(idx, 'end_time', e.target.value)} />
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      <button className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--danger-color)' }}
                        onClick={() => removePeriodRow(idx)} title="Remove this row">
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={addPeriodRow}>+ Add Row</button>
          <button className="btn btn-primary"
            onClick={() => wrapAction(() => api.updatePeriodStructure(schoolId, { tier: periodTier, slots: periodRows }, token))}>
            Save Structure
          </button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {periodRows.filter(r => !r.is_break).length} teaching · {periodRows.filter(r => r.is_break).length} break slots
          </span>
        </div>
      </div>
    );
  };

  // ── Tab badge helper ─────────────────────────────────────────────────────────
  const tabKeyMap = {
    'Grades':           'grades',
    'Classes':          'classes',
    'Subjects':         'subjects',
    'Teachers':         'teachers',
    'Requirements':     'requirements',
    'Activity Blocks':  'activity_blocks',
    'Period Structure': 'period_structure',
  };

  const labelStyle = { fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' };

  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginTop: '2rem' }}>
      <h2 style={{ marginBottom: '0.5rem' }}>School Setup</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
        Complete the steps below in order — each section depends on the previous one. Watch the progress bar at the top.
      </p>

      {/* ── Progress Checklist Strip ── */}
      <SetupProgress config={config} activeTab={activeTab} onTabClick={setActiveTab} />

      {errorMsg   && <div className="error-banner">{errorMsg}</div>}
      {successMsg && <div style={{ padding: '0.75rem 1rem', background: '#dcfce3', color: '#166534', borderRadius: '6px', marginBottom: '1rem', border: '1px solid #86efac', fontSize: '0.875rem' }}>{successMsg}</div>}

      {/* ── Numbered Tab Bar ── */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)', overflowX: 'auto' }}>
        {tabs.map(t => {
          const stepKey    = tabKeyMap[t];
          const step       = steps.find(s => s.key === stepKey);
          const isActive   = activeTab === t;
          const isDone     = step?.done;
          const isBlocking = step?.blocking && !isDone;
          return (
            <div
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                cursor: 'pointer',
                padding: '0.6rem 0.9rem',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.82rem',
                color: isActive ? 'var(--primary-color)' : isDone ? '#16a34a' : isBlocking ? '#92400e' : 'var(--text-secondary)',
                borderBottom: isActive ? '2px solid var(--primary-color)' : '2px solid transparent',
                marginBottom: '-2px',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                transition: 'color 0.15s',
              }}
            >
              <span>{isDone ? '✓' : isBlocking ? '!' : '○'}</span>
              {tabLabels[t]}
            </div>
          );
        })}
      </div>

      {activeTab === 'Grades'           && renderGrades()}
      {activeTab === 'Classes'          && renderClasses()}
      {activeTab === 'Subjects'         && renderSubjects()}
      {activeTab === 'Teachers'         && renderTeachers()}
      {activeTab === 'Requirements'     && renderRequirements()}
      {activeTab === 'Activity Blocks'  && renderActivityBlocks()}
      {activeTab === 'Period Structure' && renderPeriodStructure()}
    </div>
  );
}
