import concurrent.futures
import logging
import re
import unicodedata
from typing import Literal
from google import genai
from google.genai import types

from app.core.config import settings
from app.schemas.reports import ChatMessage

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_USER = """Eres NEXIA Copilot, el asistente oficial de convivencia escolar, mediación restaurativa y soporte del sistema NEXIA para el Colegio Alfonso López Michelsen (creado y liderado por Grupo Nexus).
Tu objetivo es orientar con empatía genuina, inteligencia reflexiva, calidez y rigor institucional a estudiantes, familias y docentes.
Puedes responder fluidamente en Español o en Inglés según el idioma en el que consulte el usuario.

CONOCIMIENTO INSTITUCIONAL Y PLATAFORMA NEXIA:
1. IDENTIDAD: NEXIA es la plataforma de convivencia escolar, seguridad preventiva y mediación restaurativa del Colegio Alfonso López Michelsen, desarrollada por Grupo Nexus.
   Slogan institucional: "REPORTA • VERIFICA • CONSTRUYE ENTORNOS MÁS SEGUROS — GRUPO NEXUS".
2. DISTRIBUCIÓN ARQUITECTÓNICA DEL COLEGIO:
   - Piso 1 (Planta Baja): Aula Polivalente, Laboratorios de Física, Química y Ciencias 1 y 2, Sala de Artes, Sala de Danzas, Ágora (teatro exterior), Aulas de Tecnología 1, 2 y 3, Salas de Sistemas (Informática 1, 2 y 3), Auditorio Principal, Rectoría y Enfermería, Patios Canchas deportivas (Punto de Encuentro con cámara CAM-P1-BICIS), Zona Verde / Kiosco y Edificio Preescolar.
   - Piso 2 (Planta Alta): Salones de clase 201 al 216 (incluyendo Salón 204 con cámara CAM-204), Sala de Profesores, Aula de Inglés, pasarela conector, Biblioteca Escolar y Comedor escolar.
   - Piso 3 (Tercer Piso):
     * Ala Occidental (Salones y Música): Salones 316 a 309 en columna izquierda; baterías de baños para hombres y mujeres; Salones 301 a 306 en columna derecha (con Salón 303 y 304 monitoreados por CAM-303 y CAM-304); Aulas de Música 1 (307) y Música 2 (308).
     * Pasarela y rampa conector central.
     * Bloque Oriental: Gradas superiores del Comedor Escolar.
3. RADICACIÓN DE REPORTES EN NEXIA:
   - Iniciar sesión con rol de Estudiante (indicando curso y jornada JM/JT) o Acudiente.
   - Seleccionar tipo de hecho: Hurto, Riña o Acciones Inadecuadas.
   - Delimitar fecha y hora: se aconseja un rango corto de 3 a 5 minutos (ej. 10:15 - 10:20 AM) para que el análisis de video sea exacto y veloz.
   - Indicar la ubicación usando el plano interactivo de pisos 1, 2 o 3. El sistema enlaza la cámara de vigilancia de la zona y muestra una portada de vista previa de cobertura.
   - Describir los hechos objetivamente. No se solicitan alias ni apodos para resguardar la privacidad.
   - Al enviar, se genera un Código Único de Caso (ej: NEX-9X42A) que permite seguimiento anónimo.
4. PRIVACIDAD Y SEGURIDAD (LEY 1620 DE 2013):
   - La denuncia protege la identidad del declarante frente a terceros.
   - La IA analiza únicamente acciones visibles en video (aproximación, interacción con objetos, disputas) SIN realizar reconocimiento facial ni juzgar culpabilidades.
   - La decisión final SIEMPRE corresponde al equipo directivo humano del colegio.
   - Tipo I (Leves): Conflictos cotidianos sin daño físico ni psicológico. Mediación pedagógica en aula.
   - Tipo II (Graves): Riñas, agresiones verbales/físicas sin incapacidad, ciberacoso, hurto comprobado.
   - Tipo III (Gravísimas): Hechos que configuren presuntos delitos (armas, sustancias psicoactivas, lesiones graves). Activación inmediata de Comité de Convivencia y autoridades.
5. DEBIDO PROCESO Y APELACIONES:
   - Cualquier sanción impuesta puede ser apelada dentro de los 5 días hábiles siguientes a través de la plataforma.

DIRECTRICES DE PENSAMIENTO Y RESPUESTA:
- Cuando el estudiante o usuario describa una situación personal (miedo, pelea presenciada, bullying, robo, tristeza, angustia), PIENSA primero en su estado emocional.
- Valida sus sentimientos: asegúrale que está seguro(a), que no está solo(a) y que buscar ayuda es un acto valiente.
- Explica calmadamente cómo actuar: a quién acudir en el colegio (director de grupo, orientación escolar) y cómo NEXIA le permite dejar constancia confidencial protegida por código.
- Sé claro, empático, sin clichés, con formato enriquecido (viñetas, negritas) y sugiere botones de acción útiles usando:
  [ACTION:report|📝 Crear Reporte]
  [ACTION:track|🔍 Consultar Caso]
  [ACTION:map|🏛️ Ver Mapa de Pisos]
  [ACTION:manual|📖 Ver Manual de Convivencia]
"""

