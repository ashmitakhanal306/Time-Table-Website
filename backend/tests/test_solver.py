import pytest
import uuid
from backend.models import School, GradeLevel, ClassSection, Subject, ClassSubjectRequirement, Teacher, PeriodSlot, ActivityBlock
from backend.solver.timetable_solver import generate_timetable

def create_synthetic_school(db, suffix):
    s = School(name=f"Synth {suffix}", subdomain=f"synth_{suffix}")
    db.add(s)
    db.commit()
    db.refresh(s)
    
    g = GradeLevel(school_id=s.id, name="Synth Grade", tier="PRIMARY", day_end_time="12:00")
    db.add(g)
    db.commit()
    db.refresh(g)
    
    c = ClassSection(school_id=s.id, grade_id=g.id, name="1A")
    db.add(c)
    db.commit()
    db.refresh(c)
    
    # 2 days, 3 periods per day (total 6 slots)
    for d in range(1, 3):
        for p in range(1, 4):
            db.add(PeriodSlot(school_id=s.id, tier="PRIMARY", day_of_week=d, period_number=p, start_time="08:00", end_time="09:00", slot_type="REGULAR"))
    
    sub1 = Subject(school_id=s.id, name="Math", code="M", is_activity=False)
    sub2 = Subject(school_id=s.id, name="Act", code="A", is_activity=True)
    db.add_all([sub1, sub2])
    db.commit()
    db.refresh(sub1)
    db.refresh(sub2)
    
    # Requirements (Math x 5, Act x 1)
    db.add(ClassSubjectRequirement(school_id=s.id, class_section_id=c.id, subject_id=sub1.id, weekly_frequency=5))
    db.add(ClassSubjectRequirement(school_id=s.id, class_section_id=c.id, subject_id=sub2.id, weekly_frequency=1))
    
    t1 = Teacher(school_id=s.id, name="T1", email=f"t1_{suffix}@t.c", max_periods_per_day=5, qualified_subject_ids=[sub1.id])
    t2 = Teacher(school_id=s.id, name="T2", email=f"t2_{suffix}@t.c", max_periods_per_day=5, qualified_subject_ids=[sub1.id])
    t3 = Teacher(school_id=s.id, name="T3", email=f"t3_{suffix}@t.c", max_periods_per_day=5, qualified_subject_ids=[sub2.id])
    db.add_all([t1, t2, t3])
    
    # Activity Block on day 2, period 3
    db.add(ActivityBlock(school_id=s.id, grade_tier="PRIMARY", day_of_week=2, start_period=3, end_period=3, activity_types=["A"]))
    
    db.commit()
    return s.id, c.id, [t1, t2, t3], [sub1, sub2]

def test_solver_synthetic_basic_properties(db):
    suffix = uuid.uuid4().hex[:6]
    s_id, c_id, teachers, subjects = create_synthetic_school(db, suffix)
    
    # Tighten cap for t1 to test daily cap constraint
    t1 = teachers[0]
    t1.max_periods_per_day = 2
    db.commit()
    
    res = generate_timetable(db, s_id, time_limit_seconds=10)
    assert res["status"] in ["OPTIMAL", "FEASIBLE"]
    
    entries = res["entries"]
    assert len(entries) == 6
    
    # 2. Zero double-booking
    # For classes (only 1 class, but test logic anyway)
    from collections import defaultdict
    class_slots = defaultdict(int)
    teacher_slots = defaultdict(int)
    t1_daily_load = defaultdict(int)
    
    for e in entries:
        class_slots[(e["class_section_id"], e["day_of_week"], e["period_number"])] += 1
        teacher_slots[(e["teacher_id"], e["day_of_week"], e["period_number"])] += 1
        if e["teacher_id"] == t1.id:
            t1_daily_load[e["day_of_week"]] += 1
            
        # 6. No teacher assigned outside qualified subjects
        t = next(tc for tc in teachers if tc.id == e["teacher_id"])
        assert e["subject_id"] in t.qualified_subject_ids
        
        # 3. Tier never schedule past valid periods (synth only has d1-2, p1-3)
        assert e["day_of_week"] in [1, 2]
        assert e["period_number"] in [1, 2, 3]
        
        # 5. Activity block slots contain only designated subjects
        if e["day_of_week"] == 2 and e["period_number"] == 3:
            assert e["subject_id"] == subjects[1].id # Act subject
        else:
            assert e["subject_id"] == subjects[0].id # Math subject
            
    assert all(count <= 1 for count in class_slots.values())
    assert all(count <= 1 for count in teacher_slots.values())
    
    # 4. No teacher exceeds max_periods_per_day
    assert all(count <= 2 for count in t1_daily_load.values())

def test_solver_infeasible(db):
    suffix = uuid.uuid4().hex[:6]
    s_id, c_id, teachers, subjects = create_synthetic_school(db, suffix)
    
    # Cap T1 to 1 per day (2 weekly capacity), but require 10 Math.
    # T2 is removed.
    t1 = teachers[0]
    t1.max_periods_per_day = 1
    t2 = teachers[1]
    db.delete(t2)
    
    req = db.query(ClassSubjectRequirement).filter_by(class_section_id=c_id, subject_id=subjects[0].id).first()
    req.weekly_frequency = 10
    db.commit()
    
    res = generate_timetable(db, s_id, time_limit_seconds=10)
    assert res["status"] == "INFEASIBLE"
    assert "exceeds the combined capacity" in res["infeasibility_reason"]

def test_solver_integration_springdale(db):
    s = db.query(School).filter_by(subdomain="springdale").first()
    assert s is not None, "Springdale not seeded!"
    
    # Run solver on Springdale, time limit 30
    res = generate_timetable(db, s.id, time_limit_seconds=30)
    assert res["status"] in ["OPTIMAL", "FEASIBLE"]
    
    entries = res["entries"]
    assert len(entries) > 0
