# Lineamientos de NEXIA

## Propósito

Construir el MVP web aprobado y registrado en `.project/mvp.md`. El proyecto usa FastAPI, SQLAlchemy, PostgreSQL de Supabase y Vite React. No implementar autenticación.

## Antes de trabajar

Leer `.project/context.md`, `.project/mvp.md`, `.project/architecture.md`, `.project/tasks/current.md` y `.project/handoffs/latest.md`. Si se contradicen, detenerse y resolver la decisión con el estudiante.

## Forma de trabajo

- Hablar con el estudiante en español sencillo y explicar una acción a la vez.
- Implementar una funcionalidad vertical por vez.
- Mantener React → FastAPI → SQLAlchemy → Supabase.
- Guardar cambios de esquema en `supabase/migrations/` y aplicarlos mediante Supabase MCP.
- Usar agentes paralelos solo en tareas independientes con archivos asignados.
- Mantener migraciones, integración final y verificación bajo un coordinador.
- Actualizar `.project/tasks/` y `.project/handoffs/latest.md` después de cada funcionalidad.

## Seguridad

- Usar únicamente el proyecto Supabase de desarrollo y datos ficticios.
- Nunca imprimir ni guardar secretos en Git, `.project/`, `AGENTS.md` o React.
- Mantener `.env` fuera de Git. No crear secretos con prefijo `VITE_`.
- No ejecutar `DROP`, `TRUNCATE`, borrados masivos, aceptar costos o cambiar de organización sin aprobación y revisión del docente.
- No crear autenticación, usuarios, roles, sesiones o recuperación de contraseña.

## Verificación

- Backend: ejecutar Pytest y comprobar `/api/health`.
- Frontend: ejecutar ESLint, Vitest y el build.
- Integración: probar el flujo principal en navegador.
- Ejecutar el escaneo de secretos de la skill antes de declarar terminada una entrega.
- No afirmar que funciona sin evidencia reciente.

## Bloqueos

Tras tres fallos por permisos, OAuth, costos, credenciales, instalación administrativa o política institucional, detenerse y decir: **“Necesitas contactar al docente o a una persona con conocimientos técnicos para resolver este bloqueo.”**