SYSTEM_PROMPT_ADMIN = """Eres NEXIA Copilot (Modo Directivos y Operaciones), el copiloto experto en auditoría de convivencia, verificación de evidencia con IA y debidos procesos para directivos, coordinadores y rectores del Colegio Alfonso López Michelsen (Grupo Nexus).
Puedes responder fluidamente en Español o en Inglés según el idioma del directivo.

CONOCIMIENTO TÉCNICO Y OPERATIVO:
1. NEXIA Vision Matrix — CCTV en Vivo (Demo):
   - Permite monitorear cámaras de los Pisos 1, 2 y 3 con reproductor en tiempo real, HUD táctico de seguridad (reloj COT, estado REC en vivo, código de cámara y salón).
   - Modos de pantalla: Monitor Central (Spotlight), Grilla 2x2 y Matriz 3x3 ajustadas al 100% de la pantalla sin scroll vertical.
   - Reproducción fluida de grabaciones MP4 precargadas en el Depósito de Grabaciones.
   - HUD de Detección IA: cajas delimitadoras simuladas sobre el flujo de video.
2. Flujo de Evidencia y Video:
   - Al recibir un reporte (`SUBMITTED`), el directivo puede aprobarlo (`REVIEW_REQUIRED` / `ANALYZING`).
   - El sistema vincula la cámara escolar correspondiente por fecha, ubicación y rango horario con los clips precargados en el Depósito de Grabaciones.
   - El Motor NEXIA analiza el fragmento exacto y reporta momentos clave con marca de segundo, descripción observable y nivel de confianza (ALTO, MEDIO, BAJO).
3. Decisiones Directivas:
   - "Confirmar coincidencia": Indica que la evidencia respalda la ocurrencia del hecho para proceder con el acta formativa.
   - "No concluyente": Se usa si la visibilidad, ángulo o distancia no permiten verificar los hechos con certeza.
4. Gestión de Sanciones y Apelaciones:
   - El admin puede sancionar cuentas por uso malicioso del sistema indicando motivo obligatorio.
   - Las apelaciones presentadas por los usuarios se gestionan en la pestaña "Apelaciones" del panel directivo.
5. Gestión del Manual de Convivencia:
   - El administrador puede subir y actualizar en cualquier momento el archivo PDF oficial del Manual de Convivencia para consulta de toda la comunidad educativa desde la pestaña "Manual Escolar".
"""

FALLBACK_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.7-flash",
]

CHAT_EXECUTOR = concurrent.futures.ThreadPoolExecutor(max_workers=4)


def _normalize(text: str) -> str:
    """Elimina tildes y pasa a minúsculas para búsquedas robustas."""
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    ).lower().strip()


def _is_english(text: str) -> bool:
    norm = _normalize(text)
    en_words = {
        "hello", "hi", "hey", "how", "what", "where", "when", "why", "who",
        "stolen", "theft", "lost", "bullying", "bully", "fight", "fighting",
        "report", "case", "camera", "cameras", "floor", "classroom", "track",
        "handbook", "rules", "sanction", "school", "help", "good morning",
        "good afternoon", "thank you", "thanks", "admin", "evidence"
    }
    tokens = set(re.findall(r"\b[a-z]+\b", norm))
    return len(tokens.intersection(en_words)) >= 2 or any(norm.startswith(w) for w in ["hello", "hi ", "how to", "where is", "can i"])


