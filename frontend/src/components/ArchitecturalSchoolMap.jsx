import { useState } from 'react'

// Mapeo automático de salones/zonas a la cámara más cercana
const ROOM_CAMERA_MAP = {
  // Piso 1
  'Aula Polivalente': 'CAM-P1-01',
  'Laboratorio de Física': 'CAM-P1-01',
  'Laboratorio de Química': 'CAM-P1-01',
  'Sala de Artes': 'CAM-P1-01',
  'Sala de Danzas': 'CAM-P1-01',
  'Ágora': 'CAM-P1-01',
  'Rectoría y Enfermería': 'CAM-P1-03',
  'Aula de Tecnología 1': 'CAM-P1-03',
  'Aula de Tecnología 2': 'CAM-P1-03',
  'Aula de Tecnología 3': 'CAM-P1-03',
  'Laboratorio de Ciencias 1': 'CAM-P1-03',
  'Laboratorio de Ciencias 2': 'CAM-P1-03',
  'Sala de Sistemas 1 (Informática 1)': 'CAM-P1-04',
  'Sala de Sistemas 2 (Informática 2)': 'CAM-P1-04',
  'Sala de Sistemas 3 (Informática 3)': 'CAM-P1-04',
  'Auditorio Principal': 'CAM-P1-04',
  'Patio Canchas (Punto de Encuentro)': 'CAM-P1-01',
  'Zona Verde / Kiosco': 'CAM-P1-02',
  'Edificio Preescolar': 'CAM-P1-02',

  // Piso 2
  'Salón 201': 'CAM-201',
  'Salón 202': 'CAM-202',
  'Salón 203': 'CAM-203',
  'Salón 204': 'CAM-204',
  'Salón 205': 'CAM-205',
  'Salón 206': 'CAM-206',
  'Salón 207': 'CAM-207',
  'Salón 208': 'CAM-208',
  'Salón 209': 'CAM-209',
  'Sala de Profesores': 'CAM-201',
  'Aula de Inglés': 'CAM-209',
  'Biblioteca Escolar': 'CAM-215',
  'Comedor Escolar': 'CAM-216',

  // Piso 3
  'Salón 301': 'CAM-301',
  'Salón 302': 'CAM-302',
  'Salón 303': 'CAM-303',
  'Salón 304': 'CAM-304',
  'Salón 305': 'CAM-305',
  'Salón 306': 'CAM-306',
  'Música 1 (307)': 'CAM-307',
  'Música 2 (308)': 'CAM-308',
  'Salón 309': 'CAM-309',
  'Salón 310': 'CAM-310',
  'Salón 311': 'CAM-311',
  'Salón 312': 'CAM-312',
  'Salón 313': 'CAM-313',
  'Salón 314': 'CAM-314',
  'Salón 315': 'CAM-315',
  'Salón 316': 'CAM-316',
  'Baños Hombres (P3)': 'CAM-313',
  'Baños Mujeres (P3)': 'CAM-313',
  'Rampa / Pasillo Conector (P3)': 'CAM-315',
  'Gradas Comedor': 'CAM-316',
}

