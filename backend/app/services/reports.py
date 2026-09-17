import json
import secrets
import string
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AnalysisJob, Camera, Report


ALPHABET = string.ascii_uppercase + string.digits


def create_public_code(db: Session) -> str:
    for _ in range(12):
        code = "NEX-" + "".join(secrets.choice(ALPHABET) for _ in range(8))
        if not db.scalar(select(Report.id).where(Report.public_code == code)):
            return code
    raise RuntimeError("No fue posible generar un código único")


def admin_report_dict(report: Report) -> dict:
    return {column.name: getattr(report, column.name) for column in Report.__table__.columns}


def public_report_dict(report: Report) -> dict:
    allowed = ("public_code", "incident_type", "incident_date", "status", "public_summary", "created_at", "updated_at")
    return {key: getattr(report, key) for key in allowed}


def analysis_dict(job: AnalysisJob) -> dict:
    data = {
        "id": job.id,
        "report_id": job.report_id,
        "evidence_id": job.evidence_id,
        "status": job.status,
        "model": job.model,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
        "safe_error": job.safe_error,
    }
    if job.result:
        data.update(
            temporal_match=job.result.temporal_match,
            spatial_match=job.result.spatial_match,
            event_match=job.result.event_match,
            suggested_type=job.result.suggested_type,
            summary=job.result.summary,
            confidence_level=job.result.confidence_level,
            relevant_moments=json.loads(job.result.relevant_moments_json),
        )
    return data


import unicodedata


def _clean_str(text: str) -> str:
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKD", text).encode("ASCII", "ignore").decode("utf-8")
    return " ".join(normalized.casefold().split())


def check_recording_match(
    location: str,
    incident_date: date,
    time_start: time,
    time_end: time,
    camera: Camera | None,
    recording_started_at: datetime,
    duration_seconds: int,
) -> tuple[bool, bool]:
    report_start = datetime.combine(incident_date, time_start)
    report_end = datetime.combine(incident_date, time_end)
    
    start = recording_started_at.replace(tzinfo=None) if hasattr(recording_started_at, "tzinfo") else recording_started_at
    end = start + timedelta(seconds=duration_seconds)
    
    # Chequeo temporal (con 15 min de margen)
    temporal = (start - timedelta(minutes=15)) <= report_end and (end + timedelta(minutes=15)) >= report_start
    
    # Chequeo con diferencias horarias estándar UTC / Colombia (UTC-5)
    if not temporal:
        for offset in [-5, -4, -6, 5]:
            start_adj = start + timedelta(hours=offset)
            end_adj = start_adj + timedelta(seconds=duration_seconds)
            if (start_adj - timedelta(minutes=15)) <= report_end and (end_adj + timedelta(minutes=15)) >= report_start:
                temporal = True
                break

    rep_loc = _clean_str(location)
    cam_loc = _clean_str(camera.location) if camera else ""
    cam_label = _clean_str(camera.label) if camera else ""
    
    spatial = (
        rep_loc in cam_loc or cam_loc in rep_loc or
        rep_loc in cam_label or cam_label in rep_loc or
        rep_loc == "otra ubicacion" or not rep_loc
    )
    return bool(temporal), bool(spatial)


def metadata_matches(report: Report, camera: Camera, recording_started_at: datetime, duration_seconds: int) -> tuple[bool, bool]:
    return check_recording_match(
        report.location,
        report.incident_date,
        report.approximate_time_start,
        report.approximate_time_end,
        camera,
        recording_started_at,
        duration_seconds,
    )


def find_matching_recording(
    db: Session,
    location: str,
    incident_date: date,
    time_start: time,
    time_end: time,
):
    from app.models import CameraRecording
    from sqlalchemy.orm import joinedload
    recordings = db.scalars(select(CameraRecording).options(joinedload(CameraRecording.camera))).all()
    for rec in recordings:
        temporal, spatial = check_recording_match(
            location, incident_date, time_start, time_end, rec.camera, rec.recording_started_at, rec.duration_seconds
        )
        if temporal and spatial:
            return rec
    return None