def _check_fast_path(cleaned_msg: str, context_mode: str, is_en: bool) -> tuple[str, list[str]] | None:
    """
    Ruta rápida para preguntas predeterminadas, botones de acceso rápido y saludos.
    Retorna (reply_text, suggestions) de forma instantánea (<1ms) sin esperar llamadas externas.
    """
    norm = _normalize(cleaned_msg)

    # ------------------ MODO ADMIN (FAST PATH) ------------------
    if context_mode == "admin":
        if any(p in norm for p in ["como funciona la matriz cctv", "matriz cctv", "cctv en vivo", "live demo", "how does the cctv matrix", "cctv matrix"]):
            if is_en:
                return (
                    "📹 **NEXIA Vision Matrix — Live CCTV Command Center (Demo):**\n\n"
                    "The Live CCTV section in your Admin Panel allows real-time school surveillance auditing:\n\n"
                    "• **Zero-Scroll Viewport:** Spotlight, 2x2 Grid, and 3x3 Matrix dynamically scale to fit your screen without page scrolling.\n"
                    "• **Spotlight Monitor:** Central stream with synchronized COT timecode, REC indicator, and classroom details.\n"
                    "• **Interactive Mosaic:** Switch across Floors 1, 2, and 3 with live camera status.\n"
                    "• **Simulated & Recorded Feeds:** Preloaded MP4 clips loop seamlessly with mute/fullscreen controls.\n"
                    "• **AI Bounding Box HUD:** Toggle simulated motion and entity detection overlays.",
                    ["How to interpret AI confidence?", "How to manage sanctions and appeals?", "School Handbook Management (PDF)"]
                )
            return (
                "📹 **NEXIA Vision Matrix — Centro de Monitoreo CCTV en Tiempo Real (Demo):**\n\n"
                "El centro de monitoreo Vision Matrix para directivos permite auditar la seguridad del colegio en tiempo real:\n\n"
                "• **Pantalla Única Sin Scroll:** Los modos Spotlight, Grilla 2x2 y Matriz 3x3 se ajustan exactamente a la altura de tu pantalla sin desplazamiento vertical.\n"
                "• **Monitor Central (Spotlight):** Transmisión con HUD táctico (reloj sincronizado COT, estado REC, código de cámara y salón).\n"
                "• **Mosaico de Canales:** Filtrado rápido por Pisos 1, 2 y 3 con indicadores de señal activa.\n"
                "• **Grabaciones en Bucle:** Los videos cargados al servidor se reproducen de manera fluida con controles de audio y pantalla completa.\n"
                "• **HUD de Detección IA:** Activa o desactiva las cajas delimitadoras de vigilancia sobre el flujo de video.",
                ["¿Cómo interpretar la confianza de la IA?", "Gestión de sanciones y apelaciones", "¿Cómo subir grabaciones al sistema?"]
            )

        if any(p in norm for p in ["confianza de la ia", "interpretar la confianza", "interpret ai confidence", "ai confidence"]):
            if is_en:
                return (
                    "🤖 **Interpreting AI Confidence in NEXIA:**\n\n"
                    "• **HIGH Confidence:** High spatio-temporal correlation. Key moments (interactions, movements) match the report timeline.\n"
                    "• **MEDIUM / LOW Confidence:** Obstructed camera angle, distance, or lighting ambiguity. Requires human review.\n"
                    "• **Human-in-the-Loop Rule:** AI never issues sanctions. It serves purely as technical evidence for human school leadership deliberation.",
                    ["How does the CCTV Matrix Live Demo work?", "How to manage sanctions and appeals?", "View Appeals"]
                )
            return (
                "🤖 **Interpretación de la Confianza de la IA en NEXIA:**\n\n"
                "• **Confianza ALTA:** Coincidencia espaciotemporal contundente. Los momentos clave observables en el video coinciden con la narración del reporte.\n"
                "• **Confianza MEDIA / BAJA:** Ángulo lejano, campo visual con obstáculos o movimiento ambiguo. Requiere revisión visual directa.\n"
                "• **Regla de Primacía Humana:** La IA nunca sanciona automáticamente. Proporciona evidencia técnica objetiva para la deliberación del equipo directivo.",
                ["¿Cómo funciona la Matriz CCTV en Vivo (Demo)?", "Gestión de sanciones y apelaciones", "¿Cómo aprobar un reporte?"]
            )

        if any(p in norm for p in ["sanciones y apelaciones", "gestion de sanciones", "sanctions & appeals", "sanctions and appeals"]):
            if is_en:
                return (
                    "⚖️ **Managing Sanctions & Appeals (Due Process):**\n\n"
                    "• **Account Suspension:** If a user submits fraudulent or malicious reports, administrators can apply a sanction with mandatory reasoning.\n"
                    "• **Right to Appeal:** Users have up to 5 business days to file an appeal directly from their portal.\n"
                    "• **Administrative Deliberation:** In the 'Appeals' tab, review their statements, inspect audit logs, and decide to uphold or revoke the sanction.",
                    ["How does the CCTV Matrix Live Demo work?", "How to interpret AI confidence?", "School Handbook Management (PDF)"]
                )
            return (
                "⚖️ **Gestión de Sanciones y Apelaciones (Debido Proceso):**\n\n"
                "• **Suspensión de Cuentas:** Si un usuario realiza reportes falsos o malintencionados, la directiva puede imponer una sanción justificando el motivo.\n"
                "• **Derecho de Apelación:** Todo usuario sancionado cuenta con 5 días hábiles para radicar sus descargos desde la plataforma.\n"
                "• **Deliberación Directiva:** En la pestaña **'Apelaciones'** puedes examinar sus argumentos, revisar el historial y decidir revocar o ratificar la medida.",
                ["¿Cómo funciona la Matriz CCTV en Vivo (Demo)?", "¿Cómo interpretar la confianza de la IA?", "Manual Escolar"]
            )

    # ------------------ MODO USUARIO / ESTUDIANTE (FAST PATH) ------------------

    # 1. ¿Cómo crear un reporte?
    if any(p in norm for p in ["como crear un reporte", "como radico un reporte", "como hacer un reporte", "como reportar", "crear reporte", "how do i create a report", "how to report"]):
        if is_en:
            return (
                "📝 **How to File a Confidential Report in NEXIA:**\n\n"
                "1. **Sign In:** Log in with your student account (specifying grade and shift) or parent account.\n"
                "2. **Select Incident Type:** Choose between *Theft*, *Fight/Aggression*, or *Inappropriate Behavior*.\n"
                "3. **Time Window:** Specify the date and a short 3 to 5-minute interval (e.g., 10:15 - 10:20 AM).\n"
                "4. **Classroom / Location:** Pick the exact classroom or courtyard on our 3-floor interactive blueprint. NEXIA automatically links the corresponding security camera and shows its live coverage preview!\n"
                "5. **Objective Description:** State the facts clearly without nicknames.\n"
                "6. **Private Tracking Code:** You will receive a unique code (`NEX-XXXX`) to track progress anonymously.\n\n"
                "[ACTION:report|📝 Create Report Now]\n"
                "[ACTION:map|🏛️ View 3-Floor Blueprint]",
                ["Why is an exact time range needed?", "Is my identity protected?", "Where is Classroom 304 on Floor 3?"]
            )
        return (
            "📝 **Cómo radicar un reporte confidencial en NEXIA:**\n\n"
            "1. **Iniciar Sesión:** Ingresa con tu cuenta de estudiante (indicando curso y jornada) o acudiente.\n"
            "2. **Tipo de Hecho:** Elige entre *Hurto*, *Riña* o *Acciones Inadecuadas*.\n"
            "3. **Rango de Tiempo:** Indica la fecha y un intervalo corto de **3 a 5 minutos** (ej. 10:15 AM a 10:20 AM).\n"
            "4. **Ubicación en el Plano:** Selecciona el salón o patio en el mapa interactivo de 3 pisos. ¡NEXIA enlazará automáticamente la cámara de la zona y te mostrará su portada de vista previa!\n"
            "5. **Descripción Objetiva:** Relata lo sucedido sin apodos ni juicios personales.\n"
            "6. **Código Único:** Al enviar, recibirás tu código privado (`NEX-XXXX`) para consultar el avance sin exponer tu identidad.\n\n"
            "[ACTION:report|📝 Radicar Reporte Ahora]\n"
            "[ACTION:map|🏛️ Ver Plano Interactivo]",
            ["¿Por qué poner un rango de tiempo exacto?", "¿Mi identidad está protegida?", "¿Dónde queda el Salón 304 en el Piso 3?"]
        )

    # 2. ¿Por qué poner un rango de tiempo exacto?
    if any(p in norm for p in ["por que poner un rango de tiempo", "rango de tiempo exacto", "rango de horas", "why is an exact time range needed", "exact time range"]):
        if is_en:
            return (
                "⏱️ **Why is a Narrow Time Range (3-5 min) Crucial?**\n\n"
                "• **Fast & Accurate AI Video Matching:** The security cameras record continuously throughout the school day. A narrow time range (e.g. 10:15 AM - 10:20 AM) allows the NEXIA AI Engine to pinpoint and examine the exact video clip in seconds.\n"
                "• **Server Efficiency:** Short intervals avoid processing gigabytes of irrelevant footage.\n"
                "• **Tip:** If you are unsure of the minute, ask a classmate who was with you or estimate the recess bell time.",
                ["How do I create a report?", "Is my identity protected?", "Check camera coverage on Floor 3"]
            )
        return (
            "⏱️ **¿Por qué es fundamental indicar un rango corto de tiempo (3 a 5 min)?**\n\n"
            "• **Análisis de Video Preciso e Inmediato:** Las cámaras de seguridad del colegio graban de forma continua durante toda la jornada. Al especificar un intervalo acotado (ej: *10:15 AM a 10:20 AM*), la IA de NEXIA y el sistema de video extraen y analizan exactamente el fragmento correspondiente en cuestión de segundos.\n"
            "• **Evita esperas prolongadas:** Un rango muy amplio (como toda la mañana) obligaría a revisar horas de video innecesario.\n"
            "• **Consejo práctico:** Si no recuerdas el minuto exacto, toma como referencia el timbre del descanso o el cambio de clase.",
            ["¿Cómo crear un reporte?", "¿Mi identidad está protegida?", "¿Dónde queda el Salón 304 en el Piso 3?"]
        )

    # 3. ¿Mi identidad está protegida?
    if any(p in norm for p in ["mi identidad esta protegida", "es anonimo", "anonimato", "me van a delatar", "is my identity protected", "is it anonymous"]):
        if is_en:
            return (
                "🛡️ **Complete Identity Protection & Student Safety:**\n\n"
                "• **Private Tracking Code (`NEX-XXXX`):** Your report generates a cryptographic case code. Only authorized school leadership can review the case file.\n"
                "• **No Facial Recognition:** NEXIA’s AI analyzes physical actions and spatio-temporal correlation without biometric or facial profiling.\n"
                "• **Retaliation Protection:** In accordance with Law 1620 of 2013, the institution guarantees confidentiality and protection against retaliation.\n\n"
                "[ACTION:report|📝 Create Confidential Report]\n"
                "[ACTION:manual|📖 View Coexistence Handbook]",
                ["How do I create a report?", "Why is an exact time range needed?", "How do I track my case?"]
            )
        return (
            "🛡️ **Protección Total de tu Identidad y Seguridad:**\n\n"
            "• **Código Privado de Caso (`NEX-XXXX`):** Tu reporte se asocia a un código confidencial. Ningún estudiante ni tercero puede ver quién radicó la información.\n"
            "• **Cero Reconocimiento Facial Invasivo:** La IA de NEXIA analiza trayectorias, objetos y movimientos observables; nunca realiza perfilamiento biométrico de rostros.\n"
            "• **Garantías Ley 1620:** El Comité de Convivencia tiene la obligación legal de proteger la confidencialidad de la declaración para evitar cualquier tipo de represalia.\n\n"
            "[ACTION:report|📝 Radicar Reporte Protegido]\n"
            "[ACTION:manual|📖 Conocer Garantías Ley 1620]",
            ["¿Cómo crear un reporte?", "¿Por qué poner un rango de tiempo exacto?", "¿Cómo consulto el estado de mi caso?"]
        )

    # 4. Saludos rápidos
    if norm in ["hola", "buenas", "buen dia", "buenos dias", "buenas tardes", "buenas noches", "hey", "hello", "hi"]:
        if is_en:
            return (
                "👋 Hello! I am **NEXIA Copilot**, the school safety and coexistence AI assistant at Colegio Alfonso López Michelsen (Grupo Nexus).\n\n"
                "How can I assist you today? You can ask me how to file a confidential report, explore the 3D school map, or learn about student rights.\n\n"
                "[ACTION:report|📝 Create Report]\n"
                "[ACTION:map|🏛️ View School Map]\n"
                "[ACTION:track|🔍 Track Case]",
                ["How do I create a report?", "Why is an exact time range needed?", "Is my identity protected?"]
            )
        return (
            "👋 ¡Hola! Soy **NEXIA Copilot**, el asistente oficial de convivencia y seguridad del Colegio Alfonso López Michelsen (Grupo Nexus).\n\n"
            "Estoy aquí para orientarte de forma segura y reflexiva. Puedes preguntarme cómo radicar un reporte confidencial, explorar los 3 pisos del colegio o consultar el Manual de Convivencia.\n\n"
            "¿En qué te puedo orientar hoy?\n\n"
            "[ACTION:report|📝 Crear Reporte]\n"
            "[ACTION:map|🏛️ Explorar Mapa de Pisos]\n"
            "[ACTION:track|🔍 Consultar Caso]",
            ["¿Cómo crear un reporte?", "¿Por qué poner un rango de tiempo exacto?", "¿Mi identidad está protegida?"]
        )

    # 5. Consultar caso / Seguimiento rápido
    if any(p in norm for p in ["como consulto mi caso", "como consultar el estado", "consultar caso", "seguimiento", "how do i track my case", "track case"]):
        if is_en:
            return (
                "🔍 **Tracking Your Case Progress:**\n\n"
                "You can check your report status anytime completely anonymously:\n"
                "1. Go to **'Track Case'** from the top menu.\n"
                "2. Enter your unique code (e.g. `NEX-7K29B`).\n"
                "3. You will see real-time updates: *Received*, *AI Video Correlation*, *Human Administrative Review*, or *Resolved*.\n\n"
                "[ACTION:track|🔍 Enter Tracking Code]",
                ["How do I create a report?", "Is my identity protected?", "What offenses are in Law 1620?"]
            )
        return (
            "🔍 **Consulta y Seguimiento de tu Caso:**\n\n"
            "Puedes verificar el estado de tu reporte en cualquier momento de forma anónima:\n"
            "1. Ingresa a la sección **'Consultar caso'** en la barra superior.\n"
            "2. Digita tu código privado (ej: `NEX-7K29B`).\n"
            "3. Verás la fase en tiempo real: *Recibido*, *Análisis de video por IA*, *Revisión directiva* o *Resuelto con acta pedagógica*.\n\n"
            "[ACTION:track|🔍 Consultar Mi Caso Ahora]",
            ["¿Cómo crear un reporte?", "¿Mi identidad está protegida?", "¿Qué faltas contempla la Ley 1620?"]
        )

    # 6. Manual de Convivencia / Ley 1620
    if any(p in norm for p in ["que faltas contempla la ley 1620", "tipos de faltas", "ley 1620", "manual de convivencia", "what offenses are in law 1620"]):
        if is_en:
            return (
                "📚 **School Coexistence Classification (Law 1620 of 2013):**\n\n"
                "• **Type I (Minor):** Everyday disputes that do not damage physical or psychological integrity. Handled via classroom dialogue and pedagogical agreements.\n"
                "• **Type II (Serious):** Repeated bullying, cyberbullying, physical aggression without medical disability, or theft. Activates coexistence committee and parents meeting.\n"
                "• **Type III (Critical):** Offenses involving weapons, illicit substances, or severe injuries. Demands immediate activation of external authorities (ICBF, Childhood Police).\n\n"
                "[ACTION:manual|📖 View School Handbook]",
                ["How do I create a report?", "Is my identity protected?", "How do I track my case?"]
            )
        return (
            "📚 **Clasificación de Faltas en el Manual de Convivencia (Ley 1620):**\n\n"
            "• **Tipo I (Leves):** Conflictos cotidianos o roces entre pares que no causan daño físico ni psicológico. Se resuelven con mediación pedagógica y compromisos en aula.\n"
            "• **Tipo II (Graves):** Agresiones físicas o verbales reiteradas, acoso escolar (bullying), ciberacoso o hurto comprobado. Activa notificación a acudientes y registro institucional.\n"
            "• **Tipo III (Gravísimas):** Hechos que configuran presuntos delitos (porte de armas, sustancias psicoactivas o lesiones con incapacidad). Requiere remisión inmediata a autoridades externas (ICBF, Policía de Infancia y Adolescencia).\n\n"
            "[ACTION:manual|📖 Consultar Manual de Convivencia]",
            ["¿Cómo crear un reporte?", "¿Mi identidad está protegida?", "¿Cómo consulto el estado de mi caso?"]
        )

    return None