export default function ArchitecturalSchoolMap({
  selectedLocation = '',
  onSelectLocation,
  readOnly = false,
  lang = 'es',
}) {
  const [activeFloor, setActiveFloor] = useState(() => {
    if (selectedLocation?.includes('30') || selectedLocation?.includes('31') || selectedLocation?.includes('Música') || selectedLocation?.includes('Gradas')) {
      return 'piso3'
    }
    if (selectedLocation?.includes('20') || selectedLocation?.includes('Biblioteca') || selectedLocation?.includes('Comedor') || selectedLocation?.includes('Inglés')) {
      return 'piso2'
    }
    return 'piso1'
  })

  const [hoveredRoom, setHoveredRoom] = useState(null)

  const handleRoomClick = (roomName) => {
    if (readOnly || !onSelectLocation) return
    const floorLabel = activeFloor === 'piso1'
      ? (lang === 'es' ? 'Primer piso (Patios, Zonas Comunes e Informática)' : 'Floor 1 (Courtyards, Common Areas & IT)')
      : activeFloor === 'piso2'
      ? (lang === 'es' ? 'Segundo piso' : 'Floor 2 (Classrooms, Library & Dining)')
      : (lang === 'es' ? 'Tercer piso (Salones 301-316, Música y Gradas)' : 'Floor 3 (Classrooms 301-316, Music & Bleachers)')

    const camId = ROOM_CAMERA_MAP[roomName] || ''
    onSelectLocation({ floor: floorLabel, location: roomName, cameraId: camId })
  }

  const isSelected = (roomName) => selectedLocation === roomName

  return (
    <div className="blueprint-container">
      {/* Barra de control de pisos */}
      <div className="blueprint-header">
        <div className="blueprint-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <div>
            <strong>{lang === 'es' ? 'Plano Arquitectónico Escolar' : 'Official School Architectural Blueprint'}</strong>
            <small>Colegio Alfonso López Michelsen</small>
          </div>
        </div>

        <div className="blueprint-tabs">
          <button
            type="button"
            className={`blueprint-tab ${activeFloor === 'piso1' ? 'active' : ''}`}
            onClick={() => setActiveFloor('piso1')}
          >
            {lang === 'es' ? '1° Piso (Planta Baja)' : 'Floor 1 (Ground Level)'}
          </button>
          <button
            type="button"
            className={`blueprint-tab ${activeFloor === 'piso2' ? 'active' : ''}`}
            onClick={() => setActiveFloor('piso2')}
          >
            {lang === 'es' ? '2° Piso (Aulas y Biblioteca)' : 'Floor 2 (Classrooms & Library)'}
          </button>
          <button
            type="button"
            className={`blueprint-tab ${activeFloor === 'piso3' ? 'active' : ''}`}
            onClick={() => setActiveFloor('piso3')}
          >
            {lang === 'es' ? '3° Piso (Salones, Música y Gradas)' : 'Floor 3 (Rooms 301-316, Music & Bleachers)'}
          </button>
        </div>
      </div>

      {/* Indicador de ayuda */}
      <div className="blueprint-hint">
        {selectedLocation ? (
          <span className="selected-tag">
            {lang === 'es' ? 'Ubicación seleccionada:' : 'Selected location:'} <strong>{selectedLocation}</strong>
          </span>
        ) : (
          <span>{lang === 'es' ? 'Haz clic sobre el salón o zona del plano donde ocurrieron los hechos' : 'Click on the room or area on the blueprint where the incident took place'}</span>
        )}
        {hoveredRoom && <span className="hover-tag">{hoveredRoom}</span>}
      </div>

      {/* Renderizado vectorial SVG del plano */}
      <div className="blueprint-canvas-wrap">
        {activeFloor === 'piso1' && (
          /* ============================================================== */
          /* PISO 1: Basado en el plano de Rutas de Evacuación provisto     */
          /* ============================================================== */
          <svg
            className="blueprint-svg"
            viewBox="0 0 920 620"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeOpacity="0.05" strokeWidth="1" />
              </pattern>
            </defs>

            <rect width="920" height="620" fill="var(--blueprint-bg, #0b1324)" />
            <rect width="920" height="620" fill="url(#gridPattern)" />

            {/* Pasillos y ejes peatonales principales */}
            <path
              d="M 170 50 L 170 570 M 290 50 L 290 570 M 170 210 L 650 210 M 170 420 L 750 420"
              stroke="var(--blueprint-wall, #334155)"
              strokeDasharray="4 4"
              strokeWidth="1.5"
              fill="none"
            />

            {/* BLOQUE IZQUIERDO */}
            <g className="room-group">
              <g
                className={`blueprint-room ${isSelected('Aula Polivalente') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Aula Polivalente')}
                onMouseEnter={() => setHoveredRoom('Aula Polivalente')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="50" y="50" width="105" height="130" rx="3" />
                <text x="102" y="115" textAnchor="middle">AULA POLIVALENTE</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Laboratorio de Física') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Laboratorio de Física')}
                onMouseEnter={() => setHoveredRoom('Laboratorio de Física')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="50" y="230" width="105" height="50" rx="3" />
                <text x="102" y="260" textAnchor="middle">LAB. FÍSICA</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Laboratorio de Química') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Laboratorio de Química')}
                onMouseEnter={() => setHoveredRoom('Laboratorio de Química')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="50" y="295" width="105" height="50" rx="3" />
                <text x="102" y="325" textAnchor="middle">LAB. QUÍMICA</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Sala de Artes') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Sala de Artes')}
                onMouseEnter={() => setHoveredRoom('Sala de Artes')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="50" y="360" width="105" height="50" rx="3" />
                <text x="102" y="390" textAnchor="middle">SALA DE ARTES</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Sala de Danzas') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Sala de Danzas')}
                onMouseEnter={() => setHoveredRoom('Sala de Danzas')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="50" y="445" width="70" height="110" rx="3" />
                <text x="85" y="505" textAnchor="middle">DANZAS</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Ágora') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Ágora')}
                onMouseEnter={() => setHoveredRoom('Ágora (Teatro al aire libre)')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <path d="M 40 445 A 50 50 0 0 0 40 555 Z" />
                <text x="32" y="505" textAnchor="middle" transform="rotate(-90 32 505)">ÁGORA</text>
              </g>
            </g>

            {/* BLOQUE CENTRAL */}
            <g className="room-group">
              <g
                className={`blueprint-room ${isSelected('Rectoría y Enfermería') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Rectoría y Enfermería')}
                onMouseEnter={() => setHoveredRoom('Rectoría, Enfermería y Profesores')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="185" y="50" width="85" height="130" rx="3" />
                <text x="227" y="110" textAnchor="middle">RECTORÍA /</text>
                <text x="227" y="125" textAnchor="middle">ENFERMERÍA</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Aula de Tecnología 1') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Aula de Tecnología 1')}
                onMouseEnter={() => setHoveredRoom('Aula de Tecnología 1')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="185" y="230" width="85" height="50" rx="3" />
                <text x="227" y="260" textAnchor="middle">TECNOLOGÍA 1</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Aula de Tecnología 2') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Aula de Tecnología 2')}
                onMouseEnter={() => setHoveredRoom('Aula de Tecnología 2')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="185" y="295" width="85" height="50" rx="3" />
                <text x="227" y="325" textAnchor="middle">TECNOLOGÍA 2</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Aula de Tecnología 3') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Aula de Tecnología 3')}
                onMouseEnter={() => setHoveredRoom('Aula de Tecnología 3')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="185" y="360" width="85" height="50" rx="3" />
                <text x="227" y="390" textAnchor="middle">TECNOLOGÍA 3</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Laboratorio de Ciencias 1') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Laboratorio de Ciencias 1')}
                onMouseEnter={() => setHoveredRoom('Laboratorio de Ciencias 1')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="185" y="445" width="85" height="50" rx="3" />
                <text x="227" y="475" textAnchor="middle">LAB. CIENCIAS 1</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Laboratorio de Ciencias 2') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Laboratorio de Ciencias 2')}
                onMouseEnter={() => setHoveredRoom('Laboratorio de Ciencias 2')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="185" y="505" width="85" height="50" rx="3" />
                <text x="227" y="535" textAnchor="middle">LAB. CIENCIAS 2</text>
              </g>
            </g>

            {/* BLOQUE DERECHO */}
            <g className="room-group">
              <g
                className={`blueprint-room ${isSelected('Sala de Sistemas 3 (Informática 3)') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Sala de Sistemas 3 (Informática 3)')}
                onMouseEnter={() => setHoveredRoom('Sala de Sistemas 3 / Informática 3')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="305" y="50" width="95" height="40" rx="3" />
                <text x="352" y="75" textAnchor="middle">SISTEMAS 3</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Sala de Sistemas 2 (Informática 2)') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Sala de Sistemas 2 (Informática 2)')}
                onMouseEnter={() => setHoveredRoom('Sala de Sistemas 2 / Informática 2')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="305" y="95" width="95" height="40" rx="3" />
                <text x="352" y="120" textAnchor="middle">SISTEMAS 2</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Sala de Sistemas 1 (Informática 1)') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Sala de Sistemas 1 (Informática 1)')}
                onMouseEnter={() => setHoveredRoom('Sala de Sistemas 1 / Informática 1')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="305" y="140" width="95" height="40" rx="3" />
                <text x="352" y="165" textAnchor="middle">SISTEMAS 1</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Auditorio Principal') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Auditorio Principal')}
                onMouseEnter={() => setHoveredRoom('Gran Auditorio Escolar')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="420" y="50" width="200" height="130" rx="3" />
                <text x="520" y="115" textAnchor="middle">AUDITORIO PRINCIPAL</text>
              </g>
            </g>

            {/* PATIOS Y ZONAS COMUNES */}
            <g className="room-group">
              <g
                className={`blueprint-room ${isSelected('Patio Canchas (Punto de Encuentro)') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Patio Canchas (Punto de Encuentro)')}
                onMouseEnter={() => setHoveredRoom('Patio Canchas y Punto de Encuentro')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="440" y="230" width="180" height="150" rx="6" />
                <circle cx="490" cy="305" r="28" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" />
                <circle cx="570" cy="305" r="28" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" />
                <text x="530" y="300" textAnchor="middle">PATIO CANCHAS</text>
                <text x="530" y="320" textAnchor="middle" style={{ fontSize: '10px' }}>PUNTO DE ENCUENTRO</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Zona Verde / Kiosco') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Zona Verde / Kiosco')}
                onMouseEnter={() => setHoveredRoom('Zona Verde y Kiosco')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <circle cx="370" cy="485" r="50" />
                <text x="370" y="488" textAnchor="middle">ZONA VERDE</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Edificio Preescolar') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Edificio Preescolar')}
                onMouseEnter={() => setHoveredRoom('Edificio Preescolar (Salones 1 al 6)')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="460" y="445" width="220" height="110" rx="3" />
                <line x1="460" y1="500" x2="680" y2="500" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1" />
                <text x="570" y="480" textAnchor="middle">PREESCOLAR (1 - 3)</text>
                <text x="570" y="535" textAnchor="middle">PREESCOLAR (4 - 6)</text>
              </g>
            </g>
          </svg>
        )}

        {activeFloor === 'piso2' && (
          /* ============================================================== */
          /* PISO 2: Basado en el plano provisto                            */
          /* ============================================================== */
          <svg
            className="blueprint-svg"
            viewBox="0 0 920 620"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <pattern id="gridPattern2" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeOpacity="0.05" strokeWidth="1" />
              </pattern>
            </defs>

            <rect width="920" height="620" fill="var(--blueprint-bg, #0b1324)" />
            <rect width="920" height="620" fill="url(#gridPattern2)" />

            {/* Muros del corredor central con tragaluces */}
            <rect x="195" y="60" width="30" height="90" fill="none" stroke="var(--blueprint-wall, #334155)" strokeWidth="1.5" />
            <rect x="195" y="210" width="30" height="150" fill="none" stroke="var(--blueprint-wall, #334155)" strokeWidth="1.5" />
            <rect x="195" y="420" width="30" height="80" fill="none" stroke="var(--blueprint-wall, #334155)" strokeWidth="1.5" />

            {/* Pasarela conector hacia biblioteca y comedor */}
            <g className="blueprint-corridor">
              <rect x="250" y="225" width="200" height="36" rx="2" fill="none" stroke="var(--blueprint-wall, #334155)" strokeWidth="1.5" />
              <line x1="260" y1="243" x2="440" y2="243" stroke="var(--blueprint-wall, #334155)" strokeDasharray="6 4" strokeWidth="1.5" />
              <text x="350" y="247" textAnchor="middle" style={{ fontSize: '9px', fill: 'var(--text-muted)' }}>PASARELA CONECTOR</text>
            </g>

            {/* HILERA IZQUIERDA */}
            <g className="room-group">
              <g
                className={`blueprint-room ${isSelected('Salón 201') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 201')}
                onMouseEnter={() => setHoveredRoom('Salón 201')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="80" y="50" width="95" height="50" rx="2" />
                <text x="127" y="80" textAnchor="middle">SALÓN 201</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Salón 202') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 202')}
                onMouseEnter={() => setHoveredRoom('Salón 202')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="80" y="105" width="95" height="50" rx="2" />
                <text x="127" y="135" textAnchor="middle">SALÓN 202</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Salón 203') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 203')}
                onMouseEnter={() => setHoveredRoom('Salón 203')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="80" y="160" width="95" height="50" rx="2" />
                <text x="127" y="190" textAnchor="middle">SALÓN 203</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Salón 204') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 204')}
                onMouseEnter={() => setHoveredRoom('Salón 204')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="80" y="270" width="95" height="50" rx="2" />
                <text x="127" y="300" textAnchor="middle">SALÓN 204</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Salón 205') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 205')}
                onMouseEnter={() => setHoveredRoom('Salón 205')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="80" y="325" width="95" height="50" rx="2" />
                <text x="127" y="355" textAnchor="middle">SALÓN 205</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Sala de Profesores') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Sala de Profesores')}
                onMouseEnter={() => setHoveredRoom('Sala de Profesores (Piso 2)')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="80" y="440" width="95" height="60" rx="2" />
                <text x="127" y="475" textAnchor="middle">SALA DE PROFESORES</text>
              </g>
            </g>

            {/* HILERA DERECHA */}
            <g className="room-group">
              <g
                className={`blueprint-room ${isSelected('Salón 206') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 206')}
                onMouseEnter={() => setHoveredRoom('Salón 206')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="245" y="50" width="95" height="50" rx="2" />
                <text x="292" y="80" textAnchor="middle">SALÓN 206</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Salón 207') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 207')}
                onMouseEnter={() => setHoveredRoom('Salón 207')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="245" y="105" width="95" height="50" rx="2" />
                <text x="292" y="135" textAnchor="middle">SALÓN 207</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Salón 208') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 208')}
                onMouseEnter={() => setHoveredRoom('Salón 208')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="245" y="270" width="95" height="50" rx="2" />
                <text x="292" y="300" textAnchor="middle">SALÓN 208</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Salón 209') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 209')}
                onMouseEnter={() => setHoveredRoom('Salón 209')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="245" y="325" width="95" height="50" rx="2" />
                <text x="292" y="355" textAnchor="middle">SALÓN 209</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Aula de Inglés') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Aula de Inglés')}
                onMouseEnter={() => setHoveredRoom('Aula de Inglés')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="245" y="440" width="95" height="60" rx="2" />
                <text x="292" y="475" textAnchor="middle">AULA DE INGLÉS</text>
              </g>
            </g>

            {/* SECCIÓN BIBLIOTECA Y COMEDOR */}
            <g className="room-group">
              <g
                className={`blueprint-room ${isSelected('Biblioteca Escolar') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Biblioteca Escolar')}
                onMouseEnter={() => setHoveredRoom('Biblioteca Escolar')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="470" y="50" width="140" height="150" rx="4" />
                <text x="540" y="130" textAnchor="middle">BIBLIOTECA</text>
              </g>

              <g
                className={`blueprint-room ${isSelected('Comedor Escolar') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Comedor Escolar')}
                onMouseEnter={() => setHoveredRoom('Comedor Escolar')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="650" y="50" width="200" height="150" rx="4" />
                <text x="750" y="130" textAnchor="middle">COMEDOR ESCOLAR</text>
              </g>
            </g>
          </svg>
        )}

        {activeFloor === 'piso3' && (
          /* ============================================================== */
          /* PISO 3: Basado fielmente en el plano físico (media_1788999025907) */
          /* ============================================================== */
          <svg
            className="blueprint-svg"
            viewBox="0 0 960 640"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <pattern id="gridPattern3" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeOpacity="0.05" strokeWidth="1" />
              </pattern>
            </defs>

            <rect width="960" height="640" fill="var(--blueprint-bg, #090f1d)" />
            <rect width="960" height="640" fill="url(#gridPattern3)" />

            {/* Tragaluces / vacíos centrales del corredor */}
            <rect x="195" y="60" width="28" height="110" fill="none" stroke="var(--blueprint-wall, #334155)" strokeWidth="1.5" strokeDasharray="3 3" />
            <rect x="195" y="240" width="28" height="120" fill="none" stroke="var(--blueprint-wall, #334155)" strokeWidth="1.5" strokeDasharray="3 3" />
            <rect x="195" y="440" width="28" height="100" fill="none" stroke="var(--blueprint-wall, #334155)" strokeWidth="1.5" strokeDasharray="3 3" />

            {/* Pasarela y Rampa conector hacia Gradas Comedor */}
            <g className="blueprint-corridor">
              <rect x="360" y="210" width="200" height="32" rx="2" fill="none" stroke="var(--blueprint-wall, #334155)" strokeWidth="1.5" />
              <line x1="370" y1="226" x2="550" y2="226" stroke="#38bdf8" strokeWidth="2" />
              <circle cx="370" cy="226" r="3" fill="#38bdf8" />
              <circle cx="550" cy="226" r="3" fill="#38bdf8" />
              <text x="460" y="200" textAnchor="middle" style={{ fontSize: '9px', fill: 'var(--text-muted)' }}>
                {lang === 'es' ? 'PASILLO / RAMPA CONECTOR' : 'CONNECTOR BRIDGE / RAMP'}
              </text>
            </g>

            {/* COLUMNA IZQUIERDA (Salones 316-309 con Baños) */}
            <g className="room-group">
              {/* Salón 316 */}
              <g
                className={`blueprint-room ${isSelected('Salón 316') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 316')}
                onMouseEnter={() => setHoveredRoom('Salón 316')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="70" y="45" width="105" height="42" rx="2" />
                <text x="122" y="70" textAnchor="middle">SALÓN 316</text>
              </g>

              {/* Salón 315 */}
              <g
                className={`blueprint-room ${isSelected('Salón 315') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 315')}
                onMouseEnter={() => setHoveredRoom('Salón 315')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="70" y="92" width="105" height="42" rx="2" />
                <text x="122" y="117" textAnchor="middle">SALÓN 315</text>
              </g>

              {/* Salón 314 */}
              <g
                className={`blueprint-room ${isSelected('Salón 314') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 314')}
                onMouseEnter={() => setHoveredRoom('Salón 314')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="70" y="139" width="105" height="42" rx="2" />
                <text x="122" y="164" textAnchor="middle">SALÓN 314</text>
              </g>

              {/* Baño Hombres y Baño Mujeres (Superior) */}
              <g
                className={`blueprint-room ${isSelected('Baños Hombres (P3)') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Baños Hombres (P3)')}
                onMouseEnter={() => setHoveredRoom('Baño Hombres (Piso 3 Norte)')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="70" y="186" width="105" height="24" rx="2" style={{ stroke: '#10b981' }} />
                <text x="122" y="202" textAnchor="middle" style={{ fontSize: '7.5px', fill: '#34d399' }}>BAÑO HOMBRES</text>
              </g>
              <g
                className={`blueprint-room ${isSelected('Baños Mujeres (P3)') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Baños Mujeres (P3)')}
                onMouseEnter={() => setHoveredRoom('Baño Mujeres (Piso 3 Norte)')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="70" y="213" width="105" height="24" rx="2" style={{ stroke: '#10b981' }} />
                <text x="122" y="229" textAnchor="middle" style={{ fontSize: '7.5px', fill: '#34d399' }}>BAÑO MUJERES</text>
              </g>

              {/* Salón 313 */}
              <g
                className={`blueprint-room ${isSelected('Salón 313') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 313')}
                onMouseEnter={() => setHoveredRoom('Salón 313')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="70" y="242" width="105" height="42" rx="2" />
                <text x="122" y="267" textAnchor="middle">SALÓN 313</text>
              </g>

              {/* Salón 312 */}
              <g
                className={`blueprint-room ${isSelected('Salón 312') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 312')}
                onMouseEnter={() => setHoveredRoom('Salón 312')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="70" y="289" width="105" height="42" rx="2" />
                <text x="122" y="314" textAnchor="middle">SALÓN 312</text>
              </g>

              {/* Salón 311 */}
              <g
                className={`blueprint-room ${isSelected('Salón 311') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 311')}
                onMouseEnter={() => setHoveredRoom('Salón 311')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="70" y="336" width="105" height="42" rx="2" />
                <text x="122" y="361" textAnchor="middle">SALÓN 311</text>
              </g>

              {/* Baño Hombres y Baño Mujeres (Inferior) */}
              <g
                className={`blueprint-room ${isSelected('Baños Hombres (P3)') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Baños Hombres (P3)')}
                onMouseEnter={() => setHoveredRoom('Baño Hombres (Piso 3 Sur)')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="70" y="383" width="105" height="24" rx="2" style={{ stroke: '#10b981' }} />
                <text x="122" y="399" textAnchor="middle" style={{ fontSize: '7.5px', fill: '#34d399' }}>BAÑO HOMBRES</text>
              </g>
              <g
                className={`blueprint-room ${isSelected('Baños Mujeres (P3)') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Baños Mujeres (P3)')}
                onMouseEnter={() => setHoveredRoom('Baño Mujeres (Piso 3 Sur)')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="70" y="410" width="105" height="24" rx="2" style={{ stroke: '#10b981' }} />
                <text x="122" y="426" textAnchor="middle" style={{ fontSize: '7.5px', fill: '#34d399' }}>BAÑO MUJERES</text>
              </g>

              {/* Salón 310 */}
              <g
                className={`blueprint-room ${isSelected('Salón 310') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 310')}
                onMouseEnter={() => setHoveredRoom('Salón 310')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="70" y="439" width="105" height="45" rx="2" />
                <text x="122" y="466" textAnchor="middle">SALÓN 310</text>
              </g>

              {/* Salón 309 */}
              <g
                className={`blueprint-room ${isSelected('Salón 309') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 309')}
                onMouseEnter={() => setHoveredRoom('Salón 309')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="70" y="489" width="105" height="48" rx="2" />
                <text x="122" y="518" textAnchor="middle">SALÓN 309</text>
              </g>
            </g>

            {/* COLUMNA DERECHA (Salones 301-306, Escaleras y Música 1 y 2) */}
            <g className="room-group">
              {/* Salón 301 */}
              <g
                className={`blueprint-room ${isSelected('Salón 301') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 301')}
                onMouseEnter={() => setHoveredRoom('Salón 301')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="240" y="45" width="95" height="42" rx="2" />
                <text x="287" y="70" textAnchor="middle">SALÓN 301</text>
              </g>

              {/* Salón 302 */}
              <g
                className={`blueprint-room ${isSelected('Salón 302') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 302')}
                onMouseEnter={() => setHoveredRoom('Salón 302')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="240" y="92" width="95" height="42" rx="2" />
                <text x="287" y="117" textAnchor="middle">SALÓN 302</text>
              </g>

              {/* Salón 303 */}
              <g
                className={`blueprint-room ${isSelected('Salón 303') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 303')}
                onMouseEnter={() => setHoveredRoom('Salón 303')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="240" y="139" width="95" height="42" rx="2" />
                <text x="287" y="164" textAnchor="middle">SALÓN 303</text>
              </g>

              {/* Escalera Norte */}
              <g className="blueprint-stairs">
                <rect x="245" y="188" width="85" height="24" rx="1" fill="none" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="255" y1="188" x2="255" y2="212" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="265" y1="188" x2="265" y2="212" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="275" y1="188" x2="275" y2="212" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="285" y1="188" x2="285" y2="212" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="295" y1="188" x2="295" y2="212" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="305" y1="188" x2="305" y2="212" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="315" y1="188" x2="315" y2="212" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <text x="287" y="203" textAnchor="middle" style={{ fontSize: '7px', fill: 'var(--text-dim)' }}>ESCALERAS</text>
              </g>

              {/* Salón 304 */}
              <g
                className={`blueprint-room ${isSelected('Salón 304') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 304')}
                onMouseEnter={() => setHoveredRoom('Salón 304')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="240" y="217" width="95" height="42" rx="2" />
                <text x="287" y="242" textAnchor="middle">SALÓN 304</text>
              </g>

              {/* Salón 305 */}
              <g
                className={`blueprint-room ${isSelected('Salón 305') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 305')}
                onMouseEnter={() => setHoveredRoom('Salón 305')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="240" y="264" width="95" height="42" rx="2" />
                <text x="287" y="289" textAnchor="middle">SALÓN 305</text>
              </g>

              {/* Salón 306 */}
              <g
                className={`blueprint-room ${isSelected('Salón 306') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Salón 306')}
                onMouseEnter={() => setHoveredRoom('Salón 306')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="240" y="311" width="95" height="42" rx="2" />
                <text x="287" y="336" textAnchor="middle">SALÓN 306</text>
              </g>

              {/* Escalera Sur */}
              <g className="blueprint-stairs">
                <rect x="245" y="360" width="85" height="24" rx="1" fill="none" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="255" y1="360" x2="255" y2="384" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="265" y1="360" x2="265" y2="384" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="275" y1="360" x2="275" y2="384" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="285" y1="360" x2="285" y2="384" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="295" y1="360" x2="295" y2="384" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="305" y1="360" x2="305" y2="384" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="315" y1="360" x2="315" y2="384" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <text x="287" y="375" textAnchor="middle" style={{ fontSize: '7px', fill: 'var(--text-dim)' }}>ESCALERAS</text>
              </g>

              {/* Música 1 (307) */}
              <g
                className={`blueprint-room ${isSelected('Música 1 (307)') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Música 1 (307)')}
                onMouseEnter={() => setHoveredRoom('Aula de Música 1 (Salón 307)')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="240" y="392" width="95" height="68" rx="2" />
                <text x="287" y="424" textAnchor="middle">MÚSICA 1</text>
                <text x="287" y="438" textAnchor="middle" style={{ fontSize: '7.5px' }}>(307)</text>
              </g>

              {/* Música 2 (308) */}
              <g
                className={`blueprint-room ${isSelected('Música 2 (308)') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Música 2 (308)')}
                onMouseEnter={() => setHoveredRoom('Aula de Música 2 (Salón 308)')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="240" y="465" width="95" height="72" rx="2" />
                <text x="287" y="498" textAnchor="middle">MÚSICA 2</text>
                <text x="287" y="512" textAnchor="middle" style={{ fontSize: '7.5px' }}>(308)</text>
              </g>
            </g>

            {/* BLOQUE DERECHO: GRADAS COMEDOR (Graderías superiores) */}
            <g className="room-group">
              <g
                className={`blueprint-room ${isSelected('Gradas Comedor') ? 'selected' : ''}`}
                onClick={() => handleRoomClick('Gradas Comedor')}
                onMouseEnter={() => setHoveredRoom('Gradas Comedor (Graderías Superiores)')}
                onMouseLeave={() => setHoveredRoom(null)}
              >
                <rect x="590" y="45" width="280" height="150" rx="4" />
                <line x1="590" y1="140" x2="870" y2="140" stroke="var(--blueprint-wall, #334155)" strokeWidth="2" />
                <text x="730" y="100" textAnchor="middle" style={{ fontSize: '11px', fontWeight: 800 }}>
                  {lang === 'es' ? 'ZONA SUPERIOR COMEDOR' : 'UPPER DINING AREA'}
                </text>
                <text x="730" y="170" textAnchor="middle" style={{ fontSize: '10px', fontWeight: 800 }}>GRADAS COMEDOR</text>
              </g>

              {/* Escalera de bajada desde las gradas */}
              <g className="blueprint-stairs">
                <rect x="740" y="215" width="80" height="28" rx="1" fill="none" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="750" y1="215" x2="750" y2="243" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="760" y1="215" x2="760" y2="243" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="770" y1="215" x2="770" y2="243" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="780" y1="215" x2="780" y2="243" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="790" y1="215" x2="790" y2="243" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="800" y1="215" x2="800" y2="243" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <line x1="810" y1="215" x2="810" y2="243" stroke="var(--blueprint-wall, #334155)" strokeWidth="1" />
                <text x="780" y="232" textAnchor="middle" style={{ fontSize: '7.5px', fill: 'var(--text-dim)' }}>ESCALERAS</text>
              </g>
            </g>
          </svg>
        )}
      </div>
    </div>
  )
}
