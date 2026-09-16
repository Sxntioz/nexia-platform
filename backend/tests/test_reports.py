from datetime import date

from app.services.gemini import observable_context


def report_payload():
    return {
        "incident_type": "THEFT",
        "incident_date": str(date.today()),
        "approximate_time_start": "10:15:00",
        "approximate_time_end": "10:45:00",
        "location": "Patio central",
        "involved_aliases": "Persona A",
        "description": "Una persona retiró una maleta ajena cerca de las escaleras durante el descanso.",
    }


def test_create_report_requires_auth(client):
    response = client.post("/api/reports", json=report_payload())
    assert response.status_code == 401


def test_register_student_requires_shift_and_course(client):
    # Sin jornada ni curso
    res = client.post(
        "/api/auth/register",
        json={
            "full_name": "Juan Pérez",
            "email": "juan@nexia.edu.co",
            "password": "secretpassword",
            "institution_relation": "Estudiante",
        },
    )
    assert res.status_code == 422

    # Con jornada y curso válidos
    res_ok = client.post(
        "/api/auth/register",
        json={
            "full_name": "Juan Pérez",
            "email": "juan@nexia.edu.co",
            "password": "secretpassword",
            "institution_relation": "Estudiante",
            "shift": "JM",
            "course": "1002",
        },
    )
    assert res_ok.status_code == 201
    data = res_ok.json()
    assert "access_token" in data
    assert data["user"]["institution_relation"] == "Estudiante"
    assert data["user"]["shift"] == "JM"
    assert data["user"]["course"] == "1002"
    assert data["user"]["role"] == "USER"


def test_register_guardian_does_not_require_academic_fields(client):
    res = client.post(
        "/api/auth/register",
        json={
            "full_name": "María Gómez",
            "email": "maria@correo.com",
            "password": "secretpassword",
            "institution_relation": "Acudiente",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["user"]["institution_relation"] == "Acudiente"
    assert data["user"]["shift"] is None
    assert data["user"]["course"] is None


def test_create_and_track_report_with_authenticated_user(client, auth_headers):
    created = client.post("/api/reports", json=report_payload(), headers=auth_headers)
    assert created.status_code == 201
    body = created.json()
    assert body["public_code"].startswith("NEX-")
    assert len(body["public_code"]) == 12

    tracked = client.get(f"/api/reports/track/{body['public_code']}")
    assert tracked.status_code == 200
    public = tracked.json()
    assert public["status"] == "SUBMITTED"
    assert public["incident_type"] == "THEFT"
    for private in ("reporter_name", "involved_aliases", "description", "location"):
        assert private not in public


def test_unknown_tracking_code_is_safe(client):
    response = client.get("/api/reports/track/NEX-NOTFOUND")
    assert response.status_code == 404
    assert "nombre" not in response.text.casefold()


def test_future_date_is_rejected(client, auth_headers):
    payload = report_payload()
    payload["incident_date"] = "2999-01-01"
    assert client.post("/api/reports", json=payload, headers=auth_headers).status_code == 422


def test_admin_routes_require_admin_role(client, auth_headers, admin_headers):
    created = client.post("/api/reports", json=report_payload(), headers=auth_headers).json()
    report_id = created["id"]

    # Usuario normal recibe 403
    forbidden = client.get("/api/admin/reports", headers=auth_headers)
    assert forbidden.status_code == 403

    # Admin recibe 200
    approved = client.post(f"/api/admin/reports/{report_id}/approve", headers=admin_headers)
    assert approved.status_code == 200
    assert approved.json()["status"] == "AWAITING_VIDEO"


def test_admin_users_list_and_role_management(client, auth_headers, admin_headers):
    # Obtener lista de usuarios como admin
    users_res = client.get("/api/admin/users", headers=admin_headers)
    assert users_res.status_code == 200
    users = users_res.json()
    assert len(users) >= 2

    # Localizar al estudiante
    student = next(u for u in users if u["email"] == "estudiante.test@nexia.edu.co")
    assert student["role"] == "USER"

    # Promover estudiante a admin
    promoted = client.patch(
        f"/api/admin/users/{student['id']}/role",
        json={"role": "ADMIN"},
        headers=admin_headers,
    )
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "ADMIN"

    # Verificar que ahora con el token del estudiante sí puede acceder a admin
    admin_access = client.get("/api/admin/reports", headers=auth_headers)
    assert admin_access.status_code == 200


def test_rejects_unsupported_evidence(client, auth_headers, admin_headers):
    report_id = client.post("/api/reports", json=report_payload(), headers=auth_headers).json()["id"]
    client.post(f"/api/admin/reports/{report_id}/approve", headers=admin_headers)
    camera_id = client.get("/api/admin/cameras", headers=admin_headers).json()[0]["id"]
    response = client.post(
        f"/api/admin/reports/{report_id}/evidence",
        data={"camera_id": camera_id, "recording_started_at": "2026-08-27T10:25:00", "duration_seconds": "60"},
        files={"clip": ("../../secret.txt", b"not video", "text/plain")},
        headers=admin_headers,
    )
    assert response.status_code == 415


def test_observable_context_hides_known_aliases_and_contact_data():
    context = observable_context("Juan tomó una maleta azul. Llámame al 300 123 4567.", "Juan")
    assert "Juan" not in context
    assert "300 123 4567" not in context
    assert "maleta azul" in context
