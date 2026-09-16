# NEXIA

MVP local para reportar incidentes escolares, revisar clips autorizados con apoyo de Gemini y cerrar cada caso mediante una decisión humana.

## Ejecutar en Windows

Abre PowerShell en esta carpeta y usa **dos terminales**.

### Terminal 1 — backend

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Terminal 2 — frontend

```powershell
$runtime='C:\Users\santi\.cache\codex-runtimes\codex-primary-runtime\dependencies'
$env:PATH="$runtime\node\bin;$env:PATH"
Set-Location frontend
& "$runtime\bin\fallback\pnpm.cmd" dev --host 127.0.0.1
```

Abre [http://127.0.0.1:5173](http://127.0.0.1:5173). La documentación de la API queda en [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

## Notas

- `.env` debe contener `GEMINI_API_KEY`; nunca se sube a Git.
- Mientras Supabase esté pendiente, se usa `student_project.db` local.
- Solo se aceptan videos MP4/MOV de máximo 100 MB; se guardan en `backend/data/uploads/`, excluido de Git.
- Gemini no identifica rostros ni toma la decisión final.

## Verificación

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m pytest -q
```

En `frontend`, ejecuta `pnpm test`, `pnpm lint` y `pnpm build` usando el runtime mostrado arriba.
