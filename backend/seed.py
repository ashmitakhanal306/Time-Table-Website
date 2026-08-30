import json
from backend.database import SessionLocal, Base, engine
from backend.models import (
    School, GradeLevel, ClassSection, Subject, ClassSubjectRequirement,
    Teacher, PeriodSlot, ActivityBlock, TimetableEntry, TeacherAbsence, User
)

def calculate_times(period_number, duration_minutes=45, start_hour=8, start_minute=0):
    total_start_mins = (start_hour * 60 + start_minute) + (period_number - 1) * duration_minutes
    total_end_mins = total_start_mins + duration_minutes
    start_time = f"{total_start_mins // 60:02d}:{total_start_mins % 60:02d}"
    end_time = f"{total_end_mins // 60:02d}:{total_end_mins % 60:02d}"
    return start_time, end_time

def seed():
    # Drop and recreate tables to ensure clean state
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    print("[Seed] Starting database seed process...")
    
    # ----------------------------------------------------
    # School 1: Springdale Academy
    # ----------------------------------------------------
    school1 = School(
        name="Springdale Academy",
        subdomain="springdale",
        timezone="Asia/Kolkata",
        terms=["Term 1", "Term 2"],
        working_days=[1, 2, 3, 4, 5]
    )
    db.add(school1)
    db.commit()
    db.refresh(school1)
    
    # Grade Levels
    primary = GradeLevel(school_id=school1.id, name="Primary", tier="PRIMARY", day_end_time="12:00")
    senior = GradeLevel(school_id=school1.id, name="Senior", tier="SENIOR", day_end_time="14:00")
    db.add_all([primary, senior])
    db.commit()
    db.refresh(primary)
    db.refresh(senior)
    
    # Classes (5 primary, 5 senior)
    classes_primary = [ClassSection(school_id=school1.id, grade_id=primary.id, name=f"5{c}") for c in "ABCDE"]
    classes_senior = [ClassSection(school_id=school1.id, grade_id=senior.id, name=f"10{c}") for c in "ABCDE"]
    db.add_all(classes_primary + classes_senior)
    db.commit()

    # Period Slots — Springdale Academy
    # Shared schedule for both tiers:
    #   period 0 : 07:30–08:00  ZERO        (assembly / zero period)
    #   period 1 : 08:00–08:40  REGULAR
    #   period 2 : 08:40–09:20  REGULAR
    #   period 3 : 09:20–09:35  SHORT_BREAK (is_break=True)
    #   period 4 : 09:35–10:15  REGULAR
    #   period 5 : 10:15–10:55  REGULAR
    #   period 6 : 10:55–11:25  LUNCH       (is_break=True)
    #   period 7 : 11:25–12:05  REGULAR     ← PRIMARY ends here
    #   period 8 : 12:05–12:45  REGULAR     ─┐
    #   period 9 : 12:45–13:25  REGULAR      │ SENIOR only
    #   period 10: 13:25–14:05  REGULAR     ─┘

    # (period_number, start_time, end_time, is_break, slot_type)
    PRIMARY_SLOTS = [
        (0,  "07:30", "08:00", False, "ZERO"),
        (1,  "08:00", "08:40", False, "REGULAR"),
        (2,  "08:40", "09:20", False, "REGULAR"),
        (3,  "09:20", "09:35", True,  "SHORT_BREAK"),
        (4,  "09:35", "10:15", False, "REGULAR"),
        (5,  "10:15", "10:55", False, "REGULAR"),
        (6,  "10:55", "11:25", True,  "LUNCH"),
        (7,  "11:25", "12:05", False, "REGULAR"),
    ]

    SENIOR_SLOTS = [
        (0,  "07:30", "08:00", False, "ZERO"),
        (1,  "08:00", "08:40", False, "REGULAR"),
        (2,  "08:40", "09:20", False, "REGULAR"),
        (3,  "09:20", "09:35", True,  "SHORT_BREAK"),
        (4,  "09:35", "10:15", False, "REGULAR"),
        (5,  "10:15", "10:55", False, "REGULAR"),
        (6,  "10:55", "11:25", True,  "LUNCH"),
        (7,  "11:25", "12:05", False, "REGULAR"),
        (8,  "12:05", "12:45", False, "REGULAR"),
        (9,  "12:45", "13:25", False, "REGULAR"),
        (10, "13:25", "14:05", False, "REGULAR"),
    ]

    for d in range(1, 6):
        for (pnum, st, et, brk, stype) in PRIMARY_SLOTS:
            db.add(PeriodSlot(
                school_id=school1.id, tier="PRIMARY", day_of_week=d,
                period_number=pnum, start_time=st, end_time=et,
                is_break=brk, slot_type=stype
            ))
        for (pnum, st, et, brk, stype) in SENIOR_SLOTS:
            db.add(PeriodSlot(
                school_id=school1.id, tier="SENIOR", day_of_week=d,
                period_number=pnum, start_time=st, end_time=et,
                is_break=brk, slot_type=stype
            ))
    db.commit()

    # Subjects
    sub_data = [
        ("Mathematics", "MATH", False, 5),
        ("Science", "SCI", False, 4),
        ("English", "ENG", False, 4),
        ("Social Studies", "SST", False, 3),
        ("Hindi", "HIN", False, 3),
        ("Computer Science", "CS", False, 2),
        ("Dance & Music", "MUS", True, 2),
        ("Art & Craft", "ART", True, 2),
        ("Games", "PE", True, 2)
    ]
    subjects = {}
    for name, code, is_act, freq in sub_data:
        s = Subject(school_id=school1.id, name=name, code=code, is_activity=is_act, weekly_frequency_default=freq)
        db.add(s)
        db.commit()
        db.refresh(s)
        subjects[code] = s

    # Requirements for Primary (No CS)
    for i, cl in enumerate(classes_primary):
        for code, freq in [("MATH",6), ("SCI",5), ("ENG",5), ("SST",4), ("HIN",3)]:
            db.add(ClassSubjectRequirement(school_id=school1.id, class_section_id=cl.id, subject_id=subjects[code].id, weekly_frequency=freq, preferred_teacher_ids=[]))
        db.add(ClassSubjectRequirement(school_id=school1.id, class_section_id=cl.id, subject_id=subjects["MUS"].id, weekly_frequency=1, preferred_teacher_ids=[]))
        db.add(ClassSubjectRequirement(school_id=school1.id, class_section_id=cl.id, subject_id=subjects["ART"].id, weekly_frequency=1, preferred_teacher_ids=[]))

    # Requirements for Senior (Has CS)
    for cl in classes_senior:
        for code, freq in [("MATH",7), ("SCI",7), ("ENG",7), ("SST",6), ("HIN",6), ("CS",5)]:
            db.add(ClassSubjectRequirement(school_id=school1.id, class_section_id=cl.id, subject_id=subjects[code].id, weekly_frequency=freq, preferred_teacher_ids=[]))
        db.add(ClassSubjectRequirement(school_id=school1.id, class_section_id=cl.id, subject_id=subjects["MUS"].id, weekly_frequency=1, preferred_teacher_ids=[]))
        db.add(ClassSubjectRequirement(school_id=school1.id, class_section_id=cl.id, subject_id=subjects["ART"].id, weekly_frequency=1, preferred_teacher_ids=[]))

    db.commit()

    # Activity Blocks (Staggered by tier)
    ab_primary = ActivityBlock(school_id=school1.id, grade_tier="PRIMARY", day_of_week=3, start_period=1, end_period=2, activity_types=["MUS", "ART"]) # Wed
    ab_senior = ActivityBlock(school_id=school1.id, grade_tier="SENIOR", day_of_week=4, start_period=1, end_period=2, activity_types=["MUS", "ART"]) # Thu
    db.add_all([ab_primary, ab_senior])
    db.commit()
    
    # Teachers
    teachers = [
        # Music teachers
        Teacher(school_id=school1.id, name="Riya Desai",      email="riya.desai@springdale.edu",      max_periods_per_day=5, qualified_subject_ids=[subjects["MUS"].id]),
        Teacher(school_id=school1.id, name="Kabir Nair",      email="kabir.nair@springdale.edu",      max_periods_per_day=5, qualified_subject_ids=[subjects["MUS"].id]),
        Teacher(school_id=school1.id, name="Meena Pillai",    email="meena.pillai@springdale.edu",    max_periods_per_day=5, qualified_subject_ids=[subjects["MUS"].id]),

        # Art teachers
        Teacher(school_id=school1.id, name="Ananya Bose",     email="ananya.bose@springdale.edu",     max_periods_per_day=5, qualified_subject_ids=[subjects["ART"].id]),
        Teacher(school_id=school1.id, name="Vikram Joshi",    email="vikram.joshi@springdale.edu",    max_periods_per_day=5, qualified_subject_ids=[subjects["ART"].id]),
        Teacher(school_id=school1.id, name="Sunita Rao",      email="sunita.rao@springdale.edu",      max_periods_per_day=5, qualified_subject_ids=[subjects["ART"].id]),

        # Math & Science teachers
        Teacher(school_id=school1.id, name="Priya Sharma",    email="priya.sharma@springdale.edu",    max_periods_per_day=5, qualified_subject_ids=[subjects["MATH"].id, subjects["SCI"].id]),
        Teacher(school_id=school1.id, name="Arjun Mehta",     email="arjun.mehta@springdale.edu",     max_periods_per_day=5, qualified_subject_ids=[subjects["MATH"].id, subjects["SCI"].id]),
        Teacher(school_id=school1.id, name="Deepa Krishnan",  email="deepa.krishnan@springdale.edu",  max_periods_per_day=5, qualified_subject_ids=[subjects["MATH"].id, subjects["SCI"].id]),
        Teacher(school_id=school1.id, name="Rohan Verma",     email="rohan.verma@springdale.edu",     max_periods_per_day=5, qualified_subject_ids=[subjects["MATH"].id, subjects["SCI"].id]),
        Teacher(school_id=school1.id, name="Shalini Gupta",   email="shalini.gupta@springdale.edu",   max_periods_per_day=5, qualified_subject_ids=[subjects["MATH"].id, subjects["SCI"].id]),
        Teacher(school_id=school1.id, name="Nikhil Patil",    email="nikhil.patil@springdale.edu",    max_periods_per_day=5, qualified_subject_ids=[subjects["MATH"].id, subjects["SCI"].id]),

        # English & Social Studies teachers
        Teacher(school_id=school1.id, name="Kavya Menon",     email="kavya.menon@springdale.edu",     max_periods_per_day=5, qualified_subject_ids=[subjects["ENG"].id, subjects["SST"].id]),
        Teacher(school_id=school1.id, name="Aditya Iyer",     email="aditya.iyer@springdale.edu",     max_periods_per_day=5, qualified_subject_ids=[subjects["ENG"].id, subjects["SST"].id]),
        Teacher(school_id=school1.id, name="Pooja Tiwari",    email="pooja.tiwari@springdale.edu",    max_periods_per_day=5, qualified_subject_ids=[subjects["ENG"].id, subjects["SST"].id]),
        Teacher(school_id=school1.id, name="Manish Chandra",  email="manish.chandra@springdale.edu",  max_periods_per_day=5, qualified_subject_ids=[subjects["ENG"].id, subjects["SST"].id]),
        Teacher(school_id=school1.id, name="Lalitha Subramanian", email="lalitha.s@springdale.edu",  max_periods_per_day=5, qualified_subject_ids=[subjects["ENG"].id, subjects["SST"].id]),

        # Hindi teachers
        Teacher(school_id=school1.id, name="Geeta Pandey",    email="geeta.pandey@springdale.edu",    max_periods_per_day=5, qualified_subject_ids=[subjects["HIN"].id]),
        Teacher(school_id=school1.id, name="Ramesh Tripathi", email="ramesh.tripathi@springdale.edu", max_periods_per_day=5, qualified_subject_ids=[subjects["HIN"].id]),

        # Computer Science teachers
        Teacher(school_id=school1.id, name="Swati Kulkarni",  email="swati.kulkarni@springdale.edu",  max_periods_per_day=5, qualified_subject_ids=[subjects["CS"].id]),
        Teacher(school_id=school1.id, name="Dev Malhotra",    email="dev.malhotra@springdale.edu",    max_periods_per_day=5, qualified_subject_ids=[subjects["CS"].id]),
    ]
    db.add_all(teachers)
    db.commit()

    # ----------------------------------------------------
    # School 2: Oakridge High
    # ----------------------------------------------------
    school2 = School(
        name="Oakridge High",
        subdomain="oakridge",
        timezone="America/New_York",
        terms=["Fall", "Spring"],
        working_days=[1, 2, 3, 4, 5]
    )
    db.add(school2)
    db.commit()
    db.refresh(school2)

    senior2 = GradeLevel(school_id=school2.id, name="High School", tier="SENIOR", day_end_time="15:00")
    db.add(senior2)
    db.commit()
    db.refresh(senior2)
    
    classes_senior2 = [ClassSection(school_id=school2.id, grade_id=senior2.id, name=f"12{c}") for c in "ABC"]
    db.add_all(classes_senior2)
    db.commit()

    # Period Slots
    for d in range(1, 6):
        for p in range(1, 8):
            start_time, end_time = calculate_times(p, duration_minutes=60)
            db.add(PeriodSlot(school_id=school2.id, tier="SENIOR", day_of_week=d, period_number=p, start_time=start_time, end_time=end_time, is_break=False, slot_type="REGULAR"))
    db.commit()

    sub2_data = [
        ("Math", "MATH", False),
        ("Science", "SCI", False),
        ("Robotics", "ROB", True),
        ("Debate", "DEB", True)
    ]
    subjects2 = {}
    for name, code, is_act in sub2_data:
        s = Subject(school_id=school2.id, name=name, code=code, is_activity=is_act, weekly_frequency_default=5)
        db.add(s)
        db.commit()
        db.refresh(s)
        subjects2[code] = s
        
    for cl in classes_senior2:
        db.add(ClassSubjectRequirement(school_id=school2.id, class_section_id=cl.id, subject_id=subjects2["MATH"].id, weekly_frequency=17, preferred_teacher_ids=[]))
        db.add(ClassSubjectRequirement(school_id=school2.id, class_section_id=cl.id, subject_id=subjects2["SCI"].id, weekly_frequency=16, preferred_teacher_ids=[]))
        db.add(ClassSubjectRequirement(school_id=school2.id, class_section_id=cl.id, subject_id=subjects2["ROB"].id, weekly_frequency=1, preferred_teacher_ids=[]))
        db.add(ClassSubjectRequirement(school_id=school2.id, class_section_id=cl.id, subject_id=subjects2["DEB"].id, weekly_frequency=1, preferred_teacher_ids=[]))
    db.commit()
    
    # Activity Block: Friday periods 4-5
    ab2 = ActivityBlock(school_id=school2.id, grade_tier="SENIOR", day_of_week=5, start_period=4, end_period=5, activity_types=["ROB", "DEB"])
    db.add(ab2)
    db.commit()

    teachers2 = [
        Teacher(school_id=school2.id, name="Rob1", email="r1@o.c", max_periods_per_day=5, qualified_subject_ids=[subjects2["ROB"].id]),
        Teacher(school_id=school2.id, name="Rob2", email="r2@o.c", max_periods_per_day=5, qualified_subject_ids=[subjects2["ROB"].id]),
        Teacher(school_id=school2.id, name="Deb1", email="d1@o.c", max_periods_per_day=5, qualified_subject_ids=[subjects2["DEB"].id]),
        Teacher(school_id=school2.id, name="Deb2", email="d2@o.c", max_periods_per_day=5, qualified_subject_ids=[subjects2["DEB"].id]),
        Teacher(school_id=school2.id, name="Math1", email="m1@o.c", max_periods_per_day=5, qualified_subject_ids=[subjects2["MATH"].id]),
        Teacher(school_id=school2.id, name="Math2", email="m2@o.c", max_periods_per_day=5, qualified_subject_ids=[subjects2["MATH"].id]),
        Teacher(school_id=school2.id, name="Sci1", email="s1@o.c", max_periods_per_day=5, qualified_subject_ids=[subjects2["SCI"].id]),
        Teacher(school_id=school2.id, name="Sci2", email="s2@o.c", max_periods_per_day=5, qualified_subject_ids=[subjects2["SCI"].id]),
    ]
    db.add_all(teachers2)
    db.commit()
    
    from backend.auth_utils import hash_password
    
    admin1 = User(
        school_id=school1.id,
        email="admin@springdale.edu",
        hashed_password=hash_password("password123"),
        role="ADMIN"
    )
    admin2 = User(
        school_id=school2.id,
        email="admin@oakridge.edu",
        hashed_password=hash_password("password123"),
        role="ADMIN"
    )
    db.add_all([admin1, admin2])
    db.commit()
    
    db.close()

    print("[Seed] Successfully seeded 2 schools.")
    
if __name__ == "__main__":
    seed()
