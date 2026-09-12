import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import User, School, TimetableEntry, TeacherAbsence, Teacher, ClassSection, Subject

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_data():
    db = SessionLocal()
    admin_s = db.query(User).filter_by(email="admin@springdale.edu").first()
    school_id = admin_s.school_id
    
    # Grab 2 teachers, 1 class, 1 subject
    teachers = db.query(Teacher).filter_by(school_id=school_id).limit(2).all()
    t_absent = teachers[0]
    t_sub = teachers[1]
    
    class_sec = db.query(ClassSection).filter_by(school_id=school_id).first()
    subject = db.query(Subject).filter_by(school_id=school_id).first()
    
    # Clean any preexisting timetable entries for day 1, period 1 for this class
    db.query(TimetableEntry).filter_by(
        school_id=school_id, class_section_id=class_sec.id, day_of_week=1, period_number=1
    ).delete()
    
    # Create test recurring timetable entry for Day 1 (Monday), Period 1
    test_entry = TimetableEntry(
        school_id=school_id,
        class_section_id=class_sec.id,
        day_of_week=1, # Monday
        period_number=1,
        subject_id=subject.id,
        teacher_id=t_absent.id,
        room_name="Room 101",
        is_published=True
    )
    db.add(test_entry)
    db.commit()
    db.refresh(test_entry)
    
    # Date 2026-09-14 is a Monday (day_of_week = 1)
    # Date 2026-09-21 is next Monday (day_of_week = 1)
    target_date = "2026-09-14"
    other_date = "2026-09-21"
    
    # Clean any preexisting absences for this teacher on target_date
    db.query(TeacherAbsence).filter_by(
        school_id=school_id, teacher_id=t_absent.id, date=target_date, period_number=1
    ).delete()
    
    absence = TeacherAbsence(
        school_id=school_id,
        teacher_id=t_absent.id,
        date=target_date,
        period_number=1,
        substitute_teacher_id=t_sub.id
    )
    db.add(absence)
    db.commit()
    
    yield admin_s, t_absent, t_sub, class_sec, target_date, other_date
    
    # Cleanup
    db.query(TeacherAbsence).filter_by(school_id=school_id, teacher_id=t_absent.id, date=target_date).delete()
    db.commit()
    db.close()

def login(email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password})

def test_invalid_date_format(setup_data):
    admin_s, _, _, _, _, _ = setup_data
    token = login(admin_s.email, "password123").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    resp = client.get(
        f"/api/schools/{admin_s.school_id}/timetable/effective?date=invalid-date",
        headers=headers
    )
    assert resp.status_code == 400
    assert "Invalid date format" in resp.json()["detail"]

def test_effective_timetable_substitution_overlay(setup_data):
    admin_s, t_absent, t_sub, class_sec, target_date, other_date = setup_data
    token = login(admin_s.email, "password123").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Class view on target_date (2026-09-14, Monday): period 1 should be substituted
    resp_class = client.get(
        f"/api/schools/{admin_s.school_id}/timetable/effective?date={target_date}&class_id={class_sec.id}",
        headers=headers
    )
    assert resp_class.status_code == 200
    entries = resp_class.json()
    period_1 = next((e for e in entries if e["period_number"] == 1), None)
    assert period_1 is not None
    assert period_1["is_substituted"] is True
    assert period_1["teacher_id"] == t_sub.id
    assert period_1["original_teacher_id"] == t_absent.id
    
    # 2. Substitute teacher view on target_date: should see this class
    resp_sub = client.get(
        f"/api/schools/{admin_s.school_id}/timetable/effective?date={target_date}&teacher_id={t_sub.id}",
        headers=headers
    )
    assert resp_sub.status_code == 200
    sub_entries = resp_sub.json()
    sub_p1 = next((e for e in sub_entries if e["period_number"] == 1 and e["class_section_id"] == class_sec.id), None)
    assert sub_p1 is not None
    assert sub_p1["is_substituted"] is True
    assert sub_p1["teacher_id"] == t_sub.id
    assert sub_p1["original_teacher_id"] == t_absent.id
    
    # 3. Absent teacher view on target_date: should NOT see period 1 in active teaching entries
    resp_absent = client.get(
        f"/api/schools/{admin_s.school_id}/timetable/effective?date={target_date}&teacher_id={t_absent.id}",
        headers=headers
    )
    assert resp_absent.status_code == 200
    absent_entries = resp_absent.json()
    absent_p1 = next((e for e in absent_entries if e["period_number"] == 1 and e["class_section_id"] == class_sec.id), None)
    assert absent_p1 is None
    
    # 4. Same day of week on another date (2026-09-21, next Monday): no absence row
    resp_other = client.get(
        f"/api/schools/{admin_s.school_id}/timetable/effective?date={other_date}&class_id={class_sec.id}",
        headers=headers
    )
    assert resp_other.status_code == 200
    other_entries = resp_other.json()
    other_p1 = next((e for e in other_entries if e["period_number"] == 1), None)
    assert other_p1 is not None
    assert other_p1["is_substituted"] is False
    assert other_p1["teacher_id"] == t_absent.id
    assert other_p1["original_teacher_id"] is None
