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
from app.models import Base, Camera, CameraRecording, User, UserRole


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

            # Sincronizar grabaciones de demostración existentes para la Matriz CCTV (Demo)
            demo_recordings = [
                ("CAM-P1-BICIS", "rec_1f3f6f89874847c6b131804217f2dffc.mp4", "CCTV_Patio_Canchas_P1.mp4", 960),
                ("CAM-204", "rec_b9b6427497ea4e4a91d83a78fb0cf19e.mp4", "CCTV_Salon_204_P2.mp4", 1120),
                ("CAM-303", "rec_1993b7b895c04b8a9949abd964545f68.mp4", "CCTV_Salon_303_P3.mp4", 960),
                ("CAM-304", "83a22f7ab7b24f1ebc54c6882b59e283.mp4", "CCTV_Salon_304_P3.mp4", 420),
                ("CAM-P1-INFO1", "ce3e52cfd53c49b2abcea571fe1fabc2.mp4", "CCTV_Informatica_1_P1.mp4", 360),
            ]
            for cam_ident, file_name, display_name, dur in demo_recordings:
                file_path = settings.upload_dir / file_name
                if file_path.exists():
                    cam = db.query(Camera).filter(Camera.identifier == cam_ident).first()
                    if cam:
                        already = db.query(CameraRecording).filter(CameraRecording.stored_name == file_name).first()
                        if not already:
                            db.add(CameraRecording(
                                camera_id=cam.id,
                                original_name=display_name,
                                stored_name=file_name,
                                mime_type="video/mp4",
                                size_bytes=file_path.stat().st_size,
                                recording_started_at=datetime.now(),
                                duration_seconds=dur,
                            ))
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

