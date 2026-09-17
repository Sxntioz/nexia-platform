import json
import logging
import re
import subprocess
import time
from datetime import datetime, timedelta, timezone
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
        temp_downloaded_from_s3 = False
        temp_fragment_path = None
        clip_path = None
        stage = "preparando el análisis"
        try:
            if not settings.gemini_api_key:
                raise RuntimeError("API key missing")
            clip = job.evidence
            clip_path = settings.upload_dir / clip.stored_name
            temp_fragment_path = settings.upload_dir / f"fragment_{job.id}.mp4"

            # 1. Calcular exactamente el fragmento indicado en el reporte del usuario
            rec_start = clip.recording_started_at.replace(tzinfo=None) if hasattr(clip.recording_started_at, 'tzinfo') else clip.recording_started_at
            
            if job.report.approximate_time_start and job.report.approximate_time_end:
                rep_start = datetime.combine(job.report.incident_date, job.report.approximate_time_start)
                rep_end = datetime.combine(job.report.incident_date, job.report.approximate_time_end)
                sec_start = int((rep_start - rec_start).total_seconds())
                sec_end = int((rep_end - rec_start).total_seconds())
                
                # Compensar posibles desfases de zona horaria (UTC vs UTC-5)
                if sec_start > clip.duration_seconds or sec_end < 0:
                    for offset in [-5, -4, -6, 5]:
                        adj = rec_start + timedelta(hours=offset)
                        s = int((rep_start - adj).total_seconds())
                        e = int((rep_end - adj).total_seconds())
                        if 0 <= s <= clip.duration_seconds:
                            sec_start, sec_end = s, e
                            break
            else:
                sec_start = 0
                sec_end = min(clip.duration_seconds, 120)

            sec_start = max(0, min(clip.duration_seconds, sec_start))
            sec_end = max(0, min(clip.duration_seconds, sec_end))
            if sec_end <= sec_start:
                sec_end = min(clip.duration_seconds, sec_start + 60)

            # Margen de seguridad de 10s antes y después para capturar el contexto completo
            trim_start = max(0, sec_start - 10)
            trim_end = min(clip.duration_seconds, sec_end + 10)
            trim_duration = max(5, trim_end - trim_start)

            # 2. Obtener URL de origen para extracción del fragmento
            from app.services.s3 import is_s3_enabled, generate_presigned_url, download_file_from_s3
            video_source = None
            if is_s3_enabled():
                video_source = generate_presigned_url(clip.stored_name, expires_in=3600)
            elif Path(clip_path).is_file():
                video_source = str(clip_path)

            upload_file_path = None
            clip_offset = 0

            # 3. Extraer ÚNICAMENTE el fragmento reportado usando ffmpeg
            stage = "extrayendo el fragmento reportado"
            try:
                import imageio_ffmpeg
                ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            except Exception:
                ffmpeg_exe = "ffmpeg"

            if video_source:
                cmd = [
                    ffmpeg_exe,
                    "-skip_frame", "nokey",
                    "-ss", str(trim_start),
                    "-i", video_source,
                    "-t", str(trim_duration),
                    "-vf", "scale=480:-2",
                    "-c:v", "libx264",
                    "-preset", "ultrafast",
                    "-crf", "30",
                    "-an",
                    "-y",
                    str(temp_fragment_path),
                ]
                logger.info("Extrayendo fragmento de video con ffmpeg: seg %s a %s (duración %ss)", trim_start, trim_end, trim_duration)
                res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120)
                if res.returncode == 0 and Path(temp_fragment_path).is_file() and Path(temp_fragment_path).stat().st_size > 1000:
                    upload_file_path = temp_fragment_path
                    clip_offset = trim_start
                    logger.info("Fragmento extraído exitosamente (%s bytes)", Path(temp_fragment_path).stat().st_size)

            # Fallback en caso de que ffmpeg falle
            if not upload_file_path:
                if not Path(clip_path).is_file():
                    if is_s3_enabled() and download_file_from_s3(clip.stored_name, clip_path):
                        temp_downloaded_from_s3 = True
                    else:
                        raise RuntimeError("Archivo de video no disponible localmente ni en AWS S3")
                upload_file_path = clip_path
                clip_offset = 0

            stage = "conectando con Gemini"
            client = genai.Client(api_key=settings.gemini_api_key)
            stage = "subiendo el fragmento a Gemini"
            uploaded = client.files.upload(file=str(upload_file_path))
            deadline = time.monotonic() + 300
            stage = "esperando el procesamiento del fragmento en los servidores de Google"
            while not getattr(uploaded, "state", None) or getattr(uploaded.state, "name", "") == "PROCESSING":
                if time.monotonic() >= deadline:
                    raise TimeoutError("Gemini file processing timeout (el video tardó más de 5 minutos en procesarse en Google)")
                time.sleep(2)
                uploaded = client.files.get(name=uploaded.name)
            if getattr(uploaded.state, "name", "") != "ACTIVE":
                raise RuntimeError(f"Gemini no pudo procesar el archivo de video. Estado: {getattr(uploaded.state, 'name', 'DESCONOCIDO')}")

            # Limpiar archivo temporal inmediatamente tras subir a Google
            if temp_fragment_path and Path(temp_fragment_path).is_file():
                try:
                    Path(temp_fragment_path).unlink()
                except Exception:
                    pass

            stage = "solicitando el análisis de video a Gemini"
            context = observable_context(job.report.description, job.report.involved_aliases)
            
            time_range_str = f"{job.report.approximate_time_start.strftime('%H:%M')} a {job.report.approximate_time_end.strftime('%H:%M')}" if job.report.approximate_time_start and job.report.approximate_time_end else "horario reportado"
            prompt = f"""Analiza este fragmento de video de una cámara de seguridad escolar autorizada.
El reporte busca verificar un posible evento de tipo: {job.report.incident_type}.
Horario del evento reportado: {time_range_str}.
Ubicación escolar: {job.report.location}.

Descripción de los hechos aportada por el estudiante:
"{context}"

INSTRUCCIONES CLAVE DE ANÁLISIS:
1. Observa con atención todo lo que ocurre en este fragmento.
2. Identifica si hay evidencia observable de la conducta reportada (peleas, agresiones, golpes, lanzamientos de objetos, forcejeos, manipulación indebida de maletas o conductas atípicas).
3. Si los estudiantes están sentados, en calma, en clase o conversando pacíficamente sin incidentes, indícalo con total objetividad (event_match: "NOT_OBSERVED").
4. Si se confirma una conducta anómala o coincidente, indica event_match ("CONFIRMED" o "SUSPICIOUS") y detalla lo que se observa objetivamente.
5. No identifiques personas ni reveles identidades sensibles. Describe únicamente movimientos físicos observables.
6. En relevant_moments, devuelve los momentos visualmente importantes con los segundos desde el inicio de este fragmento."""

            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GeminiAnalysis,
                temperature=0.1,
            )
            candidate_models = [settings.gemini_model, settings.gemini_fallback_model, "gemini-flash-lite-latest"]
            unique_models = []
            for m in candidate_models:
                if m and m not in unique_models:
                    unique_models.append(m)

            response = None
            last_exc = None
            for model_name in unique_models:
                try:
                    logger.info("Solicitando análisis a Gemini con modelo: %s", model_name)
                    response = client.models.generate_content(
                        model=model_name, contents=[uploaded, prompt], config=config
                    )
                    job.model = model_name
                    break
                except (errors.ServerError, errors.APIError) as exc:
                    logger.warning("Gemini devolvió error para %s: %s; intentando siguiente modelo.", model_name, exc)
                    last_exc = exc
                    continue

            if response is None and last_exc:
                raise last_exc

            stage = "validando la respuesta de Gemini"
            if response.parsed:
                parsed = response.parsed
            else:
                raw_text = (response.text or "").strip()
                clean_json = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.MULTILINE)
                clean_json = re.sub(r"\s*```$", "", clean_json, flags=re.MULTILINE)
                parsed = GeminiAnalysis.model_validate_json(clean_json)

            temporal, spatial = metadata_matches(
                job.report, clip.camera, clip.recording_started_at, clip.duration_seconds
            )

            # Ajustar timestamps de los momentos para que coincidan con la grabación completa en el reproductor web
            adjusted_moments = []
            for item in parsed.relevant_moments:
                m_dict = item.model_dump()
                m_dict["timestamp_seconds"] = min(clip.duration_seconds, clip_offset + item.timestamp_seconds)
                adjusted_moments.append(m_dict)

            result = AnalysisResult(
                job_id=job.id,
                temporal_match=temporal,
                spatial_match=spatial,
                event_match=parsed.event_match,
                suggested_type=parsed.suggested_type,
                summary=parsed.summary,
                confidence_level=parsed.confidence_level,
                relevant_moments_json=json.dumps(adjusted_moments),
            )
            db.add(result)
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.now(timezone.utc)
            job.report.status = ReportStatus.REVIEW_REQUIRED
            job.report.public_summary = f"Análisis de IA completado ({parsed.confidence_level}). {parsed.summary[:150]}"
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
            if temp_fragment_path and Path(temp_fragment_path).is_file():
                try:
                    Path(temp_fragment_path).unlink()
                except Exception:
                    pass
            if temp_downloaded_from_s3 and clip_path and Path(clip_path).is_file():
                try:
                    Path(clip_path).unlink()
                except Exception:
                    pass
            if uploaded is not None:
                try:
                    client.files.delete(name=uploaded.name)
                except Exception:
                    pass