def generate_chat_reply(
    message: str,
    context_mode: Literal["user", "admin"] = "user",
    history: list[ChatMessage] | None = None
) -> tuple[str, list[str]]:
    history = history or []
    cleaned_msg = message.strip()
    is_en = _is_english(cleaned_msg)

    # 1. FAST PATH: Respuestas inmediatas (<1ms) para preguntas frecuentes y botones rápidos
    fast_result = _check_fast_path(cleaned_msg, context_mode, is_en)
    if fast_result:
        return fast_result

    # 2. THINKING PATH: Preguntas abiertas, personales o situacionales usando Gemini con timeout amplio
    if settings.gemini_api_key:
        try:
            client = genai.Client(api_key=settings.gemini_api_key)
            system_instruction = SYSTEM_PROMPT_ADMIN if context_mode == "admin" else SYSTEM_PROMPT_USER

            contents = []
            for h in history[-4:]:
                contents.append(types.Content(
                    role="user" if h.role == "user" else "model",
                    parts=[types.Part.from_text(text=h.content)]
                ))

            contents.append(types.Content(
                role="user",
                parts=[types.Part.from_text(text=cleaned_msg)]
            ))

            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.35,
                max_output_tokens=850,
            )

            for model_name in FALLBACK_MODELS:
                try:
                    future = CHAT_EXECUTOR.submit(
                        client.models.generate_content,
                        model=model_name,
                        contents=contents,
                        config=config,
                    )
                    # Timeout de 15s para permitir pensamiento profundo en preguntas abiertas
                    response = future.result(timeout=15.0)

                    reply_text = ""
                    if response:
                        if hasattr(response, 'text') and response.text:
                            reply_text = response.text.strip()
                        elif hasattr(response, 'candidates') and response.candidates:
                            parts = []
                            for candidate in response.candidates:
                                if candidate.content and candidate.content.parts:
                                    for p in candidate.content.parts:
                                        if hasattr(p, 'text') and p.text:
                                            parts.append(p.text)
                            reply_text = "\n".join(parts).strip()

                    if reply_text:
                        suggestions = _get_suggestions(context_mode, cleaned_msg, is_en)
                        return reply_text, suggestions
                except Exception as e:
                    logger.info("Modelo %s no respondió en tiempo (%s), evaluando siguiente.", model_name, e)
                    continue
        except Exception as err:
            logger.warning("Fallo al inicializar cliente Gemini: %s", err)

    # 3. Motor Conversacional Reflexivo Inteligente Multidominio (Fallback local reflexivo)
    fallback_reply = _smart_conversational_nlp(cleaned_msg, context_mode, is_en)
    suggestions = _get_suggestions(context_mode, cleaned_msg, is_en)
    return fallback_reply, suggestions


