from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import io
import os


from backend.database import get_db, engine, SessionLocal
from backend.models import (
    Base, User, School, GradeLevel, ClassSection, Subject, Teacher, 
    PeriodSlot, ActivityBlock, TimetableEntry, TeacherAbsence, ClassSubjectRequirement
)
from backend.schemas import (
    LoginRequest, Token, SchoolResponse, GenerateResponse, OverrideRequest, AssignAbsenceRequest,
    SchoolCreateRequest, SchoolUpdateRequest, GradeLevelCreate, GradeLevelUpdate, ClassSectionCreate, ClassSectionUpdate,
    SubjectCreate, SubjectUpdate, TeacherCreate, TeacherUpdate, ClassSubjectRequirementCreate, ClassSubjectRequirementUpdate,
    ActivityBlockCreate, ActivityBlockUpdate, PeriodStructureRequest
)
from backend.auth_utils import verify_password, create_access_token, hash_password
from backend.deps import get_current_user, require_role, require_school_access
from backend.solver.timetable_solver import generate_timetable
from backend.solver.substitute_solver import get_substitute_recommendations

app = FastAPI(title="School Timetable System")

@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    try:
        db = SessionLocal()
        try:
            if db.query(User).count() == 0:
                print("[Startup] Empty database detected. Seeding initial data...")
                from backend.seed import seed
                seed()
        finally:
            db.close()
    except Exception as e:
        print(f"[Startup] Error checking/seeding database: {e}")

# CORS: In production set CORS_ORIGINS to a comma-separated list of allowed origins
# e.g. "https://myapp.vercel.app" — defaults to wildcard for local dev.
_cors_env = os.environ.get("CORS_ORIGINS", "*")
_cors_origins: list[str] = (
    [o.strip() for o in _cors_env.split(",") if o.strip()]
    if _cors_env != "*"
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/auth/login", response_model=Token)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
        
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "role": user.role,
            "school_id": user.school_id,
            "linked_teacher_id": user.linked_teacher_id,
            "linked_class_section_id": user.linked_class_section_id
        },
        expires_delta=timedelta(minutes=1440)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/schools", response_model=list[SchoolResponse])
def list_schools(db: Session = Depends(get_db)):
    return db.query(School).all()

