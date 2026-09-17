from contextlib import asynccontextmanager

from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.router import api_router
from app.core.auth import hash_password
from app.core.config import settings
from app.db.session import get_engine, get_session_factory
from app.models import Base, Camera, CameraRecording, Report, ReportStatus, User, UserRole


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    try:
        # Asegurar tablas creadas
        engine = get_engine()
        Base.metadata.create_all(engine)

        # Migración ligera para agregar user_id en SQLite si ya existía reports
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE reports ADD COLUMN user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL"))
                conn.commit()
            except Exception:
                pass  # Columna ya existe

        with get_session_factory()() as db:
            # Sincronizar catálogo de cámaras
            existing_cams = db.query(Camera).all()
            # Si hay cámaras viejas que no coinciden con el nuevo formato, limpiarlas
            if existing_cams and any(c.identifier in ["CAM-B2", "CAM-S304", "CAM-PATIO"] for c in existing_cams):
                for c in existing_cams:
                    db.delete(c)
                db.commit()

            if db.query(Camera).count() == 0:
                new_cameras = [
                    # Primer Piso / Patio e Informática
                    Camera(identifier="CAM-P1-BICIS", label="Cámara Patio Canchas - Bicicletero", location="Patio Canchas - Bicicletero"),
                    Camera(identifier="CAM-P1-PREESC", label="Cámara Patio Canchas - Zona Preescolar", location="Patio Canchas - Zona Preescolar"),
                    Camera(identifier="CAM-P1-COOP", label="Cámara Patio Banderas - Cooperativa", location="Patio Banderas - Cooperativa"),
                    Camera(identifier="CAM-P1-RAMPA", label="Cámara Patio Banderas - Rampa", location="Patio Banderas - Rampa"),
                    Camera(identifier="CAM-P1-INFO1", label="Cámara Informática 1", location="Informática 1"),
                    Camera(identifier="CAM-P1-INFO2", label="Cámara Informática 2", location="Informática 2"),
                    Camera(identifier="CAM-P1-INFO3", label="Cámara Informática 3", location="Informática 3"),
                ]
                # Segundo Piso: Salones 201 al 216
                for num in range(201, 217):
                    new_cameras.append(
                        Camera(identifier=f"CAM-{num}", label=f"Cámara Salón {num}", location=f"Salón {num}")
                    )
                # Tercer Piso: Salones 301 al 316
                for num in range(301, 317):
                    new_cameras.append(
                        Camera(identifier=f"CAM-{num}", label=f"Cámara Salón {num}", location=f"Salón {num}")
                    )
                db.add_all(new_cameras)
                db.commit()

            # Asegurar usuario administrador por defecto
            admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
            if not admin_user:
                default_admin = User(
                    full_name="Administrador Nexia",
                    email="admin@nexia.edu.co",
                    password_hash=hash_password("admin123"),
                    institution_relation="Acudiente",
                    role=UserRole.ADMIN,
                )
                db.add(default_admin)
                db.commit()

            # Sincronizar grabaciones existentes de AWS S3 para el depósito
            s3_recordings = [
                ("CAM-303", "rec_627d7efa63a5424a88eefe41e43e40f4.mp4", "VID_20260904_121245.mp4", 1535736945, datetime(2026, 9, 5, 11, 30, 0), 600),
                ("CAM-P1-RAMPA", "rec_8bcd2f9035694109b32f97d516005da9.mp4", "1000155377.mp4", 611471230, datetime(2026, 9, 12, 20, 12, 0), 480),
                ("CAM-P1-COOP", "rec_dd3c7ccf175641bfb8a1305d2706b841.mp4", "CAMARA.mp4", 141171752, datetime(2026, 9, 12, 15, 20, 0), 600),
            ]
            for cam_ident, file_name, display_name, size, started_at, dur in s3_recordings:
                cam = db.query(Camera).filter(Camera.identifier == cam_ident).first()
                if cam:
                    already = db.query(CameraRecording).filter(CameraRecording.stored_name == file_name).first()
                    if not already:
                        db.add(CameraRecording(
                            camera_id=cam.id,
                            original_name=display_name,
                            stored_name=file_name,
                            mime_type="video/mp4",
                            size_bytes=size,
                            recording_started_at=started_at,
                            duration_seconds=dur,
                        ))
            db.commit()

            # Asegurar reporte estudiantil inicial si no existe ninguno
            if db.query(Report).count() == 0:
                admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
                sample_report = Report(
                    id="84e5e69f-de69-4e33-938e-39f221662cc3",
                    public_code="NEX-03OZB2NV",
                    reporter_name="Angel Santiago Ortiz Andrade",
                    incident_type="FIGHT",
                    incident_date=datetime(2026, 9, 5).date(),
                    approximate_time_start=datetime.strptime("11:37:00", "%H:%M:%S").time(),
                    approximate_time_end=datetime.strptime("11:39:00", "%H:%M:%S").time(),
                    location="Salón 303",
                    description="Estaba en la parte de atras del salon y una persona se me acerco y me tiro el cuaderno y nos empezamos a pelear",
                    status=ReportStatus.SUBMITTED,
                    public_summary="Reporte registrado. Pendiente de aprobación para revisión de cámaras.",
                    user_id=admin_user.id if admin_user else None,
                )
                db.add(sample_report)
                db.commit()
    except Exception as e:
        print("Error en inicialización de base de datos:", e)
    yield


app = FastAPI(title="NEXIA", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://127.0.0.1:5173", "http://localhost:5173"],
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix="/api")

# Asegurar y montar directorio de grabaciones y evidencias para streaming directo en navegador
settings.upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=str(settings.upload_dir)), name="uploads")


@app.get("/", tags=["system"])
def root_status():
    return {"message": "NEXIA Backend API Online", "status": "ok", "version": "0.1.0"}


@app.get("/health", tags=["system"])
def root_health():
    return {"status": "ok"}


if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)


