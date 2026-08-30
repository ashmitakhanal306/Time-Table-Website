import pytest
from backend.models import School, ClassSection, Teacher, GradeLevel, ActivityBlock

def test_models_seed(db):
    # Both schools exist
    schools = db.query(School).all()
    assert len(schools) >= 2
    
    springdale = db.query(School).filter_by(subdomain="springdale").first()
    oakridge = db.query(School).filter_by(subdomain="oakridge").first()
    assert springdale is not None
    assert oakridge is not None
    
    # Springdale has 10 classes
    classes_springdale = db.query(ClassSection).filter_by(school_id=springdale.id).all()
    assert len(classes_springdale) == 10
    
    # No teacher has max_periods_per_day > 5
    teachers = db.query(Teacher).all()
    for t in teachers:
        assert t.max_periods_per_day <= 5
        
    # Both tiers have correctly different day_end_time
    primary_tier = db.query(GradeLevel).filter_by(school_id=springdale.id, tier="PRIMARY").first()
    senior_tier = db.query(GradeLevel).filter_by(school_id=springdale.id, tier="SENIOR").first()
    assert primary_tier.day_end_time == "12:00"
    assert senior_tier.day_end_time == "14:00"
    assert primary_tier.day_end_time != senior_tier.day_end_time
    
    # The two schools' activity blocks are on different days
    # Springdale Primary is Wed (3), Senior is Thu (4)
    # Oakridge is Friday (5)
    springdale_blocks = db.query(ActivityBlock).filter_by(school_id=springdale.id).all()
    oakridge_blocks = db.query(ActivityBlock).filter_by(school_id=oakridge.id).all()
    
    springdale_days = {b.day_of_week for b in springdale_blocks}
    oakridge_days = {b.day_of_week for b in oakridge_blocks}
    
    assert not springdale_days.intersection(oakridge_days)
    assert 5 in oakridge_days
