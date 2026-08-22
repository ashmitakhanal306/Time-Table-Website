import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_full_config_crud_flow():
    # 1. Create a school and admin user
    res = client.post("/api/schools", json={
        "name": "Test School",
        "subdomain": "testschool",
        "admin_email": "admin@testschool.com",
        "admin_password": "password123"
    })
    assert res.status_code == 200
    school_id = res.json()["id"]

    # 2. Login as the new admin
    res = client.post("/api/auth/login", json={
        "email": "admin@testschool.com",
        "password": "password123"
    })
    assert res.status_code == 200
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Create a GradeLevel
    res = client.post(f"/api/schools/{school_id}/grades", json={
        "name": "Grade 10",
        "tier": "SENIOR",
        "day_end_time": "15:00"
    }, headers=headers)
    assert res.status_code == 200
    grade_id = res.json()["id"]

    # 4. Create a ClassSection
    res = client.post(f"/api/schools/{school_id}/classes", json={
        "name": "10A",
        "grade_id": grade_id
    }, headers=headers)
    assert res.status_code == 200
    class_id = res.json()["id"]

    # Update ClassSection
    res = client.put(f"/api/schools/{school_id}/classes/{class_id}", json={
        "name": "10B"
    }, headers=headers)
    assert res.status_code == 200
    assert res.json()["name"] == "10B"

    # 5. Create a Subject
    res = client.post(f"/api/schools/{school_id}/subjects", json={
        "name": "Mathematics",
        "code": "MATH",
        "is_activity": False,
        "weekly_frequency_default": 5
    }, headers=headers)
    assert res.status_code == 200
    subject_id = res.json()["id"]

    # Create an Activity Subject
    res = client.post(f"/api/schools/{school_id}/subjects", json={
        "name": "Robotics",
        "code": "ROB",
        "is_activity": True,
        "weekly_frequency_default": 2
    }, headers=headers)
    assert res.status_code == 200
    act_subject_id = res.json()["id"]
    act_subject_code = res.json()["code"]

    # 6. Create a Teacher
    res = client.post(f"/api/schools/{school_id}/teachers", json={
        "name": "John Doe",
        "email": "john@testschool.com",
        "max_periods_per_day": 5,
        "qualified_subject_ids": [subject_id]
    }, headers=headers)
    assert res.status_code == 200
    teacher_id = res.json()["id"]

    # Update Teacher
    res = client.put(f"/api/schools/{school_id}/teachers/{teacher_id}", json={
        "name": "John Smith"
    }, headers=headers)
    assert res.status_code == 200
    assert res.json()["name"] == "John Smith"

    # 7. Create a Requirement
    res = client.post(f"/api/schools/{school_id}/requirements", json={
        "class_section_id": class_id,
        "subject_id": subject_id,
        "weekly_frequency": 5,
        "preferred_teacher_ids": []
    }, headers=headers)
    assert res.status_code == 200
    req_id = res.json()["id"]

    # 8. Create an Activity Block
    res = client.post(f"/api/schools/{school_id}/activity-blocks", json={
        "grade_tier": "SENIOR",
        "day_of_week": 5,
        "start_period": 4,
        "end_period": 5,
        "activity_types": [act_subject_code]
    }, headers=headers)
    assert res.status_code == 200
    ab_id = res.json()["id"]

    # 9. Period structure endpoint
    res = client.post(f"/api/schools/{school_id}/period-structure", json={
        "tier": "SENIOR",
        "slots": [
            {"period_number": 1, "start_time": "08:00", "end_time": "09:00", "is_break": False, "slot_type": "REGULAR"},
            {"period_number": 2, "start_time": "09:00", "end_time": "10:00", "is_break": False, "slot_type": "REGULAR"}
        ]
    }, headers=headers)
    assert res.status_code == 200
    
    # Check that config has all the items
    res = client.get(f"/api/schools/{school_id}/config", headers=headers)
    assert res.status_code == 200
    config = res.json()
    assert len(config["grades"]) == 1
    assert len(config["classes"]) == 1
    assert len(config["subjects"]) == 2
    assert len(config["teachers"]) == 1
    assert len(config["activity_blocks"]) == 1
    assert len(config["period_slots"]) == 10 # 2 slots * 5 working days

    # Delete teacher and class
    res = client.delete(f"/api/schools/{school_id}/teachers/{teacher_id}", headers=headers)
    assert res.status_code == 200
    res = client.delete(f"/api/schools/{school_id}/classes/{class_id}", headers=headers)
    assert res.status_code == 200

    res = client.get(f"/api/schools/{school_id}/config", headers=headers)
    config = res.json()
    assert len(config["teachers"]) == 0
    assert len(config["classes"]) == 0

def test_validations():
    # Setup School & Admin
    res = client.post("/api/schools", json={
        "name": "Val School", "subdomain": "valschool",
        "admin_email": "admin@valschool.com", "admin_password": "password123"
    })
    school_id = res.json()["id"]

    res = client.post("/api/auth/login", json={"email": "admin@valschool.com", "password": "password123"})
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Validation: Teacher.max_periods_per_day <= 5
    res = client.post(f"/api/schools/{school_id}/teachers", json={
        "name": "Overworked", "email": "o@o.c", "max_periods_per_day": 6, "qualified_subject_ids": []
    }, headers=headers)
    assert res.status_code == 422

    # Validation: cross-tenant subject ID
    res = client.post(f"/api/schools/{school_id}/teachers", json={
        "name": "Bad Sub", "email": "b@o.c", "max_periods_per_day": 5, "qualified_subject_ids": [9999]
    }, headers=headers)
    assert res.status_code == 422

    # Validation: ActivityBlock with bad activity types
    res = client.post(f"/api/schools/{school_id}/activity-blocks", json={
        "grade_tier": "SENIOR", "day_of_week": 1, "start_period": 1, "end_period": 2, "activity_types": ["FAKE"]
    }, headers=headers)
    assert res.status_code == 422

    # Validation: Requirement with bad class
    res = client.post(f"/api/schools/{school_id}/requirements", json={
        "class_section_id": 9999, "subject_id": 9999, "weekly_frequency": 5, "preferred_teacher_ids": []
    }, headers=headers)
    assert res.status_code == 422
