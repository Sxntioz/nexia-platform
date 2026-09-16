"""Esquema inicial de NEXIA."""
from alembic import op
import sqlalchemy as sa

revision = "20260827_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("reports", sa.Column("id", sa.String(36), primary_key=True), sa.Column("public_code", sa.String(16), nullable=False), sa.Column("reporter_name", sa.String(120), nullable=False), sa.Column("incident_type", sa.String(40), nullable=False), sa.Column("incident_date", sa.Date(), nullable=False), sa.Column("approximate_time", sa.Time(), nullable=False), sa.Column("location", sa.String(160), nullable=False), sa.Column("involved_aliases", sa.Text()), sa.Column("description", sa.Text(), nullable=False), sa.Column("status", sa.String(32), nullable=False), sa.Column("public_summary", sa.Text()), sa.Column("rejection_reason", sa.Text()), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False), sa.UniqueConstraint("public_code"))
    op.create_index("ix_reports_public_code", "reports", ["public_code"], unique=True)
    op.create_index("ix_reports_status", "reports", ["status"])
    op.create_index("ix_reports_incident_type", "reports", ["incident_type"])
    op.create_table("cameras", sa.Column("id", sa.String(36), primary_key=True), sa.Column("identifier", sa.String(30), nullable=False, unique=True), sa.Column("label", sa.String(80), nullable=False), sa.Column("location", sa.String(160), nullable=False), sa.Column("is_active", sa.Boolean(), nullable=False))
    op.create_table("evidence_clips", sa.Column("id", sa.String(36), primary_key=True), sa.Column("report_id", sa.String(36), sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False), sa.Column("camera_id", sa.String(36), sa.ForeignKey("cameras.id"), nullable=False), sa.Column("original_name", sa.String(255), nullable=False), sa.Column("stored_name", sa.String(255), nullable=False, unique=True), sa.Column("mime_type", sa.String(80), nullable=False), sa.Column("size_bytes", sa.BigInteger(), nullable=False), sa.Column("recording_started_at", sa.DateTime(timezone=True), nullable=False), sa.Column("duration_seconds", sa.Integer(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_evidence_report", "evidence_clips", ["report_id"])
    op.create_table("analysis_jobs", sa.Column("id", sa.String(36), primary_key=True), sa.Column("report_id", sa.String(36), sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False), sa.Column("evidence_id", sa.String(36), sa.ForeignKey("evidence_clips.id", ondelete="CASCADE"), nullable=False), sa.Column("status", sa.String(24), nullable=False), sa.Column("model", sa.String(80), nullable=False), sa.Column("started_at", sa.DateTime(timezone=True)), sa.Column("completed_at", sa.DateTime(timezone=True)), sa.Column("safe_error", sa.Text()), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_analysis_report", "analysis_jobs", ["report_id"])
    op.create_table("analysis_results", sa.Column("id", sa.String(36), primary_key=True), sa.Column("job_id", sa.String(36), sa.ForeignKey("analysis_jobs.id", ondelete="CASCADE"), nullable=False, unique=True), sa.Column("temporal_match", sa.Boolean(), nullable=False), sa.Column("spatial_match", sa.Boolean(), nullable=False), sa.Column("event_match", sa.String(24), nullable=False), sa.Column("suggested_type", sa.String(80)), sa.Column("summary", sa.Text(), nullable=False), sa.Column("confidence_level", sa.String(24), nullable=False), sa.Column("relevant_moments_json", sa.Text(), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("admin_decisions", sa.Column("id", sa.String(36), primary_key=True), sa.Column("result_id", sa.String(36), sa.ForeignKey("analysis_results.id", ondelete="CASCADE"), nullable=False, unique=True), sa.Column("decision", sa.String(24), nullable=False), sa.Column("observation", sa.Text()), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))


def downgrade() -> None:
    op.drop_table("admin_decisions")
    op.drop_table("analysis_results")
    op.drop_table("analysis_jobs")
    op.drop_table("evidence_clips")
    op.drop_table("cameras")
    op.drop_table("reports")
