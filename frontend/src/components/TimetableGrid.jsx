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
  onCellClick
}) {
  if (!periodSlots || periodSlots.length === 0) return <div>No period slots available for this tier.</div>;

  // Group entries by day and period
  const entryMap = {};
  entries.forEach(e => {
    entryMap[`${e.day_of_week}-${e.period_number}`] = e;
  });

  const isActivitySlot = (day, period) => {
    if (!activityBlock) return false;
    return activityBlock.day_of_week === day && 
           period >= activityBlock.start_period && 
           period <= activityBlock.end_period;
  };

  return (
    <div className="timetable-container">
      {activityBlock && (
        <div style={{ marginBottom: '1rem' }}>
          <strong>Activity Block: </strong> 
          {DAYS.find(d => d.id === activityBlock.day_of_week)?.name}, 
          Periods {activityBlock.start_period} - {activityBlock.end_period}
        </div>
      )}
      
      <div className="legend">
        <div className="legend-item">
          <div className="legend-box" style={{ background: 'var(--academic-color)', border: '1px solid var(--academic-border)' }}></div>
          <span>Academic Subject</span>
        </div>
        <div className="legend-item">
          <div className="legend-box" style={{ background: 'var(--activity-color)', border: '1px solid var(--activity-border)' }}></div>
          <span>Activity Subject</span>
        </div>
      </div>

      <div className="timetable-wrapper">
        <table className="timetable-grid">
          <thead>
            <tr>
              <th>Time</th>
              {DAYS.map(d => <th key={d.id}>{d.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {periodSlots.sort((a,b) => a.period_number - b.period_number).map(slot => (
              <tr key={slot.period_number}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <div><strong>P{slot.period_number}</strong></div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {slot.start_time} - {slot.end_time}
                  </div>
                </td>
                
                {DAYS.map(day => {
                  if (slot.is_break) {
                    return (
                      <td key={`${day.id}-${slot.period_number}`} className="cell break-row">
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
                    content = (
                      <>
                        <div style={{ fontWeight: 600 }}>{subject?.name || 'Unknown'}</div>
                        <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          {metaLabel(entry)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {entry.room_name}
                        </div>
                      </>
                    );
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
