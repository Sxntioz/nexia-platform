import json
import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path

from google import genai
from google.genai import errors, types
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.db.session import get_session_factory
from app.models import AnalysisJob, AnalysisResult, EvidenceClip, JobStatus, ReportStatus
from app.schemas.reports import GeminiAnalysis
from app.services.reports import metadata_matches

logger = logging.getLogger(__name__)


def observable_context(description: str, aliases: str | None) -> str:
    """Conserva pistas observables, pero minimiza datos de contacto e identidades conocidas."""
    safe = re.sub(r"[\w.+-]+@[\w-]+\.[\w.-]+", "[dato oculto]", description)
    safe = re.sub(r"\+?\d[\d\s().-]{6,}\d", "[dato oculto]", safe)
    if aliases:
        for alias in re.split(r"[,;\n]+", aliases):
            alias = alias.strip()
            if len(alias) > 1:
                safe = re.sub(re.escape(alias), "[persona]", safe, flags=re.IGNORECASE)
    return safe.strip()[:1200]


def _safe_error(exc: Exception) -> str:
    message = str(exc).casefold()
    if isinstance(exc, KeyError) and "file" in message:
        return "Google Gemini rechazó la subida del video. Verifica que la API Key en el archivo .env sea válida y que el archivo no supere el límite de 2.0 GB de la API de Google."
    if getattr(exc, "status_code", None) == 503:
        return "Los modelos de Gemini están temporalmente saturados. Intenta de nuevo en unos minutos."
    if "api key" in message or "unauth" in message or "permission" in message or "invalid_argument" in message:
        return "Gemini rechazó la autenticación. Revisa que tu GEMINI_API_KEY en el archivo .env sea válida (suele empezar por AIzaSy...)."
    if "quota" in message or "resource_exhausted" in message:
        return "Gemini no tiene cuota disponible en este momento."
    if "model" in message and ("not found" in message or "unsupported" in message):
        return f"El modelo {settings.gemini_model} no está disponible para esta clave."
    return f"Error en el análisis de Gemini: {str(exc)[:150]}"


