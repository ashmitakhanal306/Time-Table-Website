import pytest
import uuid
from backend.models import School, GradeLevel, ClassSection, Subject, Teacher, PeriodSlot, TimetableEntry
from backend.solver.substitute_solver import get_substitute_recommendations

def setup_substitute_scenario(db, suffix):
    s = School(name=f"Sub {suffix}", subdomain=f"sub_{suffix}")
    db.add(s)
    db.commit()
    db.refresh(s)
    
    g = GradeLevel(school_id=s.id, name="Grade", tier="PRIMARY", day_end_time="12:00")
    db.add(g)
    db.commit()
    db.refresh(g)
    
    c1 = ClassSection(school_id=s.id, grade_id=g.id, name="1A")
    c2 = ClassSection(school_id=s.id, grade_id=g.id, name="1B")
    db.add_all([c1, c2])
    db.commit()
    db.refresh(c1)
    db.refresh(c2)
    
    # 5 slots/day
    for d in range(1, 6):
        for p in range(1, 6):
            db.add(PeriodSlot(school_id=s.id, tier="PRIMARY", day_of_week=d, period_number=p, start_time="08:00", end_time="09:00", slot_type="REGULAR"))
            
    sub_math = Subject(school_id=s.id, name="Math", code="M")
    sub_sci = Subject(school_id=s.id, name="Science", code="S")
    db.add_all([sub_math, sub_sci])
    db.commit()
    db.refresh(sub_math)
    db.refresh(sub_sci)
    
    # Teachers
    t_absent = Teacher(school_id=s.id, name="Absent", email="a@s.c", max_periods_per_day=5, qualified_subject_ids=[sub_math.id])
    
    # Candidates for Math
    t_qual_free = Teacher(school_id=s.id, name="QualFree", email="qf@s.c", qualified_subject_ids=[sub_math.id])
    t_qual_busy = Teacher(school_id=s.id, name="QualBusy", email="qb@s.c", qualified_subject_ids=[sub_math.id])
    t_qual_tie = Teacher(school_id=s.id, name="QualTie", email="qt@s.c", qualified_subject_ids=[sub_math.id])
    
    # Unqualified fallback
    t_unqual = Teacher(school_id=s.id, name="Unqual", email="uq@s.c", qualified_subject_ids=[sub_sci.id])
    
    db.add_all([t_absent, t_qual_free, t_qual_busy, t_qual_tie, t_unqual])
    db.commit()
    db.refresh(t_absent)
    db.refresh(t_qual_free)
    db.refresh(t_qual_busy)
    db.refresh(t_qual_tie)
    db.refresh(t_unqual)
    
    # Target absence: Day 1, Period 1
    db.add(TimetableEntry(school_id=s.id, class_section_id=c1.id, day_of_week=1, period_number=1, subject_id=sub_math.id, teacher_id=t_absent.id))
    
    # t_qual_free: 1 entry on Day 1 (Period 2) -> 4 free periods today. 1 total.
    db.add(TimetableEntry(school_id=s.id, class_section_id=c1.id, day_of_week=1, period_number=2, subject_id=sub_math.id, teacher_id=t_qual_free.id))
    
    # t_qual_busy: 3 entries on Day 1 (Periods 2,3,4) -> 2 free periods today. 3 total.
    for p in [2, 3, 4]:
        db.add(TimetableEntry(school_id=s.id, class_section_id=c2.id, day_of_week=1, period_number=p, subject_id=sub_math.id, teacher_id=t_qual_busy.id))
        
    # t_qual_tie: 3 entries on Day 1 (Periods 2,3,4) -> 2 free periods today. BUT 5 total week entries (adds Day 2).
    for p in [2, 3, 4]:
        db.add(TimetableEntry(school_id=s.id, class_section_id=c1.id, day_of_week=1, period_number=p, subject_id=sub_math.id, teacher_id=t_qual_tie.id))
    for p in [1, 2]:
        db.add(TimetableEntry(school_id=s.id, class_section_id=c1.id, day_of_week=2, period_number=p, subject_id=sub_math.id, teacher_id=t_qual_tie.id))
        
    # t_unqual: 0 entries today -> 5 free periods today. Best availability, but unqualified.
    # No entries needed.
    
    db.commit()
    
    return s.id, t_absent.id

def test_substitute_ranking(db):
    suffix = uuid.uuid4().hex[:6]
    s_id, t_absent_id = setup_substitute_scenario(db, suffix)
    
    date_str = "2023-10-23" # A Monday (day 1)
    period = 1
    
    res = get_substitute_recommendations(db, s_id, t_absent_id, date_str, period)
    
    assert len(res) == 4
    
    # Extract names for checking order
    names = [c["teacher_name"] for c in res]
    
    # 1. Basic Ranking: QualFree (4 free today) should beat QualBusy (2 free today)
    idx_free = names.index("QualFree")
    idx_busy = names.index("QualBusy")
    assert idx_free < idx_busy
    
    # 2. Tie-break: QualBusy and QualTie both have 2 free today.
    # QualBusy has 3 total week entries. QualTie has 5 total week entries.
    # QualBusy should rank ahead of QualTie.
    idx_tie = names.index("QualTie")
    
    busy_rec = res[idx_busy]
    tie_rec = res[idx_tie]
    
    assert busy_rec["free_periods_today"] == tie_rec["free_periods_today"] == 2
    assert busy_rec["total_periods_this_week"] == 3
    assert tie_rec["total_periods_this_week"] == 5
    assert idx_busy < idx_tie
    
    # 3. Unqualified fallback: Unqual has 5 free today (better than QualFree's 4).
    # But because unqualified, must rank LAST.
    idx_unqual = names.index("Unqual")
    unqual_rec = res[idx_unqual]
    
    assert unqual_rec["qualified"] is False
    assert unqual_rec["free_periods_today"] == 5
    assert idx_unqual == 3 # Must be exactly last of the 4 candidates
    
    # Check that others are qualified
    for i in range(3):
        assert res[i]["qualified"] is True
