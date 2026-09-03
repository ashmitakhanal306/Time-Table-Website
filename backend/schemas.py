from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class LoginRequest(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class SchoolResponse(BaseModel):
    id: int
    name: str
    subdomain: str
    timezone: Optional[str] = None
    working_days: Optional[List[int]] = None
    terms: Optional[Any] = None

    class Config:
        from_attributes = True

class SchoolUpdateRequest(BaseModel):
    name: Optional[str] = None
    working_days: Optional[List[int]] = None
    terms: Optional[Any] = None
    timezone: Optional[str] = None

class GenerateResponse(BaseModel):
    status: str
    entry_count: int
    infeasibility_reason: Optional[str] = None

class OverrideRequest(BaseModel):
    teacher_id: Optional[int] = None
    room_name: Optional[str] = None
    day_of_week: Optional[int] = None
    period_number: Optional[int] = None

class AssignAbsenceRequest(BaseModel):
    teacher_id: int
    date: str
    period_number: int
    substitute_teacher_id: Optional[int] = None

class SchoolCreateRequest(BaseModel):
    name: str
    subdomain: str
    admin_email: str
    admin_password: str

class GradeLevelCreate(BaseModel):
    name: str
    tier: str
    day_end_time: str

class GradeLevelUpdate(BaseModel):
    name: Optional[str] = None
    tier: Optional[str] = None
    day_end_time: Optional[str] = None

class ClassSectionCreate(BaseModel):
    name: str
    grade_id: int

class ClassSectionUpdate(BaseModel):
    name: Optional[str] = None
    grade_id: Optional[int] = None

class SubjectCreate(BaseModel):
    name: str
    code: str
    is_activity: bool = False
    weekly_frequency_default: int = 0

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    is_activity: Optional[bool] = None
    weekly_frequency_default: Optional[int] = None

class TeacherCreate(BaseModel):
    name: str
    email: str
    max_periods_per_day: int = 5
    qualified_subject_ids: List[int] = []

class TeacherUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    max_periods_per_day: Optional[int] = None
    qualified_subject_ids: Optional[List[int]] = None

class ClassSubjectRequirementCreate(BaseModel):
    class_section_id: int
    subject_id: int
    weekly_frequency: int
    preferred_teacher_ids: List[int] = []

class ClassSubjectRequirementUpdate(BaseModel):
    class_section_id: Optional[int] = None
    subject_id: Optional[int] = None
    weekly_frequency: Optional[int] = None
    preferred_teacher_ids: Optional[List[int]] = None

class ActivityBlockCreate(BaseModel):
    grade_tier: str
    day_of_week: int
    start_period: int
    end_period: int
    activity_types: List[str] = []

class ActivityBlockUpdate(BaseModel):
    grade_tier: Optional[str] = None
    day_of_week: Optional[int] = None
    start_period: Optional[int] = None
    end_period: Optional[int] = None
    activity_types: Optional[List[str]] = None

class PeriodSlotRequest(BaseModel):
    period_number: int
    start_time: str
    end_time: str
    is_break: bool = False
    slot_type: str

class PeriodStructureRequest(BaseModel):
    tier: str
    slots: List[PeriodSlotRequest]