def process_analysis(job_id: str) -> None:
    factory = get_session_factory()
    with factory() as db:
        job = db.query(AnalysisJob).options(
            joinedload(AnalysisJob.report),
            joinedload(AnalysisJob.evidence).joinedload(EvidenceClip.camera),
        ).filter(AnalysisJob.id == job_id).one()
        job.status = JobStatus.PROCESSING
        job.started_at = datetime.now(timezone.utc)
        db.commit()

        uploaded = None
        stage = "preparando el análisis"
        try:
            if not settings.gemini_api_key:
                raise RuntimeError("API key missing")
            clip = job.evidence
            clip_path = settings.upload_dir / clip.stored_name
            if not Path(clip_path).is_file():
                raise RuntimeError("Video local missing")

            stage = "conectando con Gemini"
            client = genai.Client(api_key=settings.gemini_api_key)
            stage = "subiendo el clip a Gemini"
            uploaded = client.files.upload(file=str(clip_path))
            deadline = time.monotonic() + 900  # 15 minutos de margen para videos pesados de 1 a 2 GB
            stage = "esperando el procesamiento del clip en los servidores de Google"
            while not getattr(uploaded, "state", None) or getattr(uploaded.state, "name", "") == "PROCESSING":
                if time.monotonic() >= deadline:
                    raise TimeoutError("Gemini file processing timeout (el video tardó más de 15 minutos en procesarse en Google)")
                time.sleep(3)
                uploaded = client.files.get(name=uploaded.name)
            if getattr(uploaded.state, "name", "") != "ACTIVE":
                raise RuntimeError(f"Gemini no pudo procesar el archivo de video. Estado: {getattr(uploaded.state, 'name', 'DESCONOCIDO')}")

            stage = "solicitando el análisis de video"
            context = observable_context(job.report.description, job.report.involved_aliases)
            
            time_focus = ""
            if job.report.approximate_time_start and job.report.approximate_time_end:
                rec_start = clip.recording_started_at.replace(tzinfo=None) if hasattr(clip.recording_started_at, 'tzinfo') else clip.recording_started_at
                rep_start = datetime.combine(job.report.incident_date, job.report.approximate_time_start)
                rep_end = datetime.combine(job.report.incident_date, job.report.approximate_time_end)
                
                sec_start = max(0, int((rep_start - rec_start).total_seconds()))
                sec_end = min(clip.duration_seconds, int((rep_end - rec_start).total_seconds()))
                
                if sec_start > clip.duration_seconds or sec_end < 0:
                    for offset in [-5, -4, -6, 5]:
                        adj = rec_start + timedelta(hours=offset)
                        s = max(0, int((rep_start - adj).total_seconds()))
                        e = min(clip.duration_seconds, int((rep_end - adj).total_seconds()))
                        if 0 <= s <= clip.duration_seconds:
                            sec_start, sec_end = s, e
                            break

                time_focus = f"""
VENTANA DE TIEMPO CLAVE REPORTADA POR EL USUARIO:
- Rango de hora solicitado: {job.report.approximate_time_start.strftime('%H:%M')} a {job.report.approximate_time_end.strftime('%H:%M')}
- En este video de {clip.duration_seconds} segundos, ese fragmento se ubica aproximadamente entre el SEGUNDO {sec_start} y el SEGUNDO {sec_end}.
- ENFÓCATE PRINCIPALMENTE en este fragmento de tiempo específico para buscar los hechos descritos y extraer los momentos relevantes con la mayor precisión posible.
"""

            prompt = f"""Analiza este clip de una cámara escolar autorizada.
El reporte busca un evento del tipo: {job.report.incident_type}.
{time_focus}
Revisa el clip completo, prestando especial atención a la ventana de tiempo indicada y a interacciones con objetos,
bolsos, bicicletas, maletas, peleas, conductas inadecuadas y cambios de posesión o forcejeos.
Busca una secuencia observable: aproximación, acción, manipulación o retiro de un objeto y alejamiento.
No des por cierto el reporte: indica con honestidad si no se ve la secuencia completa o si la distancia/ángulo del video impide concluir.

Contexto visual y descripción reportada por el usuario:
{context}

Describe únicamente acciones observables. No identifiques rostros o personas, no infieras identidad,
intención, culpabilidad, raza, salud ni atributos sensibles. No llames "hurto" a una persona;
usa expresiones como "posible retiro de objeto", "forcejeo observable" o "acción no concluyente".
Devuelve todos los momentos candidatos como segundos desde el inicio del video. La confianza debe calificar exclusivamente la
claridad de la posible acción reportada. La respuesta es apoyo preliminar y será revisada por una persona administradora."""
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GeminiAnalysis,
                temperature=0.1,
            )
            try:
                response = client.models.generate_content(
                    model=settings.gemini_model, contents=[uploaded, prompt], config=config
                )
            except errors.ServerError as exc:
                if exc.status_code != 503 or settings.gemini_fallback_model == settings.gemini_model:
                    raise
                logger.warning(
                    "Gemini devolvió 503 para %s; se intenta el respaldo %s.",
                    settings.gemini_model, settings.gemini_fallback_model,
                )
                job.model = settings.gemini_fallback_model
                response = client.models.generate_content(
                    model=settings.gemini_fallback_model, contents=[uploaded, prompt], config=config
                )
            stage = "validando la respuesta de Gemini"
            parsed = response.parsed or GeminiAnalysis.model_validate_json(response.text)
            temporal, spatial = metadata_matches(
                job.report, clip.camera, clip.recording_started_at, clip.duration_seconds
            )
            result = AnalysisResult(
                job_id=job.id,
                temporal_match=temporal,
                spatial_match=spatial,
                event_match=parsed.event_match,
                suggested_type=parsed.suggested_type,
                summary=parsed.summary,
                confidence_level=parsed.confidence_level,
                relevant_moments_json=json.dumps([item.model_dump() for item in parsed.relevant_moments]),
            )
            db.add(result)
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.now(timezone.utc)
            job.report.status = ReportStatus.REVIEW_REQUIRED
            job.safe_error = None
            db.commit()
        except Exception as exc:
            logger.exception("Falló el análisis de Gemini en la etapa: %s", stage)
            db.rollback()
            job = db.get(AnalysisJob, job_id)
            job.status = JobStatus.FAILED
            job.completed_at = datetime.now(timezone.utc)
            job.safe_error = _safe_error(exc)
            job.report.status = ReportStatus.ANALYSIS_FAILED
            db.commit()
        finally:
            if uploaded is not None:
                try:
                    client.files.delete(name=uploaded.name)
                except Exception:
                    pass
