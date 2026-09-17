from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field, field_validator


IncidentType = Literal[
    "THEFT", "FIGHT", "INAPPROPRIATE_BEHAVIOR",
    "AGGRESSION", "BULLYING", "DAMAGE", "ACCIDENT", "UNSAFE_CONDUCT", "OTHER"
]


class UserRegister(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=120)
    password: str = Field(min_length=6, max_length=100)
    institution_relation: Literal["Estudiante", "Acudiente"]
    shift: Literal["JM", "JT"] | None = None
    course: str | None = Field(default=None, max_length=40)

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value or "." not in value.split("@")[-1]:
            raise ValueError("Ingresa un correo electrónico válido")
        return value

    @field_validator("full_name")
    @classmethod
    def clean_full_name(cls, value: str) -> str:
        return value.strip()


class UserLogin(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def clean_email(cls, value: str) -> str:
        return value.strip().lower()


class UserResponse(BaseModel):
    id: str
    full_name: str
    email: str
    institution_relation: str
    shift: str | None = None
    course: str | None = None
    role: str
    is_sanctioned: bool = False
    sanction_reason: str | None = None
    created_at: datetime


class UserRoleUpdate(BaseModel):
    role: Literal["ADMIN", "USER"]


class SanctionRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class AppealCreate(BaseModel):
    user_id: str
    message: str = Field(min_length=10, max_length=1000)


class AppealResponse(BaseModel):
    id: str
    user_id: str
    message: str
    status: str
    created_at: datetime
    resolved_at: datetime | None
    
    # We'll embed user basic info for admin
    user_full_name: str | None = None
    user_email: str | None = None
    user_relation: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ReportCreate(BaseModel):
    reporter_name: str | None = Field(default=None, max_length=120)
    incident_type: IncidentType
    incident_date: date
    approximate_time_start: time
    approximate_time_end: time
    location: str = Field(min_length=3, max_length=160)
    involved_aliases: str | None = Field(default=None, max_length=500)
    description: str = Field(min_length=20, max_length=2000)

    @field_validator("incident_date")
    @classmethod
    def not_future(cls, value: date) -> date:
        if value > date.today():
            raise ValueError("La fecha no puede estar en el futuro")
        return value

    @field_validator("approximate_time_end")
    @classmethod
    def check_time_order(cls, value: time, info) -> time:
        if "approximate_time_start" in info.data:
            if value <= info.data["approximate_time_start"]:
                raise ValueError("La hora de fin debe ser mayor a la hora de inicio")
        return value

    @field_validator("location", "description")
    @classmethod
    def clean_required(cls, value: str) -> str:
        return value.strip()


class ReportCreated(BaseModel):
    id: str
    public_code: str
    status: str
    created_at: datetime


class PublicReport(BaseModel):
    public_code: str
    incident_type: str
    incident_date: date
    status: str
    public_summary: str | None
    created_at: datetime
    updated_at: datetime


class AdminReport(BaseModel):
    id: str
    public_code: str
    reporter_name: str
    incident_type: str
    incident_date: date
    approximate_time_start: time
    approximate_time_end: time
    location: str
    involved_aliases: str | None
    description: str
    status: str
    public_summary: str | None
    rejection_reason: str | None
    created_at: datetime
    updated_at: datetime


class RejectRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class CameraResponse(BaseModel):
    id: str
    identifier: str
    label: str
    location: str


class RecordingResponse(BaseModel):
    id: str
    camera_id: str
    camera_label: str | None = None
    camera_location: str | None = None
    original_name: str
    mime_type: str
    size_bytes: int
    recording_started_at: datetime
    duration_seconds: int
    created_at: datetime


class PresignedUploadRequest(BaseModel):
    camera_id: str
    original_name: str
    mime_type: str = "video/mp4"
    size_bytes: int = Field(gt=0)
    recording_started_at: datetime
    duration_seconds: int = Field(ge=1, le=7200)


class PresignedUploadResponse(BaseModel):
    s3_upload: bool
    upload_url: str | None = None
    stored_name: str | None = None


class CompleteUploadRequest(BaseModel):
    camera_id: str
    recording_started_at: datetime
    duration_seconds: int = Field(ge=1, le=7200)
    stored_name: str
    original_name: str
    mime_type: str = "video/mp4"
    size_bytes: int = Field(gt=0)


class RecordingUpdateRequest(BaseModel):
    camera_id: str | None = None
    original_name: str | None = None
    recording_started_at: datetime | None = None
    duration_seconds: int | None = Field(default=None, ge=1, le=7200)


class EvidenceResponse(BaseModel):
    id: str
    report_id: str
    camera_id: str
    original_name: str
    mime_type: str
    size_bytes: int
    recording_started_at: datetime
    duration_seconds: int
    created_at: datetime
    temporal_match: bool | None = None
    spatial_match: bool | None = None


class RelevantMoment(BaseModel):
    timestamp_seconds: int = Field(ge=0)
    label: str = Field(min_length=2, max_length=160)
    description: str = Field(min_length=2, max_length=500)


class GeminiAnalysis(BaseModel):
    event_match: Literal["LIKELY", "UNCERTAIN", "NOT_OBSERVED"]
    suggested_type: str | None = Field(default=None, max_length=80)
    summary: str = Field(min_length=10, max_length=1200)
    confidence_level: Literal["HIGH", "MEDIUM", "LOW"]
    relevant_moments: list[RelevantMoment] = Field(default_factory=list, max_length=8)


class AnalysisResponse(BaseModel):
    id: str
    report_id: str
    evidence_id: str
    status: str
    model: str
    started_at: datetime | None
    completed_at: datetime | None
    safe_error: str | None
    temporal_match: bool | None = None
    spatial_match: bool | None = None
    event_match: str | None = None
    suggested_type: str | None = None
    summary: str | None = None
    confidence_level: str | None = None
    relevant_moments: list[RelevantMoment] = Field(default_factory=list)


class DecisionRequest(BaseModel):
    decision: Literal["CONFIRMED", "NOT_CONCLUSIVE"]
    observation: str | None = Field(default=None, max_length=1000)


class MessageResponse(BaseModel):
    message: str


class ChatMessage(BaseModel):
    role: Literal["user", "model", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    context_mode: Literal["user", "admin"] = "user"
    history: list[ChatMessage] = Field(default_factory=list, max_length=20)


class ChatResponse(BaseModel):
    reply: str
    suggested_actions: list[str] = Field(default_factory=list)