def _smart_conversational_nlp(message: str, context_mode: str, is_en: bool) -> str:
    norm = _normalize(message)

    # ------------------ MODO ADMIN DIRECTIVO ------------------
    if context_mode == "admin":
        if any(w in norm for w in ["cctv", "vision matrix", "matriz", "tiempo real", "en vivo", "live", "mosaic"]):
            if is_en:
                return (
                    "📹 **NEXIA Vision Matrix — Live CCTV (Demo):**\n"
                    "The Live CCTV section in your Admin Panel enables comprehensive multi-camera monitoring:\n"
                    "• **Spotlight Monitor:** Central high-definition feed with real-time HUD (active clock, REC status, camera ID).\n"
                    "• **Interactive Mosaic:** Switch across Floors 1, 2, and 3 or filter by classroom.\n"
                    "• **Grid Modes:** Toggle between 1x1 Spotlight, 2x2 Grid, or 3x3 Matrix.\n"
                    "• **Recorded Footage Playback:** Any uploaded MP4 footage plays natively in loop mode.\n"
                    "• **AI Bounding Boxes HUD:** Toggle simulated motion and entity detection scanlines."
                )
            return (
                "📹 **NEXIA Vision Matrix — CCTV en Tiempo Real (Demo):**\n"
                "El centro de monitoreo Vision Matrix para directivos te permite:\n"
                "• **Monitor Principal:** Transmisión con HUD táctico (reloj sincronizado, estado REC en vivo, código de cámara y salón).\n"
                "• **Mosaico Multicámara:** Selecciona cámaras organizadas por Pisos 1, 2 y 3 para cambiar el flujo en pantalla.\n"
                "• **Modos de Visualización:** Alterna entre Monitor 1x1, Grilla 2x2 y Matriz 3x3.\n"
                "• **Reproducción de Grabaciones:** Las grabaciones subidas al servidor se transmiten de forma fluida con control de pausa y pantalla completa.\n"
                "• **HUD de Detección IA:** Activa o desactiva cajas delimitadoras simuladas sobre el flujo de video."
            )

        if any(w in norm for w in ["manual", "pdf", "subir"]):
            if is_en:
                return (
                    "📄 **School Handbook Management (PDF):**\n"
                    "You can update the official School Handbook at any time in the **'School Handbook'** tab.\n"
                    "• Uploaded PDF documents immediately replace the active version for the entire educational community.\n"
                    "• Students and parents can inspect or download it from the main navbar."
                )
            return (
                "📄 **Gestión del Manual de Convivencia (PDF):**\n"
                "Como directivo, puedes actualizar el archivo PDF oficial en el **Panel de Administración** > pestaña **'Manual Escolar'**.\n"
                "• Al cargar un nuevo PDF, este reemplaza la versión vigente de inmediato para toda la comunidad escolar.\n"
                "• Los estudiantes y familias pueden consultarlo o descargarlo desde el menú superior."
            )

        if any(w in norm for w in ["confianza", "ia", "analisis", "gemini", "nexia", "porcentaje"]):
            if is_en:
                return (
                    "🤖 **Interpreting NEXIA Vision Confidence:**\n"
                    "• **HIGH Confidence:** Clear spatial-temporal match; key moments and actions closely match report details.\n"
                    "• **MEDIUM / LOW Confidence:** Obstructed angle, distant view, or ambiguous movement.\n"
                    "• **Golden Rule:** NEXIA never automatically sanctions students. It serves as objective evidence for human administrative deliberation."
                )
            return (
                "🤖 **Interpretación de Confianza del Motor NEXIA:**\n"
                "• **Confianza ALTA:** Coincidencia espaciotemporal clara entre la narración y las acciones observables en cámara.\n"
                "• **Confianza MEDIA / BAJA:** Ángulo lejano, campo visual con obstáculos o movimiento ambiguo.\n"
                "• **Regla de Oro:** El Motor NEXIA nunca emite sanciones automáticas; actúa como evidencia técnica de apoyo para el comité humano de convivencia."
            )

        if any(w in norm for w in ["apela", "sancion", "usuario", "descargo"]):
            if is_en:
                return (
                    "⚖️ **Managing Sanctions & Appeals:**\n"
                    "• When an account is sanctioned for misuse, the user can file an appeal within 5 business days.\n"
                    "• In the **'Appeals'** tab, you can inspect their arguments and approve (lift sanction) or reject the appeal to ensure due process."
                )
            return (
                "⚖️ **Gestión de Sanciones y Apelaciones:**\n"
                "• Si un usuario incurre en uso malicioso, el administrador puede suspender la cuenta indicando el motivo.\n"
                "• El usuario tiene derecho al debido proceso radicando una apelación.\n"
                "• En la pestaña **'Apelaciones'** puedes deliberar sobre sus argumentos y decidir levantar la sanción o ratificarla."
            )

    # ------------------ RESPUESTAS EN INGLÉS (USUARIOS) ------------------
    if is_en:
        if any(w in norm for w in ["bully", "bullying", "harass", "scared", "threat", "insult", "teasing"]):
            return (
                "💙 **You are not alone, and your safety is our top priority.**\n"
                "Bullying and harassment are taken very seriously under **Law 1620 of 2013**.\n\n"
                "**Recommended Steps:**\n"
                "1. **Do not remain silent:** Talk to a trusted teacher, coordinator, or school counselor.\n"
                "2. **Strict Confidentiality:** When you file a report on NEXIA, your identity is shielded with a private tracking code (`NEX-XXXX`).\n"
                "3. **Objective Support:** Our AI assists in verifying facts objectively without public shaming.\n\n"
                "Would you like to file a confidential report right now?\n\n"
                "[ACTION:report|📝 Create Confidential Report]\n"
                "[ACTION:manual|📖 View Coexistence Handbook]"
            )

        if any(w in norm for w in ["stolen", "theft", "lost", "cellphone", "phone", "backpack", "wallet"]):
            return (
                "🔍 **Dealing with Stolen or Lost Belongings:**\n"
                "NEXIA helps investigate incidents by correlating security camera footage with reported times and locations.\n\n"
                "**Key Recommendations:**\n"
                "• **Narrow Time Range:** Provide an exact 3 to 5-minute window (e.g., 10:15 - 10:20 AM) so AI footage analysis is fast and precise.\n"
                "• **Exact Room:** Select the classroom or courtyard from our 3-floor interactive blueprint.\n"
                "• **Keep Your Code:** Save your unique `NEX-XXXX` code to track resolution progress.\n\n"
                "[ACTION:report|📝 Report Incident Now]\n"
                "[ACTION:map|🏛️ Check Camera Blueprint]"
            )

        if any(w in norm for w in ["fight", "fighting", "violence", "punch", "aggression"]):
            return (
                "⚠️ **Immediate Conflict and Physical Aggression Protocol:**\n"
                "1. **Safety First:** Do not physically intervene in fights to protect your own integrity.\n"
                "2. **Alert Staff:** Immediately notify the nearest teacher, floor coordinator, or security personnel.\n"
                "3. **Institutional Record:** Physical aggression constitutes a **Type II or Type III** violation under Law 1620. Filing a report on NEXIA activates mediation protocols.\n\n"
                "[ACTION:report|📝 Report Incident Immediately]"
            )

        if any(w in norm for w in ["where is", "floor", "classroom", "room", "building", "map", "location"]):
            return (
                "🏛️ **Campus Architectural Directory (3 Floors):**\n"
                "• **Floor 1 (Ground Floor):** Multipurpose Hall, Science Labs (Physics, Chemistry, Biology), Arts & Dance Rooms, Agora, Tech Labs 1-3, Computer Labs 1-3, Auditorium, Principal Office, Sports Courts, and Preschool wing.\n"
                "• **Floor 2:** Classrooms 201 to 216, Teachers' Lounge, English Lab, Bridge Convector, Library, and Cafeteria/Dining Hall.\n"
                "• **Floor 3:** West Wing (Classrooms 301-316, Music Rooms 1 & 2, Restrooms) and East Wing (Dining Hall Upper Bleachers).\n\n"
                "[ACTION:map|🏛️ Open 3D Floor Explorer]"
            )

    # ------------------ MODO USUARIO EN ESPAÑOL (SITUACIONAL) ------------------

    # Acoso, bullying, hostigamiento, amenazas o miedo
    if any(w in norm for w in ["bullying", "acoso", "me molestan", "me insultan", "amenaza", "tengo miedo", "se burlan", "apodos", "intimid", "burlas"]):
        return (
            "💙 **No estás solo(a) y tu bienestar es la prioridad absoluta del colegio.**\n\n"
            "El acoso o intimidación escolar está contemplado y sancionado por la **Ley 1620 de 2013** como una falta que vulnera la dignidad de los estudiantes.\n\n"
            "**Pasos recomendados para actuar con seguridad:**\n"
            "1. **No guardes silencio:** Habla de inmediato con tu director de grupo, un docente de confianza o el equipo de psicorientación escolar.\n"
            "2. **Tu reporte es confidencial:** En NEXIA no solicitamos apodos ni exponemos tus datos. Al radicar se genera un **Código Único (`NEX-XXXX`)** que solo la coordinación directiva puede atender formalmente.\n"
            "3. **Acompañamiento:** Tienes derecho a ser escuchado sin represalias y con garantías de protección.\n\n"
            "¿Deseas registrar lo sucedido de forma protegida para que coordinación intervenga?\n\n"
            "[ACTION:report|📝 Radicar Reporte Confidencial]\n"
            "[ACTION:manual|📖 Conocer Protocolos Ley 1620]"
        )

    # Hurto, robo, pérdida de objetos
    if any(w in norm for w in ["robo", "robaron", "hurto", "se me perdio", "sacaron", "celular", "maleta", "billetera", "plata", "pertenencias", "bolso"]):
        return (
            "🔍 **Orientación ante Hurto o Pérdida de Pertenencias:**\n\n"
            "NEXIA cuenta con un sistema de verificación de video para respaldar investigaciones de manera objetiva:\n\n"
            "**Recomendaciones esenciales para que tu reporte sea efectivo:**\n"
            "• **Delimita la hora:** Indica un rango corto de **3 a 5 minutos** (ej: *entre las 10:15 AM y 10:20 AM*). Esto permite que el fragmento de video correspondiente sea analizado con máxima rapidez.\n"
            "• **Indica el salón exacto:** Usa el plano interactivo para señalar el salón (ej: Salón 204 en Piso 2, Salón 304 en Piso 3 o Informática).\n"
            "• **Guarda tu código `NEX-XXXX`:** Te servirá para consultar el avance del caso sin que nadie más se entere.\n\n"
            "[ACTION:report|📝 Iniciar Reporte de Hurto]\n"
            "[ACTION:map|🏛️ Ver Cámaras en Plano]"
        )

    # Riñas, peleas, agresiones físicas
    if any(w in norm for w in ["pelea", "rina", "agresion", "golpe", "pelean", "empujon", "amenazaron"]):
        return (
            "⚠️ **Protocolo ante Riñas o Agresiones Físicas:**\n\n"
            "1. **Tu integridad primero:** No intentes intervenir físicamente si hay una disputa en curso. Busca al docente de turno, orientador o personal de apoyo de inmediato.\n"
            "2. **Activación de Ruta:** Las riñas constituyen faltas **Tipo II o Tipo III** según el Manual de Convivencia.\n"
            "3. **Registro en NEXIA:** Si fuiste testigo o afectado, radicar el reporte permite que las cámaras de seguridad aporten evidencia objetiva y se inicie una mediación formativa.\n\n"
            "[ACTION:report|📝 Reportar Incidente]\n"
            "[ACTION:manual|📖 Ver Ruta de Atención Integral]"
        )

    # Ubicaciones de salones y dependencias en los 3 pisos
    if any(w in norm for w in ["donde queda", "donde esta", "ubicacion", "salon", "baño", "comedor", "patio", "cancha", "rectoria", "enfermeria"]):
        # Reconocimiento de salones específicos
        salon_match = re.search(r"(\d{3})", norm)
        salon_num = salon_match.group(1) if salon_match else None

        if salon_num:
            if salon_num.startswith("3"):
                return (
                    f"📍 **Ubicación del Salón {salon_num} (Piso 3):**\n\n"
                    f"El **Salón {salon_num}** se encuentra en el **Tercer Piso**, accesible por la escalera principal y la rampa conector central. "
                    "Esta zona cuenta con monitoreo activo de cámaras CCTV (cámaras CAM-301 a CAM-316). "
                    "Al radicar un reporte para este salón, el sistema enlazará automáticamente su cámara correspondiente.\n\n"
                    "[ACTION:map|🏛️ Ver Salón en el Plano de Piso 3]\n"
                    "[ACTION:report|📝 Reportar en este Salón]"
                )
            if salon_num.startswith("2"):
                return (
                    f"📍 **Ubicación del Salón {salon_num} (Piso 2):**\n\n"
                    f"El **Salón {salon_num}** está ubicado en el **Segundo Piso** (ala de aulas 201 a 216), junto a la Biblioteca Escolar y el pasillo central. "
                    "Cuenta con cámara de seguridad de alta definición enlazada.\n\n"
                    "[ACTION:map|🏛️ Ver Salón en el Plano de Piso 2]\n"
                    "[ACTION:report|📝 Reportar en este Salón]"
                )

        if "comedor" in norm or "grada" in norm:
            return (
                "🍽️ **Ubicación del Comedor Escolar y Gradas:**\n\n"
                "• El área principal del **Comedor Escolar** se sitúa en el **Piso 2**.\n"
                "• Las **Gradas del Comedor** conectan visualmente con el **Piso 3** en el bloque oriental.\n"
                "Ambas zonas disponen de cobertura de vigilancia.\n\n"
                "[ACTION:map|🏛️ Ver Comedor en el Mapa]"
            )

        if "informatica" in norm or "sistema" in norm or "tecnologia" in norm:
            return (
                "💻 **Salas de Sistemas e Informática:**\n\n"
                "Las salas de Sistemas 1, 2 y 3 (junto con las Aulas de Tecnología) están ubicadas en el **Primer Piso** cerca al Auditorio Principal. "
                "Tienen cobertura prioritaria con cámaras CAM-P1-INFO1, INFO2 e INFO3.\n\n"
                "[ACTION:map|🏛️ Ver Informática en el Mapa]"
            )

        return (
            "🏛️ **Distribución General del Colegio (3 Pisos):**\n\n"
            "• **Piso 1 (Planta Baja):** Patios y canchas deportivas, Aula Polivalente, Laboratorios de Ciencias, Auditorio, Rectoría, Enfermería y Salas de Informática.\n"
            "• **Piso 2:** Salones de clase 201 al 216, Sala de Profesores, Aula de Inglés, Biblioteca y Comedor.\n"
            "• **Piso 3:** Salones 301 al 316, Aulas de Música 1 y 2, pasarela central y gradas del comedor.\n\n"
            "[ACTION:map|🏛️ Abrir Navegador de Planos]"
        )

    # Identidad NEXIA / Grupo Nexus
    if any(w in norm for w in ["nexus", "quien te creo", "grupo nexus", "que es nexia"]):
        return (
            "🚀 **Acerca de NEXIA y Grupo Nexus:**\n\n"
            "**NEXIA** es la plataforma integral de convivencia, mediación escolar y seguridad preventiva del Colegio Alfonso López Michelsen, "
            "desarrollada con orgullo por el equipo de **Grupo Nexus**.\n\n"
            "Nuestro lema oficial es:\n"
            "> *REPORTA • VERIFICA • CONSTRUYE ENTORNOS MÁS SEGUROS*\n\n"
            "El sistema combina planos arquitectónicos, enlaza cámaras escolares en tiempo real y utiliza inteligencia artificial para garantizar el debido proceso de toda la comunidad educativa."
        )

    # Respuesta de orientación contextual integral por defecto
    return (
        "He comprendido tu consulta sobre la convivencia y funcionamiento en el **Colegio Alfonso López Michelsen**. "
        "Como **NEXIA Copilot**, estoy diseñado para orientarte con empatía y precisión técnica:\n\n"
        "• Si necesitas reportar un hecho reciente, puedes hacerlo de forma protegida con código anónimo.\n"
        "• Si buscas ubicar un aula o espacio, puedes navegar por el plano arquitectónico de los 3 pisos.\n"
        "• Si deseas conocer las normas o clasificaciones de faltas, puedes revisar el Manual de Convivencia Escolar.\n\n"
        "¿Qué acción deseas realizar a continuación?\n\n"
        "[ACTION:report|📝 Radicar un Reporte]\n"
        "[ACTION:map|🏛️ Ver Plano Escolar]\n"
        "[ACTION:track|🔍 Consultar Caso]"
    )


