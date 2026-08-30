from datetime import datetime
from collections import defaultdict
from sqlalchemy.orm import Session
from backend.models import (
    Teacher, TimetableEntry, ClassSection, GradeLevel, PeriodSlot
)

def get_substitute_recommendations(db: Session, school_id: int, absent_teacher_id: int, date_str: str, period_number: int):
    # Parse date to get day_of_week (1 = Monday)
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        day_of_week = dt.isoweekday()
    except ValueError:
        day_of_week = 1 # Fallback if invalid
        
    # 1. Determine subject taught in the slot
    absent_entry = db.query(TimetableEntry).filter_by(
        school_id=school_id, teacher_id=absent_teacher_id, day_of_week=day_of_week, period_number=period_number
    ).first()
    
    target_subject_id = absent_entry.subject_id if absent_entry else None
    
    # Pre-fetch required data
    all_teachers = db.query(Teacher).filter_by(school_id=school_id).all()
    all_entries = db.query(TimetableEntry).filter_by(school_id=school_id).all()
    classes = db.query(ClassSection).filter_by(school_id=school_id).all()
    grades = db.query(GradeLevel).filter_by(school_id=school_id).all()
    slots = db.query(PeriodSlot).filter_by(
        school_id=school_id, day_of_week=day_of_week, is_break=False, slot_type="REGULAR"
    ).all()
    
    # Map tier to regular period count today
    tier_period_counts = defaultdict(int)
    for s in slots:
        tier_period_counts[s.tier] += 1
        
    # Find most common tier in the school
    tier_class_counts = defaultdict(int)
    class_to_tier = {}
    grade_to_tier = {g.id: g.tier for g in grades}
    for c in classes:
        tier = grade_to_tier[c.grade_id]
        tier_class_counts[tier] += 1
        class_to_tier[c.id] = tier
        
    most_common_tier = None
    if tier_class_counts:
        most_common_tier = max(tier_class_counts.items(), key=lambda x: x[1])[0]
        
    # Build teacher loads
    # teacher_id -> list of entries
    teacher_entries = defaultdict(list)
    for e in all_entries:
        teacher_entries[e.teacher_id].append(e)
        
    # 2. Exclude teachers already assigned at that exact time (and the absent teacher)
    busy_teacher_ids = {absent_teacher_id}
    for e in all_entries:
        if e.day_of_week == day_of_week and e.period_number == period_number:
            busy_teacher_ids.add(e.teacher_id)
            
    candidates = []
    
    for t in all_teachers:
        if t.id in busy_teacher_ids:
            continue
            
        t_entries_week = teacher_entries[t.id]
        t_entries_today = [e for e in t_entries_week if e.day_of_week == day_of_week]
        
        # 3. Compute free_periods_today
        # Determine capacity based on the tiers they teach today
        tiers_taught_today = set(class_to_tier[e.class_section_id] for e in t_entries_today)
        
        if tiers_taught_today:
            daily_capacity = max(tier_period_counts[tier] for tier in tiers_taught_today)
        else:
            daily_capacity = tier_period_counts.get(most_common_tier, 0)
            
        free_periods_today = max(0, daily_capacity - len(t_entries_today))
        
        # 4. Compute total_periods_this_week
        total_periods_this_week = len(t_entries_week)
        
        # 5. Qualified flag
        qualified = False
        if target_subject_id is not None and t.qualified_subject_ids:
            qualified = target_subject_id in t.qualified_subject_ids
            
        # Reason string
        reason = f"{free_periods_today} free period(s) today, {total_periods_this_week} assigned this week"
        if not qualified:
            reason += " (not subject-qualified -- fallback option)"
            
        candidates.append({
            "teacher_id": t.id,
            "teacher_name": t.name,
            "free_periods_today": free_periods_today,
            "total_periods_this_week": total_periods_this_week,
            "qualified": qualified,
            "reason": reason
        })
        
    # 6. Rank candidates
    # (a) qualified (True > False), so sort by -int(qualified)
    # (b) most free_periods_today (descending), so sort by -free_periods_today
    # (c) lowest total_periods_this_week (ascending), so sort by total_periods_this_week
    candidates.sort(key=lambda c: (
        not c["qualified"],
        -c["free_periods_today"],
        c["total_periods_this_week"]
    ))
    
    return candidates
