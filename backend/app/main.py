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

        # Migraciones ligeras para asegurar columnas en SQLite / PostgreSQL
        with engine.connect() as conn:
            try:
                conn.execute(text("ALTER TABLE reports ADD COLUMN user_id VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL"))
                conn.commit()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR(30)"))
                conn.commit()
            except Exception:
                pass
            try:
                conn.execute(text("ALTER TABLE reports ADD COLUMN reporter_phone VARCHAR(30)"))
                conn.commit()
            except Exception:
                pass

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

            # Asegurar columna recommendation en analysis_results si no existe
            try:
                from sqlalchemy import text
                db.execute(text("ALTER TABLE analysis_results ADD COLUMN recommendation TEXT"))
                db.commit()
            except Exception:
                db.rollback()

            # Eliminar cámara de prueba 'CAM Prueba Cel 1' si existía previamente
            old_cams = db.query(Camera).filter(
                (Camera.identifier == "CAM-CEL-1") | (Camera.label.ilike("%Prueba Cel%"))
            ).all()
            for old_c in old_cams:
                db.delete(old_c)
            if old_cams:
                db.commit()

            # Asegurar usuario administrador por defecto con credenciales actualizadas
            admin_user = db.query(User).filter(User.email == "admin@nexia.edu.co").first()
            if not admin_user:
                admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
            if admin_user:
                admin_user.password_hash = hash_password("Nexia2026*Protegida!")
                admin_user.email = "admin@nexia.edu.co"
                db.commit()
            else:
                default_admin = User(
                    full_name="Administrador Nexia",
                    email="admin@nexia.edu.co",
                    password_hash=hash_password("Nexia2026*Protegida!"),
                    institution_relation="Acudiente",
                    role=UserRole.ADMIN,
                )
                db.add(default_admin)
                db.commit()

            # Asegurar usuarios institucionales de demostración
            demo_users = [
                ("Valentina Ríos Montoya", "valentina.rios@nexia.edu.co", "Estudiante", "JM", "1002", "+57 312 458 9921"),
                ("Mateo Gómez Beltrán", "mateo.gomez@nexia.edu.co", "Estudiante", "JM", "1101", "+57 318 721 3456"),
                ("Camila Sofía Hernández", "camila.hernandez@nexia.edu.co", "Estudiante", "JT", "903", "+57 310 892 4152"),
                ("Santiago Salazar Duque", "santiago.salazar@nexia.edu.co", "Estudiante", "JM", "1001", "+57 314 581 3221"),
                ("Mariana Castro Lozano", "mariana.castro@nexia.edu.co", "Estudiante", "JT", "1102", "+57 320 491 8273"),
                ("Andrés Felipe Quintero", "andres.quintero@nexia.edu.co", "Estudiante", "JM", "802", "+57 313 847 2910"),
                ("Daniela Morales Vivas", "daniela.morales@nexia.edu.co", "Estudiante", "JT", "1003", "+57 319 623 8194"),
                ("Patricia Restrepo Cárdenas", "patricia.restrepo@gmail.com", "Acudiente", None, None, "+57 315 672 3910"),
                ("Carlos Eduardo Mendoza", "carlos.mendoza@outlook.com", "Acudiente", None, None, "+57 311 239 8471"),
                ("Claudia Marcela Peña", "claudia.pena@hotmail.com", "Acudiente", None, None, "+57 317 654 1289"),
            ]
            for full_name, email, rel, shift, course, phone in demo_users:
                existing = db.query(User).filter(User.email == email).first()
                if not existing:
                    db.add(User(
                        full_name=full_name,
                        email=email,
                        password_hash=hash_password("Nexia2026!"),
                        institution_relation=rel,
                        shift=shift,
                        course=course,
                        phone_number=phone,
                        role=UserRole.USER,
                    ))
            db.commit()

            # Asegurar grabaciones base iniciales
            base_recordings = [
                ("CAM-303", "rec_993eb514efb444d597779580e248b46d.mp4", "VID_20260904_121245.mp4", 1535736945, datetime(2026, 9, 5, 11, 30, 0), 600),
                ("CAM-P1-RAMPA", "rec_dd3c7ccf175641bfb8a1305d2706b841.mp4", "1000155377.mp4", 611471230, datetime(2026, 9, 12, 20, 12, 0), 480),
                ("CAM-P1-COOP", "rec_b1f1871e818b4a2b90bc99f757bbec8e.mp4", "CAMARA.mp4", 141171752, datetime(2026, 9, 12, 15, 20, 0), 600),
            ]
            for cam_ident, file_name, display_name, size, started_at, dur in base_recordings:
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

            # Sincronizar dinámicamente todas las grabaciones existentes en AWS S3 para el depósito
            try:
                from app.services.s3 import is_s3_enabled, get_s3_client
                if is_s3_enabled():
                    client = get_s3_client()
                    resp = client.list_objects_v2(Bucket=settings.aws_bucket_name)
                    for item in resp.get("Contents", []):
                        key = item["Key"]
                        size = item["Size"]
                        last_mod = item["LastModified"].replace(tzinfo=None)
                        if size < 1024:
                            continue

                        already = db.query(CameraRecording).filter(CameraRecording.stored_name == key).first()
                        if already:
                            continue

                        cam_ident = "CAM-303"
                        if key.startswith("live_"):
                            parts = key.split("_")
                            if len(parts) >= 2:
                                cam_ident = parts[1]
                        elif "RAMPA" in key:
                            cam_ident = "CAM-P1-RAMPA"
                        elif "COOP" in key:
                            cam_ident = "CAM-P1-COOP"

                        cam = db.query(Camera).filter(Camera.identifier == cam_ident).first()
                        if not cam:
                            cam = db.query(Camera).filter(Camera.identifier == "CAM-303").first()
                        if not cam:
                            cam = db.query(Camera).first()

                        if cam:
                            mime = "video/webm" if key.endswith(".webm") else "video/mp4"
                            dur = max(30, min(1800, int(size / 350000)))
                            disp_name = (
                                f"En Vivo - {cam.label} ({last_mod.strftime('%H:%M:%S')}).webm"
                                if key.startswith("live_")
                                else f"Depósito - {cam.label} ({key[:14]}).mp4"
                            )
                            db.add(CameraRecording(
                                camera_id=cam.id,
                                original_name=disp_name,
                                stored_name=key,
                                mime_type=mime,
                                size_bytes=size,
                                recording_started_at=last_mod,
                                duration_seconds=dur,
                            ))
                    db.commit()
            except Exception as e:
                print("Aviso al sincronizar grabaciones de S3:", e)

            # Asegurar reportes estudiantiles iniciales si hay pocos
            if db.query(Report).count() < 3:
                r1 = db.query(Report).filter(Report.public_code == "NEX-03OZB2NV").first()
                if not r1:
                    admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
                    db.add(Report(
                        id="84e5e69f-de69-4e33-938e-39f221662cc3",
                        public_code="NEX-03OZB2NV",
                        reporter_name="Angel Santiago Ortiz Andrade",
                        reporter_phone="+57 314 581 3221",
                        incident_type="FIGHT",
                        incident_date=datetime(2026, 11, 2).date(),
                        approximate_time_start=datetime.strptime("11:37:00", "%H:%M:%S").time(),
                        approximate_time_end=datetime.strptime("11:39:00", "%H:%M:%S").time(),
                        location="Salón 303",
                        description="Estaba en la parte de atrás del salón y una persona se me acercó, me tiró el cuaderno y nos empezamos a pelear.",
                        status=ReportStatus.SUBMITTED,
                        public_summary="Reporte registrado. Pendiente de aprobación para revisión de cámaras.",
                        user_id=admin_user.id if admin_user else None,
                    ))

                r2 = db.query(Report).filter(Report.public_code == "NEX-718293B4").first()
                if not r2:
                    val_user = db.query(User).filter(User.email == "valentina.rios@nexia.edu.co").first()
                    db.add(Report(
                        id="93f6e70a-ef70-4f44-a49e-40f332773dd4",
                        public_code="NEX-718293B4",
                        reporter_name="Valentina Ríos Montoya",
                        reporter_phone="+57 312 458 9921",
                        incident_type="BULLYING",
                        incident_date=datetime(2026, 11, 3).date(),
                        approximate_time_start=datetime.strptime("10:15:00", "%H:%M:%S").time(),
                        approximate_time_end=datetime.strptime("10:45:00", "%H:%M:%S").time(),
                        location="Salón 204",
                        description="Durante el cambio de clase varios estudiantes del salón contiguo estuvieron empujando e intimidando verbalmente a mi compañera de puesto.",
                        status=ReportStatus.SUBMITTED,
                        public_summary="Reporte recibido bajo reserva de identidad. Enlace técnico activo a cámara CAM-204.",
                        user_id=val_user.id if val_user else None,
                    ))

                r3 = db.query(Report).filter(Report.public_code == "NEX-492105C8").first()
                if not r3:
                    mat_user = db.query(User).filter(User.email == "mateo.gomez@nexia.edu.co").first()
                    db.add(Report(
                        id="a4f7e81b-ff81-4a55-b5af-51f443884ee5",
                        public_code="NEX-492105C8",
                        reporter_name="Mateo Gómez Beltrán",
                        reporter_phone="+57 318 721 3456",
                        incident_type="FIGHT",
                        incident_date=datetime(2026, 11, 1).date(),
                        approximate_time_start=datetime.strptime("14:20:00", "%H:%M:%S").time(),
                        approximate_time_end=datetime.strptime("14:40:00", "%H:%M:%S").time(),
                        location="Patio Canchas - Bicicletero",
                        description="Discusión acalorada y forcejeo entre dos estudiantes por un turno en las canchas durante el descanso de la tarde.",
                        status="CONFIRMED",
                        public_summary="La revisión técnica confirmó una coincidencia con el reporte en cámara CAM-P1-BICIS. Protocolo Ley 1620 aplicado.",
                        user_id=mat_user.id if mat_user else None,
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


@app.get("/", tags=["system"])
def root_status():
    return {"message": "NEXIA Backend API Online", "status": "ok", "version": "0.1.0"}


@app.get("/health", tags=["system"])
def root_health():
    return {"status": "ok"}


@app.get("/diag", tags=["system"])
def root_diag():
    import subprocess, shutil
    diag = {}
    try:
        disk = shutil.disk_usage("/")
        diag["disk_free_mb"] = disk.free // (1024 * 1024)
        diag["disk_total_mb"] = disk.total // (1024 * 1024)
    except Exception as e:
        diag["disk_error"] = str(e)

    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        diag["ffmpeg_exe"] = exe
        res = subprocess.run([exe, "-version"], capture_output=True, text=True, timeout=5)
        diag["ffmpeg_ok"] = (res.returncode == 0)
        diag["ffmpeg_version"] = res.stdout.split("\n")[0] if res.stdout else "empty"

        prot = subprocess.run([exe, "-protocols"], capture_output=True, text=True, timeout=5)
        diag["supports_https"] = "https" in (prot.stdout or "")

        import shutil
        sys_ffmpeg = shutil.which("ffmpeg")
        diag["sys_ffmpeg"] = sys_ffmpeg

        from app.services.s3 import is_s3_enabled, generate_presigned_url
        diag["s3_enabled"] = is_s3_enabled()
        if is_s3_enabled():
            url = generate_presigned_url("rec_627d7efa63a5424a88eefe41e43e40f4.mp4", expires_in=60)
            diag["s3_url_len"] = len(url)
            
            # Test 1: with system ffmpeg if available
            tester_exe = sys_ffmpeg if sys_ffmpeg else exe
            diag["tester_used"] = tester_exe

            # Test 2: Try with http:// instead of https://
            http_url = url.replace("https://", "http://", 1)
            p_http = subprocess.run([tester_exe, "-ss", "420", "-i", http_url, "-t", "1", "-f", "null", "-"], capture_output=True, text=True, timeout=15)
            diag["http_code"] = p_http.returncode
            if p_http.returncode != 0:
                diag["http_err"] = (p_http.stderr or "")[-300:]
            else:
                diag["http_success"] = True
    except Exception as e:
        diag["diag_error"] = str(e)
    return diag





if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)