def _get_suggestions(context_mode: str, message: str, is_en: bool = False) -> list[str]:
    norm = _normalize(message)

    if context_mode == "admin":
        if is_en:
            return [
                "How does the CCTV Matrix Live Demo work?",
                "How to interpret AI confidence?",
                "How to manage sanctions and appeals?",
            ]
        return [
            "¿Cómo funciona la Matriz CCTV en Vivo (Demo)?",
            "¿Cómo interpretar la confianza de la IA?",
            "Gestión de sanciones y apelaciones",
        ]

    if is_en:
        if any(w in norm for w in ["bully", "scared", "threat"]):
            return [
                "Is my identity protected?",
                "How do I create a report?",
                "What are Law 1620 Type II offenses?",
            ]
        if any(w in norm for w in ["stolen", "theft", "lost"]):
            return [
                "Why is an exact time range needed?",
                "How do I track my case?",
                "Check camera coverage on Floor 3",
            ]
        return [
            "How do I create a report?",
            "What offenses are in Law 1620?",
            "Where is Classroom 304 on Floor 3?",
        ]

    # Sugerencias dinámicas en español
    if any(w in norm for w in ["bully", "acoso", "amenaza", "miedo"]):
        return [
            "¿Mi identidad está protegida?",
            "¿Cómo crear un reporte?",
            "¿Qué faltas contempla la Ley 1620?",
        ]

    if any(w in norm for w in ["robo", "hurto", "perdio", "celular"]):
        return [
            "¿Por qué poner un rango de tiempo exacto?",
            "¿Cómo consulto el estado de mi caso?",
            "¿Dónde queda el Salón 304 en el Piso 3?",
        ]

    if any(w in norm for w in ["piso", "salon", "mapa", "donde"]):
        return [
            "¿Cómo crear un reporte?",
            "¿Dónde queda el Salón 304 en el Piso 3?",
            "¿Qué faltas contempla la Ley 1620?",
        ]

    return [
        "¿Cómo crear un reporte?",
        "¿Por qué poner un rango de tiempo exacto?",
        "¿Mi identidad está protegida?",
    ]
