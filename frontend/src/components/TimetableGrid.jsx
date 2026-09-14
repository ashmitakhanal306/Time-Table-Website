import React from 'react';

const DAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
];

export default function TimetableGrid({
  periodSlots,
  entries,
  subjectsById,
  metaLabel,
  activityBlock,
  onCellClick,
  teachersById,
  viewDate,
  activeDayId,
  singleDay = false
}) {
  if (!periodSlots || periodSlots.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--surface-color)', borderRadius: '12px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
        No period slots configured for this tier yet.
      </div>
    );
  }

  // Group entries by day and period
  const entryMap = {};
  entries.forEach(e => {
    entryMap[`${e.day_of_week}-${e.period_number}`] = e;
  });

  const daysToRender = singleDay && activeDayId
    ? DAYS.filter(d => d.id === activeDayId)
    : DAYS;

  const isActivitySlot = (day, period) => {
    if (!activityBlock) return false;
    return activityBlock.day_of_week === day && 
           period >= activityBlock.start_period && 
           period <= activityBlock.end_period;
  };

  return (
    <div className="timetable-container">
      {activityBlock && (
        <div style={{ 
          marginBottom: '1rem', 
          padding: '0.6rem 1rem', 
          background: '#fefce8', 
          border: '1px solid #fef08a', 
          borderRadius: '8px', 
          fontSize: '0.85rem',
          color: '#854d0e',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span>⚡</span>
          <div>
            <strong>Activity Block: </strong> 
            {DAYS.find(d => d.id === activityBlock.day_of_week)?.name}, 
            Periods {activityBlock.start_period} – {activityBlock.end_period}
          </div>
        </div>
      )}
      
      <div className="legend">
        <div className="legend-item">
          <div className="legend-box" style={{ background: 'var(--academic-color)', border: '1px solid var(--academic-border)' }}></div>
          <span>Academic</span>
        </div>
        <div className="legend-item">
          <div className="legend-box" style={{ background: 'var(--activity-color)', border: '1px solid var(--activity-border)' }}></div>
          <span>Activity</span>
        </div>
        <div className="legend-item">
          <div className="legend-box" style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', border: '2px solid #f97316' }}></div>
          <span style={{ fontWeight: 600, color: '#9a3412' }}>Substituted</span>
        </div>
      </div>

      <div className="timetable-wrapper">
        <table className="timetable-grid">
          <thead>
            <tr>
              <th>Time</th>
              {daysToRender.map(d => (
                <th key={d.id} className={activeDayId === d.id ? 'active-day-col' : ''}>
                  <div>{d.name}</div>
                  {viewDate && (
                    <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {viewDate}
                    </div>
                  )}
                  {!singleDay && activeDayId === d.id && !viewDate && (
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary-color)', marginTop: '2px' }}>
                      ● Today
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periodSlots.sort((a,b) => a.period_number - b.period_number).map(slot => (
              <tr key={slot.period_number}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <div><strong>P{slot.period_number}</strong></div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {slot.start_time} - {slot.end_time}
                  </div>
                </td>
                
                {daysToRender.map(day => {
                  const isDayColActive = activeDayId === day.id;
                  if (slot.is_break) {
                    return (
                      <td key={`${day.id}-${slot.period_number}`} className={`cell break-row ${isDayColActive && !singleDay ? 'active-day-col' : ''}`}>
                        {slot.slot_type}
                      </td>
                    );
                  }

                  const entry = entryMap[`${day.id}-${slot.period_number}`];
                  const inBlock = isActivitySlot(day.id, slot.period_number);
                  let cellClass = "cell empty";
                  let content = null;
                  
                  if (entry) {
                    const subject = subjectsById[entry.subject_id];
                    cellClass = subject?.is_activity ? "cell activity" : "cell academic";
                    
                    if (entry.is_substituted) {
                      cellClass += " cell-substituted";
                    } else if (isDayColActive && !singleDay) {
                      cellClass += " active-day-col";
                    }

                    const originalTeacher = entry.original_teacher_id && teachersById ? teachersById[entry.original_teacher_id] : null;
                    const currentTeacher = entry.teacher_id && teachersById ? teachersById[entry.teacher_id] : null;
                    const tooltipText = entry.is_substituted
                      ? `Substitute: ${currentTeacher?.name || 'Assigned substitute'}, normally ${originalTeacher?.name || 'original teacher'}`
                      : undefined;

                    content = (
                      <div title={tooltipText} style={{ width: '100%' }}>
                        {entry.is_substituted && (
                          <div className="substitute-badge">
                            <span>🔄 SUB</span>
                          </div>
                        )}
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{subject?.name || 'Unknown'}</div>
                        <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: 'inherit' }}>
                          {metaLabel(entry)}
                        </div>
                        {entry.is_substituted && originalTeacher && (
                          <div className="substitute-note">
                            (was {originalTeacher.name})
                          </div>
                        )}
                        {entry.room_name && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                            📍 {entry.room_name}
                          </div>
                        )}
                      </div>
                    );
                  } else if (isDayColActive && !singleDay) {
                    cellClass += " active-day-col";
                  }

                  if (inBlock) {
                    cellClass += " in-activity-block";
                  }

                  return (
                    <td 
                      key={`${day.id}-${slot.period_number}`} 
                      className={cellClass}
                      onClick={() => {
                        if (onCellClick) {
                          onCellClick(entry, slot, day.id);
                        }
                      }}
                      style={{ cursor: onCellClick ? 'pointer' : 'default' }}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

