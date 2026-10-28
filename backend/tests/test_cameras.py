def test_admin_camera_crud(client, admin_headers):
    # 1. List cameras
    res = client.get("/api/admin/cameras", headers=admin_headers)
    assert res.status_code == 200
    cams = res.json()
    assert len(cams) > 0

    first_cam = cams[0]
    cam_id = first_cam["id"]

    # 2. Update camera name / label / identifier
    res_update = client.patch(
        f"/api/admin/cameras/{cam_id}",
        json={"label": "Aula 3A Actualizada", "location": "Bloque A Piso 3"},
        headers=admin_headers,
    )
    assert res_update.status_code == 200
    updated = res_update.json()
    assert updated["label"] == "Aula 3A Actualizada"
    assert updated["location"] == "Bloque A Piso 3"

    # 3. Create a new camera
    res_create = client.post(
        "/api/admin/cameras",
        json={"identifier": "CAM-TEST-NEW", "label": "Patio Norte", "location": "Zona Recreo"},
        headers=admin_headers,
    )
    assert res_create.status_code == 201
    created = res_create.json()
    assert created["identifier"] == "CAM-TEST-NEW"

    # 4. Delete / Deactivate camera
    res_del = client.delete(f"/api/admin/cameras/{created['id']}", headers=admin_headers)
    assert res_del.status_code == 200
