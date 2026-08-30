import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import SessionLocal
from backend.models import User, School, TimetableEntry

client = TestClient(app)

@pytest.fixture(scope="module")
def setup_users():
    db = SessionLocal()
    
    admin_s = db.query(User).filter_by(email="admin@springdale.edu").first()
    admin_o = db.query(User).filter_by(email="admin@oakridge.edu").first()
    
    yield admin_s, admin_o
    
    db.close()

def login(email, password):
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    return resp

def test_login_wrong_password(setup_users):
    resp = login("admin@springdale.edu", "wrongpass")
    assert resp.status_code == 401

def test_config_fetch(setup_users):
    admin_s, _ = setup_users
    token = login(admin_s.email, "password123").json()["access_token"]
    
    resp = client.get(
        f"/api/schools/{admin_s.school_id}/config",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["classes"]) == 10 # 5 primary + 5 senior
    assert len(data["teachers"]) >= 15 # We seeded around 15+ teachers
    
def test_generate_and_fetch_entries(setup_users):
    admin_s, _ = setup_users
    token = login(admin_s.email, "password123").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Generate
    resp = client.post(f"/api/schools/{admin_s.school_id}/timetable/generate", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["status"] in ["OPTIMAL", "FEASIBLE"]
    
    # Fetch entries for a specific class
    config = client.get(f"/api/schools/{admin_s.school_id}/config", headers=headers).json()
    class_id = config["classes"][0]["id"]
    
    resp2 = client.get(f"/api/schools/{admin_s.school_id}/timetable/entries?class_id={class_id}", headers=headers)
    assert resp2.status_code == 200
    entries = resp2.json()
    assert len(entries) > 0
    assert all(e["class_section_id"] == class_id for e in entries)

def test_override_conflict(setup_users):
    admin_s, _ = setup_users
    token = login(admin_s.email, "password123").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Ensure generated data
    client.post(f"/api/schools/{admin_s.school_id}/timetable/generate", headers=headers)
    
    db = SessionLocal()
    # Find two distinct entries at the exact same day/period
    entries = db.query(TimetableEntry).filter_by(
        school_id=admin_s.school_id, 
        day_of_week=1, 
        period_number=1
    ).limit(2).all()
    
    assert len(entries) >= 2, "Not enough parallel classes to test conflict"
    
    e1, e2 = entries[0], entries[1]
    
    # Try to assign e2's teacher to e1's slot -> expect 409
    resp_conflict = client.patch(
        f"/api/schools/{admin_s.school_id}/timetable/entries/{e1.id}",
        json={"teacher_id": e2.teacher_id, "room_name": "Conflict Room"},
        headers=headers
    )
    assert resp_conflict.status_code == 409
    
    # Try a harmless valid change (same teacher, different room)
    resp_ok = client.patch(
        f"/api/schools/{admin_s.school_id}/timetable/entries/{e1.id}",
        json={"teacher_id": e1.teacher_id, "room_name": "New Room"},
        headers=headers
    )
    assert resp_ok.status_code == 200
    updated_entry = resp_ok.json()
    assert updated_entry["room_name"] == "New Room"
    assert updated_entry["is_manual_override"] is True
    
    db.close()

def test_multi_tenant_isolation(setup_users):
    admin_s, admin_o = setup_users
    # Login as Springdale
    token = login(admin_s.email, "password123").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Try to access Oakridge config
    resp = client.get(f"/api/schools/{admin_o.school_id}/config", headers=headers)
    assert resp.status_code == 403

def test_substitute_recommend(setup_users):
    admin_s, _ = setup_users
    token = login(admin_s.email, "password123").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    db = SessionLocal()
    # Pick a random entry to simulate teacher absence
    entry = db.query(TimetableEntry).filter_by(school_id=admin_s.school_id).first()
    assert entry is not None
    
    date_str = "2023-10-23" # Dummy date mapping to Monday = 1
    resp = client.get(
        f"/api/schools/{admin_s.school_id}/substitutions/recommend?teacher_id={entry.teacher_id}&date={date_str}&period={entry.period_number}",
        headers=headers
    )
    assert resp.status_code == 200
    subs = resp.json()
    assert len(subs) > 0
    
    # Verify ranking: most free periods first
    for i in range(len(subs) - 1):
        # Either qualified > unqualified, or same qualification & free_periods_today >= next
        if subs[i]["qualified"] == subs[i+1]["qualified"]:
            assert subs[i]["free_periods_today"] >= subs[i+1]["free_periods_today"]
        elif subs[i]["qualified"] and not subs[i+1]["qualified"]:
            pass # Valid
        else:
            assert False, "Ranking logic failed"

    db.close()
