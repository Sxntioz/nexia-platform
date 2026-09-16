from datetime import date, datetime, time, timezone
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import BigInteger, Boolean, Date, DateTime, ForeignKey, String, Text, Time
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ReportStatus(StrEnum):
    SUBMITTED = "SUBMITTED"
    REJECTED = "REJECTED"
    AWAITING_VIDEO = "AWAITING_VIDEO"
    ANALYZING = "ANALYZING"
    ANALYSIS_FAILED = "ANALYSIS_FAILED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    CONFIRMED = "CONFIRMED"
    NOT_CONCLUSIVE = "NOT_CONCLUSIVE"


class JobStatus(StrEnum):
    QUEUED = "QUEUED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class DecisionType(StrEnum):
    CONFIRMED = "CONFIRMED"
    NOT_CONCLUSIVE = "NOT_CONCLUSIVE"


class UserRole(StrEnum):
    ADMIN = "ADMIN"
    USER = "USER"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    institution_relation: Mapped[str] = mapped_column(String(30))  # "Estudiante" | "Acudiente"
    shift: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "JM" | "JT"
    course: Mapped[str | None] = mapped_column(String(40), nullable=True)  # ej. "1002"
    role: Mapped[str] = mapped_column(String(20), default=UserRole.USER, index=True)
    is_sanctioned: Mapped[bool] = mapped_column(Boolean, default=False)
    sanction_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    reports: Mapped[list["Report"]] = relationship(back_populates="user")
    appeals: Mapped[list["Appeal"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class AppealStatus(StrEnum):
    PENDING = "PENDING"
    RESOLVED = "RESOLVED"


class Appeal(Base):
    __tablename__ = "appeals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default=AppealStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="appeals")



class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    public_code: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    reporter_name: Mapped[str] = mapped_column(String(120))
    incident_type: Mapped[str] = mapped_column(String(40), index=True)
    incident_date: Mapped[date] = mapped_column(Date)
    approximate_time_start: Mapped[time] = mapped_column(Time)
    approximate_time_end: Mapped[time] = mapped_column(Time)
    location: Mapped[str] = mapped_column(String(160))
    involved_aliases: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default=ReportStatus.SUBMITTED, index=True)
    public_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user: Mapped["User | None"] = relationship(back_populates="reports")
    evidence: Mapped[list["EvidenceClip"]] = relationship(back_populates="report", cascade="all, delete-orphan")
    analysis_jobs: Mapped[list["AnalysisJob"]] = relationship(back_populates="report", cascade="all, delete-orphan")


class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    identifier: Mapped[str] = mapped_column(String(30), unique=True)
    label: Mapped[str] = mapped_column(String(80))
    location: Mapped[str] = mapped_column(String(160))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    evidence: Mapped[list["EvidenceClip"]] = relationship(back_populates="camera")
    recordings: Mapped[list["CameraRecording"]] = relationship(back_populates="camera", cascade="all, delete-orphan")


class CameraRecording(Base):
    __tablename__ = "camera_recordings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    camera_id: Mapped[str] = mapped_column(ForeignKey("cameras.id", ondelete="CASCADE"), index=True)
    original_name: Mapped[str] = mapped_column(String(255))
    stored_name: Mapped[str] = mapped_column(String(255), unique=True)
    mime_type: Mapped[str] = mapped_column(String(80))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    recording_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    camera: Mapped[Camera] = relationship(back_populates="recordings")


class EvidenceClip(Base):
    __tablename__ = "evidence_clips"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    camera_id: Mapped[str] = mapped_column(ForeignKey("cameras.id"), index=True)
    original_name: Mapped[str] = mapped_column(String(255))
    stored_name: Mapped[str] = mapped_column(String(255), index=True)
    mime_type: Mapped[str] = mapped_column(String(80))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    recording_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    report: Mapped[Report] = relationship(back_populates="evidence")
    camera: Mapped[Camera] = relationship(back_populates="evidence")
    analysis_jobs: Mapped[list["AnalysisJob"]] = relationship(back_populates="evidence", cascade="all, delete-orphan")


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence_clips.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(24), default=JobStatus.QUEUED)
    model: Mapped[str] = mapped_column(String(80))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    safe_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    report: Mapped[Report] = relationship(back_populates="analysis_jobs")
    evidence: Mapped[EvidenceClip] = relationship(back_populates="analysis_jobs")
    result: Mapped["AnalysisResult | None"] = relationship(back_populates="job", cascade="all, delete-orphan", uselist=False)


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    job_id: Mapped[str] = mapped_column(ForeignKey("analysis_jobs.id", ondelete="CASCADE"), unique=True)
    temporal_match: Mapped[bool] = mapped_column(Boolean)
    spatial_match: Mapped[bool] = mapped_column(Boolean)
    event_match: Mapped[str] = mapped_column(String(24))
    suggested_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    summary: Mapped[str] = mapped_column(Text)
    confidence_level: Mapped[str] = mapped_column(String(24))
    relevant_moments_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    job: Mapped[AnalysisJob] = relationship(back_populates="result")
    decision: Mapped["AdminDecision | None"] = relationship(back_populates="result", cascade="all, delete-orphan", uselist=False)


class AdminDecision(Base):
    __tablename__ = "admin_decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    result_id: Mapped[str] = mapped_column(ForeignKey("analysis_results.id", ondelete="CASCADE"), unique=True)
    decision: Mapped[str] = mapped_column(String(24))
    observation: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    result: Mapped[AnalysisResult] = relationship(back_populates="decision")