@app.get("/api/schools/{school_id}", response_model=SchoolResponse)
def get_school(school_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_school_access(school_id, user)
    school = db.query(School).filter_by(id=school_id).first()
    if not school:
        raise HTTPException(404, "School not found")
    return school

@app.put("/api/schools/{school_id}", response_model=SchoolResponse)
def update_school(school_id: int, req: SchoolUpdateRequest, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    school = db.query(School).filter_by(id=school_id).first()
    if not school:
        raise HTTPException(404, "School not found")
    for k, v in req.dict(exclude_unset=True).items():
        setattr(school, k, v)
    db.commit()
    db.refresh(school)
    return school

@app.post("/api/schools", response_model=SchoolResponse)
def create_school(req: SchoolCreateRequest, db: Session = Depends(get_db)):
    new_school = School(name=req.name, subdomain=req.subdomain)
    db.add(new_school)
    db.commit()
    db.refresh(new_school)
    
    admin_user = User(
        school_id=new_school.id,
        email=req.admin_email,
        hashed_password=hash_password(req.admin_password),
        role="ADMIN"
    )
    db.add(admin_user)
    db.commit()
    
    return new_school

@app.get("/api/schools/{school_id}/config")
def get_school_config(school_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_school_access(school_id, user)
    return {
        "grades": [g.__dict__ for g in db.query(GradeLevel).filter_by(school_id=school_id).all()],
        "classes": [c.__dict__ for c in db.query(ClassSection).filter_by(school_id=school_id).all()],
        "subjects": [s.__dict__ for s in db.query(Subject).filter_by(school_id=school_id).all()],
        "teachers": [t.__dict__ for t in db.query(Teacher).filter_by(school_id=school_id).all()],
        "activity_blocks": [ab.__dict__ for ab in db.query(ActivityBlock).filter_by(school_id=school_id).all()],
        "period_slots": [ps.__dict__ for ps in db.query(PeriodSlot).filter_by(school_id=school_id).all()],
        "requirements": [r.__dict__ for r in db.query(ClassSubjectRequirement).filter_by(school_id=school_id).all()]
    }

# CRUD for GradeLevel
@app.post("/api/schools/{school_id}/grades")
def create_grade(school_id: int, req: GradeLevelCreate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    grade = GradeLevel(school_id=school_id, **req.dict())
    db.add(grade)
    db.commit()
    db.refresh(grade)
    return grade.__dict__

@app.put("/api/schools/{school_id}/grades/{grade_id}")
def update_grade(school_id: int, grade_id: int, req: GradeLevelUpdate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    grade = db.query(GradeLevel).filter_by(id=grade_id, school_id=school_id).first()
    if not grade: raise HTTPException(404, "Grade not found")
    for k, v in req.dict(exclude_unset=True).items():
        setattr(grade, k, v)
    db.commit()
    db.refresh(grade)
    return grade.__dict__

@app.delete("/api/schools/{school_id}/grades/{grade_id}")
def delete_grade(school_id: int, grade_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    db.query(GradeLevel).filter_by(id=grade_id, school_id=school_id).delete()
    db.commit()
    return {"status": "deleted"}

# CRUD for ClassSection
@app.post("/api/schools/{school_id}/classes")
def create_class(school_id: int, req: ClassSectionCreate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    if not db.query(GradeLevel).filter_by(id=req.grade_id, school_id=school_id).first():
        raise HTTPException(422, "Grade not found in this school")
    cl = ClassSection(school_id=school_id, **req.dict())
    db.add(cl)
    db.commit()
    db.refresh(cl)
    return cl.__dict__

@app.put("/api/schools/{school_id}/classes/{class_id}")
def update_class(school_id: int, class_id: int, req: ClassSectionUpdate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    cl = db.query(ClassSection).filter_by(id=class_id, school_id=school_id).first()
    if not cl: raise HTTPException(404, "Class not found")
    if req.grade_id is not None and not db.query(GradeLevel).filter_by(id=req.grade_id, school_id=school_id).first():
        raise HTTPException(422, "Grade not found in this school")
    for k, v in req.dict(exclude_unset=True).items():
        setattr(cl, k, v)
    db.commit()
    db.refresh(cl)
    return cl.__dict__

@app.delete("/api/schools/{school_id}/classes/{class_id}")
def delete_class(school_id: int, class_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    db.query(ClassSection).filter_by(id=class_id, school_id=school_id).delete()
    db.commit()
    return {"status": "deleted"}

# CRUD for Subject
@app.post("/api/schools/{school_id}/subjects")
def create_subject(school_id: int, req: SubjectCreate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    sub = Subject(school_id=school_id, **req.dict())
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub.__dict__

@app.put("/api/schools/{school_id}/subjects/{subject_id}")
def update_subject(school_id: int, subject_id: int, req: SubjectUpdate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    sub = db.query(Subject).filter_by(id=subject_id, school_id=school_id).first()
    if not sub: raise HTTPException(404, "Subject not found")
    for k, v in req.dict(exclude_unset=True).items():
        setattr(sub, k, v)
    db.commit()
    db.refresh(sub)
    return sub.__dict__

@app.delete("/api/schools/{school_id}/subjects/{subject_id}")
def delete_subject(school_id: int, subject_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    db.query(Subject).filter_by(id=subject_id, school_id=school_id).delete()
    db.commit()
    return {"status": "deleted"}

# CRUD for Teacher
@app.post("/api/schools/{school_id}/teachers")
def create_teacher(school_id: int, req: TeacherCreate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    if req.max_periods_per_day > 5:
        raise HTTPException(422, "Max periods per day must be <= 5")
    valid_subjects = {s.id for s in db.query(Subject.id).filter_by(school_id=school_id).all()}
    if not all(s_id in valid_subjects for s_id in req.qualified_subject_ids):
        raise HTTPException(422, "One or more qualified subjects do not exist in this school")
    teacher = Teacher(school_id=school_id, **req.dict())
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return teacher.__dict__

@app.put("/api/schools/{school_id}/teachers/{teacher_id}")
def update_teacher(school_id: int, teacher_id: int, req: TeacherUpdate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    teacher = db.query(Teacher).filter_by(id=teacher_id, school_id=school_id).first()
    if not teacher: raise HTTPException(404, "Teacher not found")
    if req.max_periods_per_day is not None and req.max_periods_per_day > 5:
        raise HTTPException(422, "Max periods per day must be <= 5")
    if req.qualified_subject_ids is not None:
        valid_subjects = {s.id for s in db.query(Subject.id).filter_by(school_id=school_id).all()}
        if not all(s_id in valid_subjects for s_id in req.qualified_subject_ids):
            raise HTTPException(422, "One or more qualified subjects do not exist in this school")
    for k, v in req.dict(exclude_unset=True).items():
        setattr(teacher, k, v)
    db.commit()
    db.refresh(teacher)
    return teacher.__dict__

@app.delete("/api/schools/{school_id}/teachers/{teacher_id}")
def delete_teacher(school_id: int, teacher_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    db.query(Teacher).filter_by(id=teacher_id, school_id=school_id).delete()
    db.commit()
    return {"status": "deleted"}

# CRUD for Requirements
@app.post("/api/schools/{school_id}/requirements")
def create_requirement(school_id: int, req: ClassSubjectRequirementCreate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    if not db.query(ClassSection).filter_by(id=req.class_section_id, school_id=school_id).first():
        raise HTTPException(422, "Class not found in this school")
    if not db.query(Subject).filter_by(id=req.subject_id, school_id=school_id).first():
        raise HTTPException(422, "Subject not found in this school")
    creq = ClassSubjectRequirement(school_id=school_id, **req.dict())
    db.add(creq)
    db.commit()
    db.refresh(creq)
    return creq.__dict__

@app.put("/api/schools/{school_id}/requirements/{req_id}")
def update_requirement(school_id: int, req_id: int, req: ClassSubjectRequirementUpdate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    creq = db.query(ClassSubjectRequirement).filter_by(id=req_id, school_id=school_id).first()
    if not creq: raise HTTPException(404, "Requirement not found")
    if req.class_section_id is not None and not db.query(ClassSection).filter_by(id=req.class_section_id, school_id=school_id).first():
        raise HTTPException(422, "Class not found in this school")
    if req.subject_id is not None and not db.query(Subject).filter_by(id=req.subject_id, school_id=school_id).first():
        raise HTTPException(422, "Subject not found in this school")
    for k, v in req.dict(exclude_unset=True).items():
        setattr(creq, k, v)
    db.commit()
    db.refresh(creq)
    return creq.__dict__

@app.delete("/api/schools/{school_id}/requirements/{req_id}")
def delete_requirement(school_id: int, req_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    db.query(ClassSubjectRequirement).filter_by(id=req_id, school_id=school_id).delete()
    db.commit()
    return {"status": "deleted"}

# CRUD for ActivityBlock
@app.post("/api/schools/{school_id}/activity-blocks")
def create_activity_block(school_id: int, req: ActivityBlockCreate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    valid_codes = {s.code for s in db.query(Subject).filter_by(school_id=school_id, is_activity=True).all()}
    if not all(code in valid_codes for code in req.activity_types):
        raise HTTPException(422, "One or more activity types are invalid or not an activity in this school")
    ab = ActivityBlock(school_id=school_id, **req.dict())
    db.add(ab)
    db.commit()
    db.refresh(ab)
    return ab.__dict__

@app.put("/api/schools/{school_id}/activity-blocks/{ab_id}")
def update_activity_block(school_id: int, ab_id: int, req: ActivityBlockUpdate, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    ab = db.query(ActivityBlock).filter_by(id=ab_id, school_id=school_id).first()
    if not ab: raise HTTPException(404, "Activity block not found")
    if req.activity_types is not None:
        valid_codes = {s.code for s in db.query(Subject).filter_by(school_id=school_id, is_activity=True).all()}
        if not all(code in valid_codes for code in req.activity_types):
            raise HTTPException(422, "One or more activity types are invalid or not an activity in this school")
    for k, v in req.dict(exclude_unset=True).items():
        setattr(ab, k, v)
    db.commit()
    db.refresh(ab)
    return ab.__dict__

@app.delete("/api/schools/{school_id}/activity-blocks/{ab_id}")
def delete_activity_block(school_id: int, ab_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    db.query(ActivityBlock).filter_by(id=ab_id, school_id=school_id).delete()
    db.commit()
    return {"status": "deleted"}

# Period Structure Endpoint
@app.post("/api/schools/{school_id}/period-structure")
def create_period_structure(school_id: int, req: PeriodStructureRequest, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    school = db.query(School).filter_by(id=school_id).first()
    if not school: raise HTTPException(404, "School not found")
    
    # Delete existing slots for this tier
    db.query(PeriodSlot).filter_by(school_id=school_id, tier=req.tier).delete()
    
    # Replicate across working days
    working_days = school.working_days or [1, 2, 3, 4, 5]
    new_slots = []
    for d in working_days:
        for slot_req in req.slots:
            new_slots.append(PeriodSlot(
                school_id=school_id,
                tier=req.tier,
                day_of_week=d,
                period_number=slot_req.period_number,
                start_time=slot_req.start_time,
                end_time=slot_req.end_time,
                is_break=slot_req.is_break,
                slot_type=slot_req.slot_type
            ))
    db.add_all(new_slots)
    db.commit()
    return {"status": "success", "slots_created": len(new_slots)}

@app.post("/api/schools/{school_id}/timetable/generate", response_model=GenerateResponse)
def generate_timetable_endpoint(school_id: int, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    
    res = generate_timetable(db, school_id)
    if res["status"] in ["OPTIMAL", "FEASIBLE"]:
        # Design constraint: Delete only non-manual overrides
        db.query(TimetableEntry).filter_by(school_id=school_id, is_manual_override=False).delete()
        
        # Note: If this creates a conflict between a preserved manual entry and the newly generated schedule, 
        # that's an accepted tradeoff for now.
        
        new_entries = []
        for e in res["entries"]:
            new_entries.append(TimetableEntry(
                school_id=school_id,
                class_section_id=e["class_section_id"],
                subject_id=e["subject_id"],
                teacher_id=e["teacher_id"],
                day_of_week=e["day_of_week"],
                period_number=e["period_number"],
                room_name=e.get("room_name", f"Room {e['class_section_id']}")
            ))
        db.add_all(new_entries)
        db.commit()
        
        return {"status": res["status"], "entry_count": len(new_entries)}
    else:
        return {"status": res["status"], "entry_count": 0, "infeasibility_reason": res["infeasibility_reason"]}

@app.get("/api/schools/{school_id}/timetable/entries")
def get_timetable_entries(
    school_id: int, 
    class_id: int = None, 
    teacher_id: int = None, 
    db: Session = Depends(get_db), 
    user: User = Depends(get_current_user)
):
    require_school_access(school_id, user)
    
    # Enforce role scoping
    if user.role == "TEACHER":
        teacher_id = user.linked_teacher_id
    elif user.role == "STUDENT":
        class_id = user.linked_class_section_id
        
    query = db.query(TimetableEntry).filter_by(school_id=school_id)
    if class_id is not None:
        query = query.filter(TimetableEntry.class_section_id == class_id)
    if teacher_id is not None:
        query = query.filter(TimetableEntry.teacher_id == teacher_id)
        
    return [e.__dict__ for e in query.all()]

@app.get("/api/schools/{school_id}/timetable/effective")
def get_effective_timetable(
    school_id: int, 
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    class_id: int = None, 
    teacher_id: int = None, 
    db: Session = Depends(get_db), 
    user: User = Depends(get_current_user)
):
    require_school_access(school_id, user)
    
    # Enforce role scoping
    if user.role == "TEACHER":
        teacher_id = user.linked_teacher_id
    elif user.role == "STUDENT":
        class_id = user.linked_class_section_id

    try:
        dt = datetime.strptime(date, "%Y-%m-%d")
        day_of_week = dt.isoweekday()  # 1 = Monday, 7 = Sunday
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")
        
    query = db.query(TimetableEntry).filter_by(school_id=school_id, day_of_week=day_of_week)
    if class_id is not None:
        query = query.filter(TimetableEntry.class_section_id == class_id)
        
    recurring_entries = query.all()
    
    # Fetch TeacherAbsence rows for that exact date with substitute assigned
    absences = db.query(TeacherAbsence).filter_by(school_id=school_id, date=date).all()
    absence_map = {}
    for a in absences:
        if a.substitute_teacher_id is not None:
            absence_map[(a.teacher_id, a.period_number)] = a
            
    effective_entries = []
    for e in recurring_entries:
        entry_dict = {
            "id": e.id,
            "school_id": e.school_id,
            "class_section_id": e.class_section_id,
            "day_of_week": e.day_of_week,
            "period_number": e.period_number,
            "subject_id": e.subject_id,
            "teacher_id": e.teacher_id,
            "room_name": e.room_name,
            "is_manual_override": e.is_manual_override,
            "is_published": e.is_published,
            "is_substituted": False,
            "original_teacher_id": None,
        }
        
        key = (e.teacher_id, e.period_number)
        if key in absence_map:
            absence = absence_map[key]
            entry_dict["original_teacher_id"] = e.teacher_id
            entry_dict["teacher_id"] = absence.substitute_teacher_id
            entry_dict["is_substituted"] = True
            
        effective_entries.append(entry_dict)
        
    if teacher_id is not None:
        effective_entries = [e for e in effective_entries if e["teacher_id"] == teacher_id]
        
    return effective_entries

@app.patch("/api/schools/{school_id}/timetable/entries/{entry_id}")
def update_timetable_entry(
    school_id: int, 
    entry_id: int, 
    req: OverrideRequest, 
    db: Session = Depends(get_db), 
    user: User = Depends(require_role("ADMIN"))
):
    require_school_access(school_id, user)
    entry = db.query(TimetableEntry).filter_by(id=entry_id, school_id=school_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
        
    new_teacher_id = req.teacher_id if req.teacher_id is not None else entry.teacher_id
    
    # Conflict checks only if we're altering the teacher
    if req.teacher_id is not None and req.teacher_id != entry.teacher_id:
        conflict = db.query(TimetableEntry).filter(
            TimetableEntry.school_id == school_id,
            TimetableEntry.day_of_week == entry.day_of_week,
            TimetableEntry.period_number == entry.period_number,
            TimetableEntry.id != entry.id,
            TimetableEntry.teacher_id == new_teacher_id
        ).first()
        if conflict:
            raise HTTPException(status_code=409, detail="Teacher is already booked at this time in another class")
            
    if req.teacher_id is not None:
        entry.teacher_id = req.teacher_id
    if req.room_name is not None:
        entry.room_name = req.room_name
        
    entry.is_manual_override = True
    db.commit()
    db.refresh(entry)
    return entry.__dict__

@app.post("/api/schools/{school_id}/timetable/publish")
def publish_timetable(school_id: int, publish: bool = True, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    db.query(TimetableEntry).filter_by(school_id=school_id).update({"is_published": publish})
    db.commit()
    return {"status": "success", "published": publish}

@app.get("/api/schools/{school_id}/substitutions/recommend")
def recommend_subs(school_id: int, teacher_id: int, date: str, period: int, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    return get_substitute_recommendations(db, school_id, teacher_id, date, period)

@app.post("/api/schools/{school_id}/substitutions/assign")
def assign_sub(school_id: int, req: AssignAbsenceRequest, db: Session = Depends(get_db), user: User = Depends(require_role("ADMIN"))):
    require_school_access(school_id, user)
    absence = TeacherAbsence(
        school_id=school_id,
        teacher_id=req.teacher_id,
        date=req.date,
        period_number=req.period_number,
        substitute_teacher_id=req.substitute_teacher_id
    )
    db.add(absence)
    db.commit()
    db.refresh(absence)
    return absence.__dict__

@app.get("/api/schools/{school_id}/export/excel")
def export_excel(school_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_school_access(school_id, user)
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Timetable"
    ws.append(["Class ID", "Day", "Period", "Subject ID", "Teacher ID", "Room"])
    
    entries = db.query(TimetableEntry).filter_by(school_id=school_id).all()
    for e in entries:
        ws.append([e.class_section_id, e.day_of_week, e.period_number, e.subject_id, e.teacher_id, e.room_name])
        
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=timetable.xlsx"}
    )

@app.get("/api/schools/{school_id}/export/pdf")
def export_pdf(school_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_school_access(school_id, user)
    from reportlab.pdfgen import canvas
    output = io.BytesIO()
    c = canvas.Canvas(output)
    c.drawString(100, 800, "Timetable Export")
    c.drawString(100, 780, f"School ID: {school_id}")
    c.showPage()
    c.save()
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=timetable.pdf"}
    )
