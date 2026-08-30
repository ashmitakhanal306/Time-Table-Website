from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class School(Base):
    __tablename__ = 'schools'
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    subdomain = Column(String, unique=True, nullable=False)
    timezone = Column(String, default="UTC")
    terms = Column(JSON)
    working_days = Column(JSON)

class GradeLevel(Base):
    __tablename__ = 'grade_levels'
    id = Column(Integer, primary_key=True)
    school_id = Column(Integer, ForeignKey('schools.id'), nullable=False)
    name = Column(String, nullable=False)
    tier = Column(String, nullable=False) # PRIMARY or SENIOR
    day_end_time = Column(String, nullable=False)

class ClassSection(Base):
    __tablename__ = 'class_sections'
    id = Column(Integer, primary_key=True)
    school_id = Column(Integer, ForeignKey('schools.id'), nullable=False)
    grade_id = Column(Integer, ForeignKey('grade_levels.id'), nullable=False)
    name = Column(String, nullable=False)

class Subject(Base):
    __tablename__ = 'subjects'
    id = Column(Integer, primary_key=True)
    school_id = Column(Integer, ForeignKey('schools.id'), nullable=False)
    name = Column(String, nullable=False)
    code = Column(String, nullable=False)
    is_activity = Column(Boolean, default=False)
    weekly_frequency_default = Column(Integer)

class ClassSubjectRequirement(Base):
    __tablename__ = 'class_subject_requirements'
    id = Column(Integer, primary_key=True)
    school_id = Column(Integer, ForeignKey('schools.id'), nullable=False)
    class_section_id = Column(Integer, ForeignKey('class_sections.id'), nullable=False)
    subject_id = Column(Integer, ForeignKey('subjects.id'), nullable=False)
    weekly_frequency = Column(Integer, nullable=False)
    preferred_teacher_ids = Column(JSON)

class Teacher(Base):
    __tablename__ = 'teachers'
    id = Column(Integer, primary_key=True)
    school_id = Column(Integer, ForeignKey('schools.id'), nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    max_periods_per_day = Column(Integer, default=5)
    qualified_subject_ids = Column(JSON)

class PeriodSlot(Base):
    __tablename__ = 'period_slots'
    id = Column(Integer, primary_key=True)
    school_id = Column(Integer, ForeignKey('schools.id'), nullable=False)
    tier = Column(String, nullable=False)
    day_of_week = Column(Integer, nullable=False)
    period_number = Column(Integer, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    is_break = Column(Boolean, default=False)
    slot_type = Column(String, nullable=False) # ZERO/REGULAR/SHORT_BREAK/LUNCH

class ActivityBlock(Base):
    __tablename__ = 'activity_blocks'
    id = Column(Integer, primary_key=True)
    school_id = Column(Integer, ForeignKey('schools.id'), nullable=False)
    grade_tier = Column(String, nullable=False)
    day_of_week = Column(Integer, nullable=False)
    start_period = Column(Integer, nullable=False)
    end_period = Column(Integer, nullable=False)
    activity_types = Column(JSON)

class TimetableEntry(Base):
    __tablename__ = 'timetable_entries'
    id = Column(Integer, primary_key=True)
    school_id = Column(Integer, ForeignKey('schools.id'), nullable=False)
    class_section_id = Column(Integer, ForeignKey('class_sections.id'), nullable=False)
    day_of_week = Column(Integer, nullable=False)
    period_number = Column(Integer, nullable=False)
    subject_id = Column(Integer, ForeignKey('subjects.id'), nullable=False)
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False)
    room_name = Column(String)
    is_manual_override = Column(Boolean, default=False)
    is_published = Column(Boolean, default=False)

class TeacherAbsence(Base):
    __tablename__ = 'teacher_absences'
    id = Column(Integer, primary_key=True)
    school_id = Column(Integer, ForeignKey('schools.id'), nullable=False)
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False)
    date = Column(String, nullable=False)
    period_number = Column(Integer, nullable=False)
    substitute_teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=True)

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True)
    school_id = Column(Integer, ForeignKey('schools.id'), nullable=True)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False) # ADMIN/TEACHER/STUDENT
    linked_teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=True)
    linked_class_section_id = Column(Integer, ForeignKey('class_sections.id'), nullable=True)
