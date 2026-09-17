import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { API_BASE_URL, apiRequest, clearSession, getStoredUser, setSession, uploadVideoWithProgress } from './api/client.js'
import ArchitecturalSchoolMap from './components/ArchitecturalSchoolMap.jsx'
import { translations } from './i18n.js'

// Únicamente 3 tipos de reporte permitidos para nuevos reportes
const TYPES = {
  THEFT: 'Hurto',
  FIGHT: 'Riña',
  INAPPROPRIATE_BEHAVIOR: 'Acciones inadecuadas',
}

const TYPE_LABELS = {
  ...TYPES,
  AGGRESSION: 'Riña',
  BULLYING: 'Acciones inadecuadas',
  DAMAGE: 'Acciones inadecuadas',
  ACCIDENT: 'Acciones inadecuadas',
  UNSAFE_CONDUCT: 'Acciones inadecuadas',
  OTHER: 'Acciones inadecuadas',
}

const SCHOOL_LOCATIONS = {
  'Primer piso (Patios, Zonas Comunes e Informática)': [
    'Aula Polivalente',
    'Laboratorio de Física',
    'Laboratorio de Química',
    'Sala de Artes',
    'Sala de Danzas',
    'Ágora',
    'Rectoría y Enfermería',
    'Aula de Tecnología 1',
    'Aula de Tecnología 2',
    'Aula de Tecnología 3',
    'Laboratorio de Ciencias 1',
    'Laboratorio de Ciencias 2',
    'Sala de Sistemas 1 (Informática 1)',
    'Sala de Sistemas 2 (Informática 2)',
    'Sala de Sistemas 3 (Informática 3)',
    'Auditorio Principal',
    'Patio Canchas (Punto de Encuentro)',
    'Zona Verde / Kiosco',
    'Edificio Preescolar',
  ],
  'Segundo piso': [
    'Salón 201',
    'Salón 202',
    'Salón 203',
    'Salón 204',
    'Salón 205',
    'Salón 206',
    'Salón 207',
    'Salón 208',
    'Salón 209',
    'Sala de Profesores',
    'Aula de Inglés',
    'Biblioteca Escolar',
    'Comedor Escolar',
  ],
  'Tercer piso (Salones, Música y Gradas)': [
    'Salón 301',
    'Salón 302',
    'Salón 303',
    'Salón 304',
    'Salón 305',
    'Salón 306',
    'Música 1 (307)',
    'Música 2 (308)',
    'Salón 309',
    'Salón 310',
    'Salón 311',
    'Salón 312',
    'Salón 313',
    'Salón 314',
    'Salón 315',
    'Salón 316',
    'Baños Hombres (P3)',
    'Baños Mujeres (P3)',
    'Rampa / Pasillo Conector (P3)',
    'Gradas Comedor',
  ],
}

const STATUS = {
  SUBMITTED: ['Recibido', 'warning'],
  REJECTED: ['Cerrado', 'danger'],
  AWAITING_VIDEO: ['Esperando video', 'info'],
  ANALYZING: ['Analizando', 'ai'],
  ANALYSIS_FAILED: ['Análisis fallido', 'danger'],
  REVIEW_REQUIRED: ['Revisión humana', 'warning'],
  CONFIRMED: ['Coincidencia confirmada', 'success'],
  NOT_CONCLUSIVE: ['No concluyente', 'neutral'],
}

function renderCameraOptions(cameras) {
  const p1 = cameras.filter(c => c.identifier?.startsWith('CAM-P1') || c.location?.toLowerCase().includes('patio') || c.location?.toLowerCase().includes('inform'))
  const p2 = cameras.filter(c => c.identifier?.startsWith('CAM-2') || c.location?.toLowerCase().includes('20') || c.location?.toLowerCase().includes('21'))
  const p3 = cameras.filter(c => c.identifier?.startsWith('CAM-3') || c.location?.toLowerCase().includes('30') || c.location?.toLowerCase().includes('31'))
  const others = cameras.filter(c => !p1.includes(c) && !p2.includes(c) && !p3.includes(c))

  return (
    <>
      {p1.length > 0 && (
        <optgroup label="Primer Piso (Patios, Zonas Comunes e Informática)">
          {p1.map(c => <option key={c.id} value={c.id}>{c.label} ({c.location})</option>)}
        </optgroup>
      )}
      {p2.length > 0 && (
        <optgroup label="Segundo Piso (Salones 201 - 216)">
          {p2.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </optgroup>
      )}
      {p3.length > 0 && (
        <optgroup label="Tercer Piso (Salones 301 - 316)">
          {p3.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </optgroup>
      )}
      {others.length > 0 && (
        <optgroup label="Otras Cámaras">
          {others.map(c => <option key={c.id} value={c.id}>{c.label} ({c.location})</option>)}
        </optgroup>
      )}
    </>
  )
}

function Icon({ name, size = 20 }) {
  const paths = {
    arrow: <><path d="m9 18 6-6-6-6"/><path d="M3 12h12"/></>,
    camera: <><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3z"/><circle cx="12" cy="13" r="3"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></>,
    spark: <><path d="m12 3-1.4 4.1L6.5 8.5l4.1 1.4L12 14l1.4-4.1 4.1-1.4-4.1-1.4z"/><path d="m18 14-.7 2.3L15 17l2.3.7L18 20l.7-2.3L21 17l-2.3-.7z"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    close: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
    key: <><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>,
    moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>,
    bot: <><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16h.01M16 16h.01"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    map: <><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></>,
    chart: <><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></>,
    book: <><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></>,
    video: <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    film: <><rect width="20" height="20" x="2" y="2" rx="2.18"/><line x1="7" x2="7" y1="2" y2="22"/><line x1="17" x2="17" y1="2" y2="22"/><line x1="2" x2="22" y1="12" y2="12"/><line x1="2" x2="7" y1="7" y2="7"/><line x1="2" x2="7" y1="17" y2="17"/><line x1="17" x2="22" y1="17" y2="17"/><line x1="17" x2="22" y1="7" y2="7"/></>,
    refresh: <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>,
    maximize: <><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></>,
    volume: <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></>,
    mute: <><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" x2="17" y1="9" y2="15"/><line x1="17" x2="23" y1="9" y2="15"/></>,
    trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
  }
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

function Logo({ compact = false }) {
  return (
    <button className="logo" onClick={() => navigate('home')} aria-label="Ir al inicio de NEXIA">
      <div className="logo-mark-img-wrap">
        <img src="/logo.png" alt="NEXIA Logo" className="logo-official-img" />
      </div>
      {!compact && (
        <span className="logo-word">
          <span>NEXIA</span>
          <small>GRUPO NEXUS · SEGURIDAD IA</small>
        </span>
      )}
    </button>
  )
}

let setGlobalPage = () => {}
function navigate(page, payload = null) {
  setGlobalPage({ page, payload })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

let setGlobalAuthModal = () => {}
function promptAuth(defaultTab = 'register', nextRoute = null) {
  setGlobalAuthModal({ open: true, tab: defaultTab, nextRoute })
}

let setGlobalConvivenciaModal = () => {}
function openConvivenciaModal() {
  setGlobalConvivenciaModal(true)
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function formatEta(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return 'Calculando…'
  if (seconds <= 0) return 'Completado'
  if (seconds < 60) return `${seconds} seg`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins} min ${secs < 10 ? '0' : ''}${secs} seg`
}

function UploadProgressCard({ progress }) {
  if (!progress) return null

  const { stage, percent, loaded, total, speedMBps, etaSeconds, message } = progress

  return (
    <div className="upload-progress-card">
      <div className="upload-progress-header">
        <div className="upload-progress-title">
          {stage !== 'DONE' && <div className="upload-progress-spinner" />}
          {stage === 'DONE' && <Icon name="check" size={16} />}
          <span>{message || 'Transfiriendo video…'}</span>
        </div>
        <div className="upload-progress-percentage">{percent}%</div>
      </div>

      <div className="upload-progress-track">
        <div
          className="upload-progress-fill"
          style={{
            width: `${percent}%`,
            background: stage === 'DONE' ? 'var(--accent-emerald, #10b981)' : undefined,
          }}
        />
      </div>

      <div className="upload-progress-meta">
        <div>
          {formatBytes(loaded)} de {formatBytes(total)}
        </div>
        <div className="upload-progress-stats">
          {speedMBps > 0 && (
            <span className="upload-stat-badge" title="Velocidad de subida">
              ⚡ {speedMBps} MB/s
            </span>
          )}
          {etaSeconds !== null && stage === 'UPLOADING' && (
            <span className="upload-stat-badge" title="Tiempo estimado restante">
              ⏱ {formatEta(etaSeconds)} restantes
            </span>
          )}
        </div>
      </div>

      <div className="upload-progress-hint">
        <Icon name="shield" size={13} />
        <span>
          Subida directa en alta velocidad a Amazon AWS S3. No cierres esta pestaña mientras se completa la carga.
        </span>
      </div>
    </div>
  )
}

function Badge({ status }) {
  const [label, tone] = STATUS[status] || [status, 'neutral']
  return <span className={`badge ${tone}`}><span aria-hidden="true" />{label}</span>
}

function Notice({ type = 'info', children }) {
  return <div className={`notice ${type}`} role={type === 'danger' ? 'alert' : 'status'}>{children}</div>
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button
      className="theme-toggle-btn"
      onClick={onToggle}
      title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
      aria-label="Cambiar tema visual"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
    </button>
  )
}

function Header({ user, theme, lang = 'es', onToggleTheme, onToggleLang, onLogout, onOpenAuth }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isAdmin = user && user.role === 'ADMIN'
  const t = translations[lang] || translations.es

  const handleCreateReport = () => {
    setMobileMenuOpen(false)
    if (!user) {
      promptAuth('register', 'report')
    } else {
      navigate('report')
    }
  }

  const handleNav = (target, payload = null) => {
    setMobileMenuOpen(false)
    navigate(target, payload)
  }

  const handleOpenManual = () => {
    setMobileMenuOpen(false)
    openConvivenciaModal()
  }

  return (
    <>
      <header className="header">
        <Logo />

        {/* Navegación de Escritorio */}
        <nav className="desktop-nav" aria-label="Navegación principal">
          <button className="nav-link" onClick={() => handleNav('home')}>{t.navHome}</button>
          <button className="nav-link" onClick={handleOpenManual}>
            <Icon name="book" size={16} /> {t.navHandbook}
          </button>
          <button className="nav-link" onClick={() => handleNav('track')}>{t.navTrack}</button>

          {isAdmin && (
            <button className="button ghost small" onClick={() => handleNav('admin')}>
              {t.navAdmin}
            </button>
          )}
          <button className="button primary small" onClick={handleCreateReport}>
            {t.navNewReport}
          </button>

          {/* Idioma Switcher */}
          <button
            className="lang-toggle-btn"
            onClick={onToggleLang}
            title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            aria-label="Cambiar idioma"
          >
            🌐 <span>{lang === 'es' ? 'EN' : 'ES'}</span>
          </button>

          <ThemeToggle theme={theme} onToggle={onToggleTheme} />

          {user ? (
            <div className="user-profile-menu">
              <span className="user-pill" title={`${user.email} (${user.role})`}>
                <span className="user-avatar-badge">{user.full_name?.charAt(0) || 'U'}</span>
                <div>
                  <b>{user.full_name}</b>
                  <span className="user-role-tag">{user.role === 'ADMIN' ? (lang === 'es' ? 'Directivo' : 'Admin') : user.institution_relation || (lang === 'es' ? 'Usuario' : 'User')}</span>
                </div>
              </span>
              <button className="logout-button" onClick={onLogout} title={t.navSignOut}>
                {t.navSignOut}
              </button>
            </div>
          ) : (
            <button className="button secondary small" onClick={() => onOpenAuth('login')}>
              {t.navSignIn}
            </button>
          )}
        </nav>

        {/* Controles en Móvil (solo visible en pantallas pequeñas) */}
        <div className="mobile-actions">
          <button
            className="lang-toggle-btn"
            onClick={onToggleLang}
            title={lang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            aria-label="Cambiar idioma"
          >
            🌐 {lang === 'es' ? 'EN' : 'ES'}
          </button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileMenuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M3 12h18M3 6h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Menú Desplegable Móvil fuera del <header> para no quedar atrapado en el backdrop-filter */}
      {mobileMenuOpen && (
        <div className="mobile-nav-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-nav-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <span className="mobile-drawer-title">MENÚ PRINCIPAL</span>
              <button
                className="icon-button close-button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Cerrar menú"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <button className="mobile-link" onClick={() => handleNav('home')}>
              <Icon name="home" size={18} /> <span>{t.navHome}</span>
            </button>
            <button className="mobile-link" onClick={handleOpenManual}>
              <Icon name="book" size={18} /> <span>{t.navHandbook} (PDF Ley 1620)</span>
            </button>
            <button className="mobile-link" onClick={() => handleNav('track')}>
              <Icon name="search" size={18} /> <span>{t.navTrack}</span>
            </button>

            {isAdmin && (
              <div className="mobile-admin-block">
                <div className="mobile-admin-header-label">
                  <Icon name="shield" size={14} />
                  <span>PANEL DE ADMINISTRACIÓN</span>
                </div>
                <div className="mobile-admin-sublinks">
                  <button className="mobile-link mobile-admin-link" onClick={() => handleNav('admin')}>
                    <Icon name="file" size={17} /> <span>Reportes y Casos</span>
                  </button>
                  <button className="mobile-link mobile-admin-link" onClick={() => handleNav('admin_cctv')}>
                    <Icon name="video" size={17} /> <span>CCTV Matrix Live (Demo)</span>
                  </button>
                  <button className="mobile-link mobile-admin-link" onClick={() => handleNav('admin_recordings')}>
                    <Icon name="film" size={17} /> <span>Depósito Grabaciones</span>
                  </button>
                  <button className="mobile-link mobile-admin-link" onClick={() => handleNav('admin_users')}>
                    <Icon name="users" size={17} /> <span>Usuarios y Roles</span>
                  </button>
                  <button className="mobile-link mobile-admin-link" onClick={() => handleNav('admin_appeals')}>
                    <Icon name="shield" size={17} /> <span>Apelaciones</span>
                  </button>
                  <button className="mobile-link mobile-admin-link" onClick={() => handleNav('admin_manual')}>
                    <Icon name="book" size={17} /> <span>Manual Escolar (PDF)</span>
                  </button>
                </div>
              </div>
            )}

            <button className="button primary mobile-action-btn" onClick={handleCreateReport}>
              <Icon name="plus" size={18} /> <span>{t.navNewReport}</span>
            </button>

            {user ? (
              <div className="mobile-user-box">
                <div className="mobile-user-info">
                  <span className="user-avatar-badge">{user.full_name?.charAt(0) || 'U'}</span>
                  <div>
                    <strong>{user.full_name}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{user.email} · {user.role}</div>
                  </div>
                </div>
                <button
                  className="button danger-outline"
                  style={{ width: '100%', minHeight: '40px' }}
                  onClick={() => { setMobileMenuOpen(false); onLogout() }}
                >
                  {t.navSignOut}
                </button>
              </div>
            ) : (
              <button
                className="button secondary"
                style={{ width: '100%', marginTop: '8px', minHeight: '42px' }}
                onClick={() => { setMobileMenuOpen(false); onOpenAuth('login') }}
              >
                {t.navSignIn}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/* Modal Informativo del Manual de Convivencia (Ley 1620) */
function ConvivenciaModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow" style={{ color: 'var(--accent-cyan)' }}>MANUAL INSTITUCIONAL</p>
            <h2>Ruta de Convivencia Escolar</h2>
            <small style={{ color: 'var(--text-muted)' }}>Marco normativo Ley 1620 y Decreto 1965</small>
          </div>
          <button className="icon-button close-button" onClick={onClose} aria-label="Cerrar">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <div className="kpi-card" style={{ padding: '16px' }}>
            <h4 style={{ margin: '0 0 6px', color: '#f59e0b' }}>⚠️ Faltas Tipo I (Leves)</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Conflictos cotidianos que no causan daño físico. Se resuelven mediante diálogo, mediación pedagógica y compromisos en el aula.
            </p>
          </div>

          <div className="kpi-card" style={{ padding: '16px' }}>
            <h4 style={{ margin: '0 0 6px', color: '#f43f5e' }}>🚨 Faltas Tipo II (Graves)</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Riñas, hurtos, agresiones verbales o ciberacoso sin incapacidad médica. Requieren atención inmediata, notificación a acudientes y revisión de evidencia en NEXIA.
            </p>
          </div>

          <div className="kpi-card" style={{ padding: '16px' }}>
            <h4 style={{ margin: '0 0 6px', color: '#a855f7' }}>🛑 Faltas Tipo III (Gravísimas)</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Hechos que constituyen presuntos delitos (armas, sustancias ilícitas, lesiones graves). Activación inmediata de Comité de Convivencia y autoridades competentes.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <a
              href={`${API_BASE_URL}/manual-convivencia/file`}
              target="_blank"
              rel="noopener noreferrer"
              className="button primary"
              style={{ flex: 1, textDecoration: 'none', textAlign: 'center', justifyContent: 'center' }}
            >
              <Icon name="file" size={16} /> Descargar Manual Oficial en PDF
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Componente de Mapa Interactivo del Colegio (`SchoolMap`) */
function SchoolMap({ selectedFloor, selectedLocation, onSelectLocation, interactive = true }) {
  const [activeFloor, setActiveFloor] = useState(selectedFloor || 'Primer piso (Patios, Zonas Comunes e Informática)')

  useEffect(() => {
    if (selectedFloor) setActiveFloor(selectedFloor)
  }, [selectedFloor])

  const handleFloorChange = (fl) => {
    setActiveFloor(fl)
  }

  const handleNodeClick = (loc) => {
    if (interactive && onSelectLocation) {
      onSelectLocation(activeFloor, loc)
    }
  }

  const floorKeys = Object.keys(SCHOOL_LOCATIONS)
  const currentRooms = SCHOOL_LOCATIONS[activeFloor] || []

  return (
    <div className="school-map-wrapper">
      <div className="map-toolbar">
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="map" size={18} /> Mapa Interactivo de Cámaras
          </h3>
          <small style={{ color: 'var(--text-muted)' }}>
            {interactive ? 'Haz clic en el aula o patio para seleccionar la ubicación y cámara más cercana.' : 'Visualiza la cobertura de seguridad de la institución.'}
          </small>
        </div>

        <div className="floor-selector">
          {floorKeys.map((fl, idx) => (
            <button
              key={fl}
              type="button"
              className={`floor-tab ${activeFloor === fl ? 'active' : ''}`}
              onClick={() => handleFloorChange(fl)}
            >
              {idx === 0 ? '1° Piso (Patios)' : idx === 1 ? '2° Piso (201-216)' : '3° Piso (301-316)'}
            </button>
          ))}
        </div>
      </div>

      <div className="interactive-floorplan">
        <div className="rooms-grid">
          {currentRooms.map(room => {
            const isSelected = selectedLocation === room
            return (
              <div
                key={room}
                className={`room-node ${isSelected ? 'selected' : ''}`}
                onClick={() => handleNodeClick(room)}
                title={`Cámara asignada: Cámara ${room}`}
              >
                <span className="room-name">{room}</span>
                <span className="cam-indicator">
                  <Icon name="camera" size={12} /> CAM ACTIVA
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function formatChatText(text, onAction) {
  if (!text) return ''
  return text.split('\n').map((line, idx) => {
    const trimmed = line.trim()
    if (!trimmed) return null

    // Parse action button [ACTION:target|Label]
    if (trimmed.startsWith('[ACTION:') && trimmed.endsWith(']')) {
      const inner = trimmed.slice(8, -1)
      const [target, label] = inner.split('|')
      return (
        <div key={idx} style={{ margin: '6px 0' }}>
          <button
            type="button"
            className="button primary small"
            style={{ fontSize: '0.8rem', padding: '6px 14px', borderRadius: '20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            onClick={() => onAction && onAction(target)}
          >
            {label || target}
          </button>
        </div>
      )
    }

    const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')
    const content = isBullet ? trimmed.substring(2) : line

    // Parse **bold** anywhere inside the line
    const parts = content.split(/(\*\*.*?\*\*)/g)
    const renderedParts = parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={pIdx}>{part.slice(2, -2)}</strong>
      }
      return part
    })

    if (isBullet) {
      return (
        <span key={idx} style={{ display: 'block', paddingLeft: '10px', margin: '3px 0' }}>
          • {renderedParts}
        </span>
      )
    }

    return (
      <p key={idx} style={{ margin: '4px 0' }}>
        {renderedParts}
      </p>
    )
  })
}

/* Chatbot Inteligente con Google Gemini (`NexiaChatbot`) */
function NexiaChatbot({ user, lang = 'es' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [contextMode, setContextMode] = useState(user?.role === 'ADMIN' ? 'admin' : 'user')
  const messagesEndRef = useRef(null)
  const t = translations[lang] || translations.es

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: t.chatGreeting,
    }
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [suggestions, setSuggestions] = useState(
    lang === 'es'
      ? ['¿Cómo crear un reporte?', '¿Por qué poner un rango de tiempo exacto?', '¿Mi identidad está protegida?']
      : ['How do I create a report?', 'Why is an exact time range needed?', 'Is my identity protected?']
  )

  useEffect(() => {
    if (user?.role === 'ADMIN') setContextMode('admin')
    else setContextMode('user')
  }, [user])

  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: t.chatGreeting,
      }
    ])
    setSuggestions(
      lang === 'es'
        ? (contextMode === 'admin'
            ? ['¿Cómo funciona la Matriz CCTV en Vivo (Demo)?', '¿Cómo interpretar la confianza de NEXIA?', 'Gestión de sanciones y apelaciones']
            : ['¿Cómo crear un reporte?', '¿Por qué poner un rango de tiempo exacto?', '¿Mi identidad está protegida?'])
        : (contextMode === 'admin'
            ? ['How does the CCTV Matrix Live Demo work?', 'How to interpret NEXIA confidence?', 'Sanctions & appeals management']
            : ['How do I create a report?', 'Why is an exact time range needed?', 'Is my identity protected?'])
    )
  }, [lang, contextMode, t.chatGreeting])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, busy, isOpen])

  const handleChatAction = (action) => {
    if (action === 'report') {
      if (!user) promptAuth('register', 'report')
      else navigate('report')
    } else if (action === 'track') {
      navigate('track')
    } else if (action === 'map') {
      navigate('report')
    } else if (action === 'manual') {
      openConvivenciaModal()
    }
    setIsOpen(false)
  }

  const sendMessage = async (textToSend) => {
    const text = (textToSend || input).trim()
    if (!text || busy) return

    const newHistory = [...messages, { role: 'user', content: text }]
    setMessages(newHistory)
    setInput('')
    setBusy(true)

    try {
      const res = await apiRequest('/chat/ask', {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          context_mode: contextMode,
          history: newHistory.slice(-6),
        })
      })
      setMessages([...newHistory, { role: 'assistant', content: res.reply }])
      if (res.suggested_actions && res.suggested_actions.length > 0) {
        setSuggestions(res.suggested_actions)
      }
    } catch {
      setMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: lang === 'es'
            ? 'NEXIA Copilot está operando en modo asistido de contingencia. Puedes consultar cómo radicar un reporte, salones del colegio o garantías de privacidad.'
            : 'NEXIA Copilot is operating in fallback assisted mode. You can check report procedures, classroom maps, or privacy protections.',
        }
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        className="chatbot-bubble-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Abrir asistente de IA"
        title="Asistente de Convivencia NEXIA Copilot"
      >
        <span className="chatbot-pulse" />
        <Icon name={isOpen ? 'close' : 'bot'} size={24} />
      </button>

      {isOpen && (
        <div className="chatbot-window">
          <div className="chat-header">
            <div className="chat-title-info">
              <div className="chat-avatar">
                <Icon name="bot" size={20} />
              </div>
              <div>
                <h4>NEXIA Copilot</h4>
                <small>{t.chatDisclaimer}</small>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                className="text-button"
                onClick={() => setMessages([{ role: 'assistant', content: t.chatGreeting }])}
                title={t.chatClearBtn || 'Limpiar conversación'}
                style={{ opacity: 0.7, padding: '4px' }}
              >
                <Icon name="trash" size={15} />
              </button>
              <button className="text-button" onClick={() => setIsOpen(false)} aria-label="Cerrar">
                <Icon name="close" size={16} />
              </button>
            </div>
          </div>

          {user && user.role === 'ADMIN' && (
            <div className="chat-mode-switch">
              <button
                type="button"
                className={`mode-btn ${contextMode === 'user' ? 'active' : ''}`}
                onClick={() => {
                  setContextMode('user')
                }}
              >
                {t.chatTabStudents}
              </button>
              <button
                type="button"
                className={`mode-btn ${contextMode === 'admin' ? 'active' : ''}`}
                onClick={() => {
                  setContextMode('admin')
                }}
              >
                {t.chatTabAdmin}
              </button>
            </div>
          )}

          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-bubble ${m.role}`}>
                {formatChatText(m.content, handleChatAction)}
              </div>
            ))}
            {busy && (
              <div className="chat-bubble assistant" style={{ fontStyle: 'italic', opacity: 0.7 }}>
                {lang === 'es' ? 'NEXIA Copilot está analizando y respondiendo…' : 'NEXIA Copilot is thinking…'}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-suggestions">
            {suggestions.map((s, i) => (
              <button key={i} className="chip-btn" onClick={() => sendMessage(s)}>
                {s}
              </button>
            ))}
          </div>

          <form
            className="chat-input-bar"
            onSubmit={(e) => {
              e.preventDefault()
              sendMessage()
            }}
          >
            <input
              type="text"
              placeholder={t.chatInputPlaceholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="button primary small" type="submit" disabled={busy || !input.trim()}>
              <Icon name="send" size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}

function Home({ user, lang = 'es' }) {
  const [stats, setStats] = useState(null)
  const [quickCode, setQuickCode] = useState('')
  const [showMap, setShowMap] = useState(false)
  const [mapFloor, setMapFloor] = useState('1')
  const [selectedMapRoom, setSelectedMapRoom] = useState('')
  const t = translations[lang] || translations.es

  useEffect(() => {
    apiRequest('/stats/annual')
      .then(setStats)
      .catch(() => {})
  }, [])

  const handleCreateReport = () => {
    if (!user) {
      promptAuth('register', 'report')
    } else {
      navigate('report')
    }
  }

  const handleQuickTrack = (e) => {
    e.preventDefault()
    if (!quickCode.trim()) return
    navigate('track', quickCode.trim().toUpperCase())
  }

  const breakdown = stats?.breakdown || { thefts: 14, fights: 22, inappropriate_actions: 12 }
  const totalBreakdown = breakdown.thefts + breakdown.fights + breakdown.inappropriate_actions
  const theftPct = Math.round((breakdown.thefts / totalBreakdown) * 100) || 30
  const fightPct = Math.round((breakdown.fights / totalBreakdown) * 100) || 45
  const inappPct = Math.round((breakdown.inappropriate_actions / totalBreakdown) * 100) || 25

  return (
    <div className="site">
      <main style={{ paddingBottom: '60px' }}>
        {/* App Command Hub Header */}
        <section className="app-hub-header">
          <div className="app-hub-welcome">
            <div className="hero-tag">
              <span className="live-pulse" /> {t.appHubBadge}
            </div>
            <h1>{t.appHubTitle}</h1>
            <p className="app-hub-desc">{t.appHubSubtitle}</p>
          </div>

          <div className="app-hub-telemetry">
            <div className="telemetry-pill">
              <span className="live-pulse" /> {t.telemetryStatus}
            </div>
            <div className="telemetry-chips">
              <span className="telemetry-chip">
                <Icon name="camera" size={14} /> {t.telemetryCams}
              </span>
              <span className="telemetry-chip">
                <Icon name="spark" size={14} /> {t.telemetryAI}
              </span>
              <span className="telemetry-chip">
                <Icon name="clock" size={14} /> {t.telemetryTime}
              </span>
            </div>
          </div>
        </section>

        {/* Action Grid (Interactive Web App Console Hub) */}
        <section className="app-action-grid">
          {/* Card 1: Radicar Reporte */}
          <div className="action-hub-card highlight-card">
            <div className="action-hub-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-cyan)' }}>
              <Icon name="file" size={24} />
            </div>
            <h3>{t.actionNewReportTitle}</h3>
            <p>{t.actionNewReportDesc}</p>
            <button className="button primary full-width" onClick={handleCreateReport}>
              {t.actionNewReportBtn}
            </button>
          </div>

          {/* Card 2: Rastreador Directo con Input */}
          <div className="action-hub-card">
            <div className="action-hub-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)' }}>
              <Icon name="search" size={24} />
            </div>
            <h3>{t.actionTrackTitle}</h3>
            <p>{t.actionTrackDesc}</p>
            <form onSubmit={handleQuickTrack} className="quick-track-form">
              <input
                type="text"
                placeholder={t.actionTrackPlaceholder}
                value={quickCode}
                onChange={e => setQuickCode(e.target.value)}
                className="quick-track-input"
              />
              <button type="submit" className="button secondary" disabled={!quickCode.trim()}>
                {t.actionTrackBtn}
              </button>
            </form>
          </div>

          {/* Card 3: Explorador de Pisos */}
          <div className="action-hub-card">
            <div className="action-hub-icon" style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--ai)' }}>
              <Icon name="map" size={24} />
            </div>
            <h3>{t.actionMapTitle}</h3>
            <p>{t.actionMapDesc}</p>
            <button
              className={`button ${showMap ? 'secondary' : 'primary'} full-width`}
              onClick={() => setShowMap(!showMap)}
            >
              {showMap
                ? (lang === 'es' ? 'Ocultar Explorador de Pisos' : 'Hide Floor Explorer')
                : (lang === 'es' ? 'Explorar Pisos 1, 2 y 3' : 'Explore Floors 1, 2 & 3')}
            </button>
          </div>

          {/* Card 4: Manual Escolar */}
          <div className="action-hub-card">
            <div className="action-hub-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <Icon name="book" size={24} />
            </div>
            <h3>{t.actionHandbookTitle}</h3>
            <p>{t.actionHandbookDesc}</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
              <button className="button secondary small" style={{ flex: 1 }} onClick={() => openConvivenciaModal()}>
                {t.btnViewSummary}
              </button>
              <a
                href={`${API_BASE_URL}/manual-convivencia/file`}
                target="_blank"
                rel="noopener noreferrer"
                className="button ghost small"
                style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Icon name="file" size={14} /> PDF
              </a>
            </div>
          </div>
        </section>

        {/* Embedded Floor Explorer Section (Toggled) */}
        {showMap && (
          <section className="embedded-map-console">
            <div className="console-panel-header">
              <div>
                <h3>{lang === 'es' ? 'Explorador Arquitectónico en Consola' : 'Architectural Floor Console'}</h3>
                <small style={{ color: 'var(--text-muted)' }}>
                  {lang === 'es'
                    ? 'Consulta salones y zonas cubiertas por cámaras de seguridad en Pisos 1, 2 y 3.'
                    : 'Check classrooms and camera coverage across Floors 1, 2, and 3.'}
                </small>
              </div>
              <div className="floor-pills">
                {['1', '2', '3'].map(fl => (
                  <button
                    key={fl}
                    type="button"
                    className={`floor-pill-btn ${mapFloor === fl ? 'active' : ''}`}
                    onClick={() => setMapFloor(fl)}
                  >
                    {fl === '1' ? (lang === 'es' ? 'Piso 1 (Baja)' : 'Floor 1') : fl === '2' ? (lang === 'es' ? 'Piso 2 (201-216)' : 'Floor 2') : (lang === 'es' ? 'Piso 3 (301-316)' : 'Floor 3')}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ minHeight: '380px', marginTop: '16px' }}>
              <ArchitecturalSchoolMap
                selectedFloor={mapFloor}
                selectedLocation={typeof selectedMapRoom === 'object' ? selectedMapRoom.location : selectedMapRoom}
                onSelectLocation={(loc) => setSelectedMapRoom(loc)}
                interactive={true}
              />
            </div>
            {selectedMapRoom && (
              <div style={{ marginTop: '12px', padding: '12px 14px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent-cyan)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', display: 'block' }}>
                    {lang === 'es' ? 'Espacio seleccionado en el plano:' : 'Selected space on blueprint:'}
                  </span>
                  <strong style={{ color: 'var(--accent-cyan)', fontSize: '1rem' }}>
                    {typeof selectedMapRoom === 'object' ? selectedMapRoom.location : selectedMapRoom}
                  </strong>
                  {typeof selectedMapRoom === 'object' && selectedMapRoom.floor && (
                    <small style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>({selectedMapRoom.floor})</small>
                  )}
                </div>
                <button
                  className="button primary small"
                  onClick={() => {
                    const roomName = typeof selectedMapRoom === 'object' ? selectedMapRoom.location : selectedMapRoom
                    const floorName = typeof selectedMapRoom === 'object' ? selectedMapRoom.floor : ''
                    navigate('report', { location: roomName, floor: floorName })
                  }}
                >
                  {lang === 'es' ? 'Radicar reporte en este salón →' : 'Report in this room →'}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Annual Incident Statistics Dashboard Section */}
        <section className="stats-section" style={{ marginTop: '32px' }}>
          <div className="section-title-wrap">
            <p className="section-eyebrow">{t.transparencyEyebrow}</p>
            <h2>{t.metricsTitle}</h2>
            <p>{t.metricsSubtitle}</p>
          </div>

          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon-wrap">
                <Icon name="file" size={22} />
              </div>
              <div className="kpi-value">{stats?.annual_summary?.total_incidents_recorded || 48}</div>
              <div className="kpi-label">{t.kpiTotalCases}</div>
              <div className="kpi-sub">{t.kpiTotalSub}</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                <Icon name="check" size={22} />
              </div>
              <div className="kpi-value" style={{ color: 'var(--success)' }}>{stats?.annual_summary?.resolution_rate || 94.2}%</div>
              <div className="kpi-label">{t.kpiResolutionRate}</div>
              <div className="kpi-sub">{t.kpiResolutionSub}</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrap" style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--ai)' }}>
                <Icon name="spark" size={22} />
              </div>
              <div className="kpi-value">{stats?.annual_summary?.ai_accuracy_rate || 96.4}%</div>
              <div className="kpi-label">{t.kpiAccuracy}</div>
              <div className="kpi-sub">{t.kpiAccuracySub}</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-cyan)' }}>
                <Icon name="clock" size={22} />
              </div>
              <div className="kpi-value">{stats?.annual_summary?.avg_response_minutes || 1.8} min</div>
              <div className="kpi-label">{t.kpiAvgTime}</div>
              <div className="kpi-sub">{t.kpiAvgTimeSub}</div>
            </div>
          </div>

          <div className="charts-double-grid">
            <div className="cyber-card">
              <h3>{t.incidentDistTitle}</h3>
              <p>{t.incidentDistSub}</p>

              <div className="bar-chart-row">
                <span className="bar-chart-label">{t.barFights}</span>
                <div className="bar-chart-track">
                  <div className="bar-chart-fill fights" style={{ width: `${fightPct}%` }} />
                </div>
                <span className="bar-chart-val">{breakdown.fights}</span>
              </div>

              <div className="bar-chart-row">
                <span className="bar-chart-label">{t.barThefts}</span>
                <div className="bar-chart-track">
                  <div className="bar-chart-fill thefts" style={{ width: `${theftPct}%` }} />
                </div>
                <span className="bar-chart-val">{breakdown.thefts}</span>
              </div>

              <div className="bar-chart-row">
                <span className="bar-chart-label">{t.barInapp}</span>
                <div className="bar-chart-track">
                  <div className="bar-chart-fill inappropriate" style={{ width: `${inappPct}%` }} />
                </div>
                <span className="bar-chart-val">{breakdown.inappropriate_actions}</span>
              </div>
            </div>

            <div className="cyber-card">
              <h3>{t.hotspotsTitle}</h3>
              <p>{t.hotspotsSub}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(stats?.top_hotspots || [
                  { location: 'Patio Canchas - Bicicletero', risk_level: 'Alto', recurrence: 'Viernes 11:30 - 12:00' },
                  { location: 'Salón 304 (Tercer piso)', risk_level: 'Medio', recurrence: 'Jueves 10:00 - 10:30' },
                  { location: 'Patio Banderas - Rampa', risk_level: 'Bajo', recurrence: 'Lunes 07:00 - 07:30' },
                ]).map((spot, i) => {
                  const riskLabel = spot.risk_level === 'Alto' ? t.riskHigh : spot.risk_level === 'Medio' ? t.riskMed : t.riskLow
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div>
                        <strong style={{ fontSize: '0.85rem' }}>{spot.location}</strong>
                        <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{spot.recurrence}</small>
                      </div>
                      <span className={`badge ${spot.risk_level === 'Alto' ? 'danger' : spot.risk_level === 'Medio' ? 'warning' : 'info'}`}>
                        {riskLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function AuthModal({ isOpen, onClose, defaultTab = 'register', nextRoute, onAuthSuccess }) {
  const [tab, setTab] = useState(defaultTab)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sanctionInfo, setSanctionInfo] = useState(null)
  const [appealMessage, setAppealMessage] = useState('')
  const [appealSuccess, setAppealSuccess] = useState(false)

  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [registerForm, setRegisterForm] = useState({
    full_name: '',
    institution_relation: '',
    shift: '',
    course: '',
    email: '',
    password: '',
  })

  useEffect(() => {
    setTab(defaultTab)
    setError('')
    setSanctionInfo(null)
    setAppealSuccess(false)
  }, [defaultTab, isOpen])

  if (!isOpen) return null

  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(loginForm),
      })
      onAuthSuccess(data.user, data.access_token, nextRoute)
      onClose()
    } catch (err) {
      if (err.message.includes('ACCOUNT_SANCTIONED')) {
        const [, userId, reason] = err.message.split('||')
        setSanctionInfo({ userId, reason })
      } else {
        setError(err.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const handleAppealSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiRequest('/auth/appeal', {
        method: 'POST',
        body: JSON.stringify({ user_id: sanctionInfo.userId, message: appealMessage })
      })
      setAppealSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (registerForm.institution_relation === 'Estudiante') {
        if (!registerForm.shift) {
          throw new Error('Por favor selecciona la jornada (JM o JT).')
        }
        if (!registerForm.course.trim()) {
          throw new Error('Por favor indica tu curso.')
        }
      }
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerForm),
      })
      onAuthSuccess(data.user, data.access_token, nextRoute)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow" style={{ color: 'var(--accent-cyan)' }}>ACCESO NEXIA</p>
            <h2>{sanctionInfo ? 'Cuenta Sancionada' : tab === 'login' ? 'Iniciar sesión' : 'Crear una cuenta'}</h2>
          </div>
          <button className="icon-button close-button" onClick={onClose} aria-label="Cerrar ventana">
            <Icon name="close" size={18} />
          </button>
        </div>

        {!sanctionInfo && (
          <div className="auth-tabs">
            <button
              type="button"
              className={tab === 'register' ? 'active' : ''}
              onClick={() => { setTab('register'); setError('') }}
            >
              Registrarse
            </button>
            <button
              type="button"
              className={tab === 'login' ? 'active' : ''}
              onClick={() => { setTab('login'); setError('') }}
            >
              Iniciar sesión
            </button>
          </div>
        )}

        {error && <Notice type="danger">{error}</Notice>}

        {sanctionInfo ? (
          <div>
            <Notice type="danger">
              Tu cuenta ha sido sancionada por la administración del colegio.
              <br />
              <strong>Motivo:</strong> {sanctionInfo.reason}
            </Notice>

            {appealSuccess ? (
              <Notice type="success">
                Tu apelación ha sido enviada exitosamente. Los administradores revisarán tu caso.
              </Notice>
            ) : (
              <form onSubmit={handleAppealSubmit} className="auth-form">
                <label>
                  Mensaje de Apelación
                  <textarea
                    rows="4"
                    required
                    value={appealMessage}
                    onChange={(e) => setAppealMessage(e.target.value)}
                    placeholder="Explica tus argumentos para solicitar el levantamiento de la sanción..."
                  />
                </label>
                <button className="button primary" disabled={busy}>
                  {busy ? 'Enviando apelación…' : 'Enviar Apelación a Administración'}
                </button>
              </form>
            )}
          </div>
        ) : tab === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="auth-form">
            <label>
              Correo institucional o personal
              <input
                type="email"
                required
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                placeholder="ejemplo@nexia.edu.co"
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </label>
            <button className="button primary wide" disabled={busy}>
              {busy ? 'Iniciando sesión…' : 'Ingresar'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="auth-form">
            <label>
              Nombre y apellido
              <input
                type="text"
                required
                value={registerForm.full_name}
                onChange={(e) => setRegisterForm({ ...registerForm, full_name: e.target.value })}
                placeholder="Tu nombre completo"
              />
            </label>

            <label>
              Relación con la institución
              <select
                required
                value={registerForm.institution_relation}
                onChange={(e) => setRegisterForm({ ...registerForm, institution_relation: e.target.value })}
              >
                <option value="">Selecciona tu rol</option>
                <option value="Estudiante">Estudiante</option>
                <option value="Acudiente">Acudiente / Padre de familia</option>
              </select>
            </label>

            {registerForm.institution_relation === 'Estudiante' && (
              <div className="dynamic-student-fields">
                <label>
                  Jornada
                  <select
                    required
                    value={registerForm.shift}
                    onChange={(e) => setRegisterForm({ ...registerForm, shift: e.target.value })}
                  >
                    <option value="">Selecciona</option>
                    <option value="JM">JM (Mañana)</option>
                    <option value="JT">JT (Tarde)</option>
                  </select>
                </label>
                <label>
                  Curso
                  <input
                    type="text"
                    required
                    placeholder="Ej: 1102"
                    value={registerForm.course}
                    onChange={(e) => setRegisterForm({ ...registerForm, course: e.target.value })}
                  />
                </label>
              </div>
            )}

            <label>
              Correo electrónico
              <input
                type="email"
                required
                value={registerForm.email}
                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </label>

            <label>
              Contraseña
              <input
                type="password"
                required
                minLength="6"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
              />
            </label>

            <button className="button primary wide" disabled={busy}>
              {busy ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}


function LinkedCameraCoverPreview({ camera, location, lang = 'es' }) {
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString())

  useEffect(() => {
    const t = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString())
    }, 1000)
    return () => clearInterval(t)
  }, [])

  if (!camera || !location) return null
  const hasRecording = Boolean(camera.recording_id)

  return (
    <div className="camera-cover-preview-card">
      <div className="cover-card-header">
        <div className="cover-cam-id-group">
          <span className="cover-live-dot" />
          <div>
            <div className="cover-cam-title">
              <strong>{camera.identifier}</strong> · {camera.label}
            </div>
            <small className="cover-cam-location">
              📍 {location} · {lang === 'es' ? 'Cámara de Seguridad Enlazada' : 'Linked Security Camera'}
            </small>
          </div>
        </div>
        <div className="cover-meta-badges">
          <span className="badge success">
            <span aria-hidden="true" /> {lang === 'es' ? 'Cobertura Activa' : 'Active Area Coverage'}
          </span>
          <span className="cover-tech-tag">1080p FHD · 30fps · FOV 94°</span>
        </div>
      </div>

      <div className="cover-viewport-frame">
        <div className="cover-hud-top">
          <div className="cover-hud-rec">
            <span className="hud-rec-circle" />
            <span>REC ● CCTV NEXIA</span>
          </div>
          <div className="cover-hud-time">
            <span>{currentTime} COT</span>
          </div>
        </div>

        {hasRecording ? (
          <div className="cover-video-wrapper">
            <video
              src={`${API_BASE_URL}/recordings/${camera.recording_id}/stream`}
              autoPlay
              loop
              muted
              playsInline
              className="cover-video-stream"
            />
            <div className="cover-video-overlay-reticle">
              <div className="reticle-box">
                <span className="reticle-tag">{lang === 'es' ? 'ÁREA MONITOREADA' : 'MONITORED AREA'}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="cover-simulated-viewfinder">
            <div className="viewfinder-grid-lines" />
            <div className="viewfinder-crosshair" />
            <div className="viewfinder-center-info">
              <div className="viewfinder-icon-ring">
                <Icon name="video" size={32} />
              </div>
              <h4>{lang === 'es' ? 'VISTA PREVIA DE COBERTURA CCTV' : 'CCTV COVERAGE PREVIEW'}</h4>
              <p>
                {lang === 'es'
                  ? `Señal sincronizada: ${camera.identifier} con cobertura sobre ${location}.`
                  : `Synchronized feed: ${camera.identifier} covering ${location}.`}
              </p>
              <div className="viewfinder-specs">
                <span>RTSP · STREAM: {camera.identifier}</span>
                <span>CODEC: H.265 / HEVC</span>
                <span>STATUS: ONLINE ●</span>
              </div>
            </div>
          </div>
        )}

        <div className="cover-hud-bottom">
          <div className="cover-hud-brand">
            <img src="/logo.png" alt="NEXIA" className="cover-watermark-logo" />
            <span>NEXIA VISION MATRIX · GRUPO NEXUS</span>
          </div>
          <div className="cover-hud-coords">
            <span>CAM_ZOOM: 1.0X</span>
            <span>SEC_LEVEL: HIGH</span>
          </div>
        </div>
      </div>

      <div className="cover-card-footer">
        <div className="cover-guarantee-icon">
          <Icon name="shield" size={20} />
        </div>
        <div className="cover-guarantee-text">
          <strong>
            {lang === 'es'
              ? 'Garantía de Respaldo Objetivo y Protección de Identidad:'
              : 'Objective Evidence Guarantee & Identity Protection:'}
          </strong>
          <p>
            {lang === 'es'
              ? 'Al radicar tu reporte, el motor de IA NEXIA analizará automáticamente este ángulo de cámara en el rango horario indicado para contrastar los hechos. Tu identidad permanecerá en estricta reserva institucional sin reconocimiento facial invasivo (Ley 1620 de 2013).'
              : 'Upon submission, NEXIA AI automatically correlates this camera angle during the reported time window to objectively verify facts. Your identity remains strictly confidential under student protection laws.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function ReportForm({ user, lang = 'es', initialData = null }) {
  const t = translations[lang] || translations.es
  const [form, setForm] = useState({
    incident_type: '',
    incident_date: '',
    approximate_time_start: '',
    approximate_time_end: '',
    location: initialData?.location || '',
    description: '',
  })
  const [selectedFloor, setSelectedFloor] = useState(initialData?.floor || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [cameraCatalog, setCameraCatalog] = useState([])

  useEffect(() => {
    apiRequest('/cameras/public-catalog')
      .then(cams => { if (Array.isArray(cams)) setCameraCatalog(cams) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (initialData?.location) {
      setForm(f => ({ ...f, location: initialData.location }))
    }
    if (initialData?.floor) {
      setSelectedFloor(initialData.floor)
    }
  }, [initialData])

  const linkedCamera = useMemo(() => {
    if (!form.location) return null
    const locLower = form.location.toLowerCase()
    let found = cameraCatalog.find(c => c.location && c.location.toLowerCase() === locLower)
    if (found) return found

    const numMatch = form.location.match(/\b(2\d\d|3\d\d)\b/)
    if (numMatch) {
      const num = numMatch[1]
      found = cameraCatalog.find(c => c.identifier === `CAM-${num}`)
      if (found) return found
      return {
        id: `cam-${num}`,
        identifier: `CAM-${num}`,
        label: `Cámara Salón ${num}`,
        location: form.location,
        recording_id: num === '304' ? '29cfd596fbc04d3d9af0c4125bfc9660' : (num === '204' ? 'rec_b9b6427497ea4e4a91d83a78fb0cf19e' : (num === '303' ? 'rec_1993b7b895c04b8a9949abd964545f68' : null))
      }
    }

    if (locLower.includes('patio') || locLower.includes('cancha') || locLower.includes('bicicletero')) {
      found = cameraCatalog.find(c => c.identifier && (c.identifier.includes('BICIS') || c.identifier.includes('P1')))
      if (found) return found
      return {
        id: 'cam-p1-bicis',
        identifier: 'CAM-P1-BICIS',
        label: 'Cámara Patio Canchas - Bicicletero',
        location: 'Patio Canchas',
        recording_id: 'rec_1f3f6f89874847c6b131804217f2dffc'
      }
    }
    if (locLower.includes('informatica') || locLower.includes('sistema')) {
      found = cameraCatalog.find(c => c.identifier && c.identifier.includes('INFO1'))
      if (found) return found
      return {
        id: 'cam-p1-info1',
        identifier: 'CAM-P1-INFO1',
        label: 'Cámara Informática 1',
        location: 'Informática 1',
        recording_id: '1cd62717c9264fa1825306ed04d6c993'
      }
    }

    return {
      id: 'cam-general',
      identifier: 'CAM-COBERTURA-ZONA',
      label: `Cámara de Zona (${form.location})`,
      location: form.location,
      recording_id: null
    }
  }, [form.location, cameraCatalog])

  const update = ({ target }) => setForm(value => ({ ...value, [target.name]: target.value }))

  const handleFloorChange = (e) => {
    const floor = e.target.value
    setSelectedFloor(floor)
    setForm(f => ({ ...f, location: '' }))
  }

  const handleMapSelect = ({ floor, location }) => {
    setSelectedFloor(floor)
    setForm(f => ({ ...f, location }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (form.approximate_time_end <= form.approximate_time_start) {
        throw new Error(lang === 'es' ? 'La hora de fin debe ser mayor a la hora de inicio.' : 'End time must be after start time.')
      }
      
      const payload = {
        ...form,
        reporter_name: user?.full_name || 'Anónimo',
      }
      const response = await apiRequest('/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setCreated(response)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const typeOptions = {
    THEFT: t.typeTheft,
    FIGHT: t.typeFight,
    INAPPROPRIATE_BEHAVIOR: t.typeMisconduct,
  }

  return (
    <div className="form-shell">
      <button className="text-button" onClick={() => navigate('home')}>{t.btnBackHome}</button>

      {created ? (
        <div className="form-card" style={{ textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'grid', placeItems: 'center', margin: '0 auto 20px' }}>
            <Icon name="check" size={36} />
          </div>
          <h1>{t.reportSuccessTitle}</h1>
          <p className="subtitle">
            {t.reportSuccessSubtitle}
          </p>

          <div style={{ background: 'var(--bg-main)', border: '1px dashed var(--border-strong)', padding: '20px', borderRadius: 'var(--radius)', margin: '24px 0' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t.privateTrackingCode}</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'monospace', color: 'var(--accent-cyan)', letterSpacing: '0.08em', marginTop: '6px' }}>
              {created.public_code}
            </div>
          </div>

          <div className="actions centered">
            <button className="button primary" onClick={() => navigate('track', created.public_code)}>
              {t.btnCheckStatusNow}
            </button>
            <button className="button secondary" onClick={() => { setCreated(null); setForm({ incident_type: '', incident_date: '', approximate_time_start: '', approximate_time_end: '', location: '', description: '' }); setSelectedFloor('') }}>
              {t.btnNewReportAgain}
            </button>
          </div>
        </div>
      ) : (
        <div className="form-card">
          <h1>{t.formTitle}</h1>
          <p className="subtitle">
            {t.formSubtitle}
          </p>

          {user && (
            <div className="authenticated-reporter-banner">
              <Icon name="shield" size={24} />
              <div>
                <strong>{t.authenticatedReporter} {user.full_name}</strong>
                <span className="reporter-meta"> ({user.institution_relation}{user.course ? ` · ${user.course}` : ''})</span>
              </div>
            </div>
          )}

          {error && <Notice type="danger">{error}</Notice>}

          <form onSubmit={submit} className="form-grid">
            <label className="full">
              {t.fieldIncidentType}
              <select name="incident_type" value={form.incident_type} onChange={update} required>
                <option value="">{t.selectTypePlaceholder}</option>
                {Object.entries(typeOptions).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>

            <label className="full">
              {t.fieldDate}
              <input
                type="date"
                name="incident_date"
                value={form.incident_date}
                onChange={update}
                required
              />
            </label>

            <div className="time-range-group">
              <label>
                {t.fieldTimeStart}
                <input
                  type="time"
                  name="approximate_time_start"
                  value={form.approximate_time_start}
                  onChange={update}
                  required
                />
              </label>
              <label>
                {t.fieldTimeEnd}
                <input
                  type="time"
                  name="approximate_time_end"
                  value={form.approximate_time_end}
                  onChange={update}
                  required
                />
              </label>
            </div>

            <div className="full">
              <ArchitecturalSchoolMap
                selectedLocation={form.location}
                onSelectLocation={handleMapSelect}
                lang={lang}
              />
            </div>

            <label>
              {t.fieldFloor}
              <select value={selectedFloor} onChange={handleFloorChange} required>
                <option value="">{t.selectFloorPlaceholder}</option>
                {Object.keys(SCHOOL_LOCATIONS).map(fl => (
                  <option key={fl} value={fl}>{fl}</option>
                ))}
              </select>
            </label>

            <label>
              {t.fieldLocation}
              <select
                name="location"
                value={form.location}
                onChange={update}
                disabled={!selectedFloor}
                required
              >
                <option value="">
                  {selectedFloor ? t.selectLocationPlaceholder : t.selectFloorFirstHint}
                </option>
                {selectedFloor && SCHOOL_LOCATIONS[selectedFloor]?.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </label>

            {/* Portada de Cámara Enlazada con Vista Previa de Cobertura */}
            {form.location && (
              <div className="full">
                <LinkedCameraCoverPreview
                  camera={linkedCamera}
                  location={form.location}
                  lang={lang}
                />
              </div>
            )}

            <label className="full">
              {t.fieldDescription}
              <textarea
                name="description"
                value={form.description}
                onChange={update}
                minLength="20"
                maxLength="2000"
                rows="5"
                placeholder={t.fieldDescriptionPlaceholder}
                required
              />
            </label>

            <div className="actions full" style={{ marginTop: '12px' }}>
              <button className="button primary" disabled={busy}>
                {busy ? (lang === 'es' ? 'Registrando reporte…' : 'Submitting report…') : t.btnSubmitReport}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function TrackCase({ initialCode }) {
  const [code, setCode] = useState(initialCode || '')
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const search = async (e) => {
    if (e) e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    setError('')
    try {
      const data = await apiRequest(`/reports/track/${code.trim()}`)
      setReport(data)
    } catch (err) {
      setError(err.message)
      setReport(null)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (initialCode) search()
  }, [initialCode]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="track-shell">
      <button className="text-button" onClick={() => navigate('home')}>← Volver al inicio</button>

      <div className="track-card">
        <h1>Consultar estado de caso</h1>
        <p className="subtitle">Ingresa tu código privado `NEX-XXXXXXXX` para ver el progreso de tu reporte.</p>

        <form onSubmit={search} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <input
            type="text"
            placeholder="Ej: NEX-8K4P2M7Q"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            required
            style={{ flex: 1, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}
          />
          <button className="button primary" disabled={busy}>
            {busy ? 'Buscando…' : 'Consultar'}
          </button>
        </form>

        {error && <Notice type="danger">{error}</Notice>}

        {report && (
          <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px', marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CÓDIGO DE CASO</span>
                <h2 style={{ margin: 0, fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>{report.public_code}</h2>
              </div>
              <Badge status={report.status} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <small style={{ color: 'var(--text-muted)' }}>Tipo de incidente</small>
                <div><strong>{TYPE_LABELS[report.incident_type] || report.incident_type}</strong></div>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)' }}>Fecha del suceso</small>
                <div><strong>{report.incident_date}</strong></div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Actualización oficial:</small>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                {report.public_summary || 'Tu reporte está siendo revisado por la coordinación.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AdminLayout({ children, active = 'reports', user }) {
  if (!user || user.role !== 'ADMIN') {
    return (
      <div className="site">
        <Header user={user} />
        <main className="content" style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto' }}>
          <Notice type="danger">
            Acceso restringido: Solo cuentas con rol de administrador pueden acceder a este panel.
          </Notice>
          <div className="actions centered">
            <button className="button primary" onClick={() => navigate('home')}>
              Volver al inicio
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className={`admin-shell ${active === 'cctv' ? 'cctv-viewport-shell' : ''}`}>
      <aside className="sidebar">
        <Logo />
        <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 700, letterSpacing: '0.08em' }}>
          CENTRO DE OPERACIONES
        </div>
        <nav>
          <button
            className={active === 'dashboard' || active === 'reports' ? 'active' : ''}
            onClick={() => navigate('admin')}
          >
            <Icon name="file" /> Reportes y Casos
          </button>
          <button
            className={active === 'cctv' ? 'active' : ''}
            onClick={() => navigate('admin_cctv')}
          >
            <Icon name="video" /> CCTV Matrix Live (Demo)
          </button>
          <button
            className={active === 'recordings' ? 'active' : ''}
            onClick={() => navigate('admin_recordings')}
          >
            <Icon name="film" /> Depósito Grabaciones
          </button>
          <button
            className={active === 'users' ? 'active' : ''}
            onClick={() => navigate('admin_users')}
          >
            <Icon name="users" /> Usuarios
          </button>
          <button
            className={active === 'appeals' ? 'active' : ''}
            onClick={() => navigate('admin_appeals')}
          >
            <Icon name="shield" /> Apelaciones
          </button>
          <button
            className={active === 'manual' ? 'active' : ''}
            onClick={() => navigate('admin_manual')}
          >
            <Icon name="book" /> Manual Escolar
          </button>
        </nav>
      </aside>

      <div className={`admin-main ${active === 'cctv' ? 'cctv-main-mode' : ''}`}>
        <header className="header admin-top-header" style={{ height: '64px', borderBottom: '1px solid var(--border)' }}>
          <div className="admin-header-user">
            <small style={{ color: 'var(--text-muted)' }}>Sesión de Auditoría Activa</small>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{user.full_name} ({user.email})</div>
          </div>
          <button className="button ghost small admin-exit-btn" onClick={() => navigate('home')}>
            ← Sitio público
          </button>
        </header>

        {/* Barra de pestañas horizontal táctil para celular */}
        <nav className="admin-mobile-tabs" aria-label="Navegación móvil del panel">
          <button
            className={active === 'dashboard' || active === 'reports' ? 'active' : ''}
            onClick={() => navigate('admin')}
          >
            <Icon name="file" size={15} /> <span>Casos</span>
          </button>
          <button
            className={active === 'cctv' ? 'active' : ''}
            onClick={() => navigate('admin_cctv')}
          >
            <Icon name="video" size={15} /> <span>CCTV</span>
          </button>
          <button
            className={active === 'recordings' ? 'active' : ''}
            onClick={() => navigate('admin_recordings')}
          >
            <Icon name="film" size={15} /> <span>Grabaciones</span>
          </button>
          <button
            className={active === 'users' ? 'active' : ''}
            onClick={() => navigate('admin_users')}
          >
            <Icon name="users" size={15} /> <span>Usuarios</span>
          </button>
          <button
            className={active === 'appeals' ? 'active' : ''}
            onClick={() => navigate('admin_appeals')}
          >
            <Icon name="shield" size={15} /> <span>Apelaciones</span>
          </button>
          <button
            className={active === 'manual' ? 'active' : ''}
            onClick={() => navigate('admin_manual')}
          >
            <Icon name="book" size={15} /> <span>Manual</span>
          </button>
        </nav>

        {children}
      </div>
    </div>
  )
}

function AdminManual({ user }) {
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const res = await apiRequest('/manual-convivencia/info')
      setInfo(res)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { load() }, [])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('El archivo seleccionado debe ser un documento PDF.')
      return
    }
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiRequest('/admin/manual-convivencia', {
        method: 'POST',
        body: formData,
      })
      setMsg(res.message || 'Manual de Convivencia actualizado exitosamente.')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminLayout active="manual" user={user}>
      <main className="admin-content">
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Gestión del Manual de Convivencia</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
            Carga y actualiza el documento PDF oficial (Ley 1620 y Decreto 1965) para consulta pública de toda la institución.
          </p>
        </div>

        {msg && <Notice type="success">{msg}</Notice>}
        {error && <Notice type="danger">{error}</Notice>}

        <div className="admin-card" style={{ maxWidth: '680px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.12)', color: 'var(--accent-cyan)', display: 'grid', placeItems: 'center' }}>
              <Icon name="file" size={28} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                {info?.exists ? info.filename : 'Sin archivo PDF configurado'}
              </h3>
              <small style={{ color: 'var(--text-muted)' }}>
                {info?.exists ? `Última actualización: ${info.updated_at} · Tamaño: ${info.size_kb} KB` : 'Aún no se ha subido un Manual de Convivencia'}
              </small>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
            <label className="button primary" style={{ cursor: 'pointer' }}>
              <Icon name="upload" size={16} />
              {busy ? 'Subiendo PDF…' : 'Subir nuevo PDF oficial'}
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={handleUpload}
                disabled={busy}
                style={{ display: 'none' }}
              />
            </label>

            {info?.exists && (
              <a
                href={`${API_BASE_URL}/manual-convivencia/file`}
                target="_blank"
                rel="noopener noreferrer"
                className="button secondary"
                style={{ textDecoration: 'none' }}
              >
                <Icon name="search" size={16} /> Ver / Descargar PDF vigente
              </a>
            )}
          </div>
        </div>
      </main>
    </AdminLayout>
  )
}

/* =========================================================================
   NEXIA Vision Matrix — CCTV en Tiempo Real (Demo)
   ========================================================================= */
function AdminLiveCCTV({ user, lang = 'es' }) {
  const [cameras, setCameras] = useState([])
  const [recordings, setRecordings] = useState([])
  const [selectedCam, setSelectedCam] = useState(null)
  const [selectedRec, setSelectedRec] = useState(null)
  const [floorFilter, setFloorFilter] = useState('ALL') // 'ALL', '1', '2', '3'
  const [viewMode, setViewMode] = useState('spotlight') // 'spotlight', 'grid2', 'grid3'
  const [aiOverlay, setAiOverlay] = useState(true)
  const [isMuted, setIsMuted] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString())
  const [_busy, setBusy] = useState(true)
  const [uploadModal, setUploadModal] = useState(false)
  const [isTheater, setIsTheater] = useState(false)
  const [uploadForm, setUploadForm] = useState({ camera_id: '', duration_seconds: '960' })
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [uploadMsg, setUploadMsg] = useState('')
  const t = translations[lang] || translations.es

  const loadData = useCallback(async () => {
    setBusy(true)
    try {
      const [cams, recs] = await Promise.all([
        apiRequest('/admin/cameras'),
        apiRequest('/admin/recordings'),
      ])
      setCameras(cams)
      setRecordings(recs)

      if (cams.length > 0) {
        // Prefer a camera with an uploaded recording
        const camWithRec = cams.find(c => recs.some(r => r.camera_id === c.id))
        const defCam = camWithRec || cams[0]
        setSelectedCam(defCam)
        const matchRec = recs.find(r => r.camera_id === defCam.id)
        setSelectedRec(matchRec || null)
      }
    } catch (err) {
      console.error("Error loading CCTV data", err)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const handleSelectCam = (cam) => {
    setSelectedCam(cam)
    const rec = recordings.find(r => r.camera_id === cam.id)
    setSelectedRec(rec || null)
    setUploadForm(f => ({ ...f, camera_id: cam.id }))
  }

  const filteredCameras = useMemo(() => {
    if (floorFilter === '1') {
      return cameras.filter(c => c.identifier.startsWith('CAM-P1'))
    }
    if (floorFilter === '2') {
      return cameras.filter(c => c.identifier.startsWith('CAM-2'))
    }
    if (floorFilter === '3') {
      return cameras.filter(c => c.identifier.startsWith('CAM-3'))
    }
    return cameras
  }, [cameras, floorFilter])

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!uploadFile) return
    setUploading(true)
    setUploadMsg('')
    setUploadProgress({
      stage: 'PREPARING',
      percent: 0,
      loaded: 0,
      total: uploadFile.size,
      speedMBps: 0,
      etaSeconds: null,
      message: 'Iniciando transferencia…',
    })
    try {
      const saved = await uploadVideoWithProgress({
        file: uploadFile,
        prepareUrl: '/admin/recordings/presigned-url',
        completeUrl: '/admin/recordings/complete-upload',
        metadata: {
          camera_id: uploadForm.camera_id,
          recording_started_at: new Date().toISOString().slice(0, 16),
          duration_seconds: parseInt(uploadForm.duration_seconds, 10) || 60,
        },
        fallbackUrl: '/admin/recordings',
        onProgress: prog => setUploadProgress(prog),
      })
      await loadData()
      if (saved) {
        setSelectedRec(saved)
        const targetCam = cameras.find(c => c.id === saved.camera_id)
        if (targetCam) setSelectedCam(targetCam)
      }
      setTimeout(() => {
        setUploadModal(false)
        setUploadFile(null)
        setUploadProgress(null)
        setUploadMsg(lang === 'es' ? 'Video sincronizado exitosamente.' : 'Video synced successfully.')
      }, 1500)
    } catch (err) {
      setUploadMsg(`Error: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const activeRec = selectedRec || (selectedCam ? recordings.find(r => r.camera_id === selectedCam.id) : null)

  return (
    <AdminLayout active="cctv" user={user}>
      <main className={`admin-content cctv-admin-viewport ${isTheater ? 'cctv-theater-active' : ''}`} style={{ maxWidth: '1600px' }}>
        {/* CCTV Command Header */}
        <div className="cctv-header-banner">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="live-badge">
                <span className="live-pulse" /> {t.cctvLiveIndicator}
              </span>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{t.cctvTitle}</h1>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {t.cctvSubtitle}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div className="cctv-clock-badge">
              <Icon name="clock" size={14} />
              <span>{currentTime} COT</span>
              <small style={{ color: 'var(--accent-cyan)', marginLeft: '4px' }}>RTSP/H.265</small>
            </div>
            <button
              className="button secondary small"
              onClick={() => setUploadModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="upload" size={14} /> {t.cctvUploadShortcut}
            </button>
          </div>
        </div>

        {uploadMsg && <Notice type="info">{uploadMsg}</Notice>}

        {/* CCTV Controls Bar */}
        <div className="cctv-controls-bar">
          {/* Floor filter tabs */}
          <div className="cctv-pills">
            {[
              { key: 'ALL', label: t.cctvAllFloors },
              { key: '1', label: t.cctvFloor1 },
              { key: '2', label: t.cctvFloor2 },
              { key: '3', label: t.cctvFloor3 },
            ].map(f => (
              <button
                key={f.key}
                className={`cctv-pill-btn ${floorFilter === f.key ? 'active' : ''}`}
                onClick={() => setFloorFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* View mode toggle & AI HUD Toggle */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className={`cctv-view-btn ${viewMode === 'spotlight' ? 'active' : ''}`}
              onClick={() => setViewMode('spotlight')}
              title={t.cctvModeSpotlight}
            >
              <Icon name="video" size={15} /> {t.cctvModeSpotlight}
            </button>
            <button
              className={`cctv-view-btn ${viewMode === 'grid2' ? 'active' : ''}`}
              onClick={() => setViewMode('grid2')}
              title={t.cctvModeGrid2x2}
            >
              <Icon name="grid" size={15} /> 2x2
            </button>
            <button
              className={`cctv-view-btn ${viewMode === 'grid3' ? 'active' : ''}`}
              onClick={() => setViewMode('grid3')}
              title={t.cctvModeGrid3x3}
            >
              <Icon name="grid" size={15} /> 3x3
            </button>
            <button
              className={`cctv-view-btn ${isTheater ? 'active' : ''}`}
              onClick={() => setIsTheater(!isTheater)}
              title={isTheater ? "Salir de Modo Pantalla Completa" : "Modo Centro de Control Completo"}
            >
              <Icon name="maximize" size={15} /> {isTheater ? "Normal" : "Fullscreen"}
            </button>
            <button
              className={`cctv-ai-btn ${aiOverlay ? 'active' : ''}`}
              onClick={() => setAiOverlay(!aiOverlay)}
              title="Activar/desactivar HUD de detección con IA"
            >
              <Icon name="spark" size={14} /> {aiOverlay ? 'NEXIA HUD: Activo' : 'NEXIA HUD: Inactivo'}
            </button>
          </div>
        </div>

        {/* MAIN VIEWPORT AREA */}
        {viewMode === 'spotlight' ? (
          <div className="cctv-spotlight-layout">
            {/* Central Monitor Frame */}
            <div className="cctv-monitor-wrapper">
              <div className="cctv-screen-frame">
                {/* HUD Top Bar */}
                <div className="cctv-screen-hud-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="hud-rec-dot" />
                    <strong>REC ● LIVE</strong>
                    <span className="hud-cam-id">{selectedCam?.identifier || 'CAM-LIVE'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="hud-room-name">{selectedCam?.label || 'Cámara Escolar'}</span>
                    <span className="hud-res-tag">1080p · 30fps</span>
                  </div>
                </div>

                {/* Video Player or Simulated Viewport */}
                <div className="cctv-video-container">
                  {activeRec ? (
                    <video
                      key={activeRec.id}
                      src={`${API_BASE_URL}/recordings/${activeRec.id}/stream`}
                      autoPlay
                      loop
                      muted={isMuted}
                      playsInline
                      controls
                      className="cctv-video-stream"
                    />
                  ) : (
                    <div className="cctv-simulated-feed">
                      <div className="cctv-scanline-fx" />
                      <div className="cctv-noise-overlay" />
                      <div className="cctv-crosshair" />
                      <div className="cctv-simulated-center">
                        <Icon name="video" size={48} />
                        <h4>{selectedCam?.label || 'Señal de Cámara en Vivo'}</h4>
                        <p>{t.cctvNoVideoWarning}</p>
                        <button className="button primary small" onClick={() => setUploadModal(true)}>
                          {t.cctvUploadShortcut}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* NEXIA Tactical HUD Overlay */}
                  {aiOverlay && (
                    <div className="cctv-tactical-hud-overlay">
                      <div className="hud-corner top-left" />
                      <div className="hud-corner top-right" />
                      <div className="hud-corner bottom-left" />
                      <div className="hud-corner bottom-right" />
                      <div className="hud-laser-sweep" />
                      <div className="hud-telemetry-badge">
                        <span className="telemetry-live-dot" />
                        <span>NEXIA VISION MATRIX · 1080P 30FPS · AUDITORÍA EN TIEMPO REAL</span>
                      </div>
                      <div className="ai-status-ticker">
                        <span>● MOTOR NEXIA: SUPERVISIÓN PREVENTIVA LEY 1620 · SIN ALERTAS CRÍTICAS DETECTADAS</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* HUD Bottom Bar */}
                <div className="cctv-screen-hud-bottom">
                  <div>
                    <small style={{ color: 'var(--text-muted)' }}>Ubicación:</small>{' '}
                    <strong>{selectedCam?.location || 'Área Escolar'}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                      className="text-button"
                      onClick={() => setIsMuted(!isMuted)}
                      style={{ color: '#fff', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Icon name={isMuted ? 'mute' : 'volume'} size={16} />
                      {isMuted ? 'Silenciado' : 'Sonido'}
                    </button>
                    {activeRec && (
                      <span className="badge success" style={{ fontSize: '0.72rem' }}>
                        Archivo: {activeRec.original_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar Mosaic / Channel Selector */}
            <aside className="cctv-mosaic-sidebar">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                  Canales ({filteredCameras.length})
                </h3>
                <small style={{ color: 'var(--accent-cyan)' }}>
                  {recordings.length} con grabación
                </small>
              </div>

              <div className="cctv-camera-cards-list">
                {filteredCameras.map(c => {
                  const hasRec = recordings.some(r => r.camera_id === c.id)
                  const isSelected = selectedCam?.id === c.id
                  return (
                    <div
                      key={c.id}
                      className={`cctv-card-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectCam(c)}
                    >
                      <div className="cctv-card-thumb">
                        <span className={`cctv-dot ${hasRec ? 'has-video' : 'live'}`} />
                        <span className="thumb-cam-id">{c.identifier}</span>
                        {hasRec && <span className="video-badge">REC</span>}
                      </div>
                      <div className="cctv-card-info">
                        <strong>{c.label}</strong>
                        <small>{c.location}</small>
                      </div>
                    </div>
                  )
                })}
              </div>
            </aside>
          </div>
        ) : (
          /* Multi-Monitor Grid Layout (2x2 or 3x3) */
          <div className={`cctv-multigrid ${viewMode}`}>
            {filteredCameras.slice(0, viewMode === 'grid2' ? 4 : 9).map(cam => {
              const camRec = recordings.find(r => r.camera_id === cam.id)
              return (
                <div key={cam.id} className="cctv-grid-cell" onClick={() => { setSelectedCam(cam); setViewMode('spotlight'); }}>
                  <div className="grid-cell-hud">
                    <span>REC ● {cam.identifier}</span>
                    <small>{cam.label}</small>
                  </div>
                  {camRec ? (
                    <video
                      src={`${API_BASE_URL}/recordings/${camRec.id}/stream`}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="grid-cell-video"
                    />
                  ) : (
                    <div className="grid-cell-simulated">
                      <Icon name="video" size={28} />
                      <small>{cam.label}</small>
                    </div>
                  )}
                  {aiOverlay && (
                    <div className="grid-ai-hud-tag">
                      <span>● NEXIA VISION ON</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Modal para subir grabación a cámara */}
        {uploadModal && (
          <div className="modal-overlay" onClick={() => setUploadModal(false)}>
            <div className="modal-dialog" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div className="modal-header">
                <h3>{t.cctvUploadShortcut}</h3>
                <button className="text-button" onClick={() => setUploadModal(false)}>
                  <Icon name="close" size={18} />
                </button>
              </div>

              <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
                <label>
                  Cámara Escolar Asignada
                  <select
                    value={uploadForm.camera_id}
                    onChange={e => setUploadForm({ ...uploadForm, camera_id: e.target.value })}
                    required
                  >
                    <option value="">Selecciona una cámara</option>
                    {renderCameraOptions(cameras)}
                  </select>
                </label>

                <label>
                  Duración aproximada (segundos)
                  <input
                    type="number"
                    min="1"
                    max="7200"
                    value={uploadForm.duration_seconds}
                    onChange={e => setUploadForm({ ...uploadForm, duration_seconds: e.target.value })}
                    required
                  />
                  <small style={{ color: 'var(--text-muted)' }}>
                    {Math.floor(Number(uploadForm.duration_seconds || 0) / 60)} min {Number(uploadForm.duration_seconds || 0) % 60} seg
                  </small>
                </label>

                <label>
                  Archivo de video (MP4 o MOV)
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime"
                    onChange={e => setUploadFile(e.target.files[0])}
                    disabled={uploading}
                    required
                  />
                </label>

                <UploadProgressCard progress={uploadProgress} />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                  <button type="button" className="button ghost" onClick={() => setUploadModal(false)} disabled={uploading}>
                    Cancelar
                  </button>
                  <button type="submit" className="button primary" disabled={uploading || !uploadFile}>
                    {uploading ? 'Transfiriendo video…' : 'Vincular y Reproducir'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  )
}

function AdminDashboard({ user }) {
  const [reports, setReports] = useState([])
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const query = filter ? `?status=${filter}` : ''
      setReports(await apiRequest(`/admin/reports${query}`))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  return (
    <AdminLayout active="reports" user={user}>
      <main className="admin-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Bandeja de Casos Escolares</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>Revisa, aprueba y ejecuta auditorías automáticas con IA.</p>
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ width: '220px' }}
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS).map(([key, [label]]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {error && <Notice type="danger">{error}</Notice>}

        <div className="admin-card">
          {busy ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando reportes…</div>
          ) : reports.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>No hay reportes en esta vista.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Tipo</th>
                    <th>Fecha y Rango</th>
                    <th>Ubicación</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id}>
                      <td><b style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>{r.public_code}</b></td>
                      <td>{TYPE_LABELS[r.incident_type] || r.incident_type}</td>
                      <td>
                        {r.incident_date}
                        <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                          {r.approximate_time_start?.slice(0, 5)} - {r.approximate_time_end?.slice(0, 5)}
                        </small>
                      </td>
                      <td>{r.location}</td>
                      <td><Badge status={r.status} /></td>
                      <td>
                        <button className="button primary small" onClick={() => navigate('detail', r.id)}>
                          Revisar caso
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </AdminLayout>
  )
}

function AdminRecordings({ user }) {
  const [recordings, setRecordings] = useState([])
  const [cameras, setCameras] = useState([])
  const [busy, setBusy] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    camera_id: '',
    recording_started_at: '',
    duration_seconds: '960',
  })
  const [file, setFile] = useState(null)
  const [editModal, setEditModal] = useState(false)
  const [editingRec, setEditingRec] = useState(null)
  const [editForm, setEditForm] = useState({
    camera_id: '',
    original_name: '',
    recording_started_at: '',
    duration_seconds: '960',
  })
  const [editingBusy, setEditingBusy] = useState(false)

  const openEditModal = (rec) => {
    setEditingRec(rec)
    const d = new Date(rec.recording_started_at)
    const pad = n => String(n).padStart(2, '0')
    const dtLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    setEditForm({
      camera_id: rec.camera_id,
      original_name: rec.original_name || '',
      recording_started_at: dtLocal,
      duration_seconds: String(rec.duration_seconds || 60),
    })
    setEditModal(true)
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingRec) return
    setEditingBusy(true)
    try {
      await apiRequest(`/admin/recordings/${editingRec.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          camera_id: editForm.camera_id,
          original_name: editForm.original_name,
          recording_started_at: editForm.recording_started_at ? new Date(editForm.recording_started_at).toISOString() : undefined,
          duration_seconds: parseInt(editForm.duration_seconds, 10) || undefined,
        }),
      })
      setSuccess('Grabación actualizada exitosamente.')
      setEditModal(false)
      setEditingRec(null)
      await load()
    } catch (err) {
      alert(`Error al actualizar grabación: ${err.message}`)
    } finally {
      setEditingBusy(false)
    }
  }

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const [recs, cams] = await Promise.all([
        apiRequest('/admin/recordings'),
        apiRequest('/admin/cameras'),
      ])
      setRecordings(recs)
      setCameras(cams)
      if (cams.length > 0 && !form.camera_id) {
        setForm(f => ({ ...f, camera_id: cams[0].id }))
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Por favor selecciona un archivo de video (MP4 o MOV).')
      return
    }
    setUploading(true)
    setError('')
    setSuccess('')
    setUploadProgress({
      stage: 'PREPARING',
      percent: 0,
      loaded: 0,
      total: file.size,
      speedMBps: 0,
      etaSeconds: null,
      message: 'Iniciando transferencia…',
    })
    try {
      await uploadVideoWithProgress({
        file,
        prepareUrl: '/admin/recordings/presigned-url',
        completeUrl: '/admin/recordings/complete-upload',
        metadata: {
          camera_id: form.camera_id,
          recording_started_at: form.recording_started_at,
          duration_seconds: parseInt(form.duration_seconds, 10) || 60,
        },
        fallbackUrl: '/admin/recordings',
        onProgress: prog => setUploadProgress(prog),
      })
      setSuccess('Grabación subida y verificada exitosamente en el depósito.')
      setFile(null)
      const fileInput = document.getElementById('rec-file-input')
      if (fileInput) fileInput.value = ''
      setTimeout(() => {
        setUploadProgress(null)
      }, 3500)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Deseas eliminar esta grabación del depósito?')) return
    try {
      await apiRequest(`/admin/recordings/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <AdminLayout active="recordings" user={user}>
      <main className="admin-content">
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Depósito Central de Grabaciones</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
            Precarga videos de seguridad. Al aprobar reportes, el sistema vinculará y analizará el video automáticamente.
          </p>
        </div>

        {error && <Notice type="danger">{error}</Notice>}
        {success && <Notice type="info">{success}</Notice>}

        <div className="admin-two-cols-layout">
          <section className="admin-card">
            <h3>Subir nueva grabación</h3>
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
              <label>
                Cámara asignada
                <select
                  value={form.camera_id}
                  onChange={e => setForm({ ...form, camera_id: e.target.value })}
                  disabled={uploading}
                  required
                >
                  <option value="">Selecciona una cámara</option>
                  {renderCameraOptions(cameras)}
                </select>
              </label>

              <label>
                Fecha y hora de inicio de la grabación
                <input
                  type="datetime-local"
                  value={form.recording_started_at}
                  onChange={e => setForm({ ...form, recording_started_at: e.target.value })}
                  disabled={uploading}
                  required
                />
              </label>

              <label>
                Duración (segundos)
                <input
                  type="number"
                  min="1"
                  max="7200"
                  value={form.duration_seconds}
                  onChange={e => setForm({ ...form, duration_seconds: e.target.value })}
                  placeholder="Ej: 960 (16 min)"
                  disabled={uploading}
                  required
                />
                <small style={{ color: 'var(--text-muted)' }}>
                  {Math.floor(Number(form.duration_seconds || 0) / 60)} min {Number(form.duration_seconds || 0) % 60} seg
                </small>
              </label>

              <label>
                Archivo de video (MP4 o MOV)
                <input
                  id="rec-file-input"
                  type="file"
                  accept="video/mp4,video/quicktime"
                  onChange={e => setFile(e.target.files[0])}
                  disabled={uploading}
                  required
                />
              </label>

              <UploadProgressCard progress={uploadProgress} />

              <button className="button primary" disabled={uploading || !file} style={{ marginTop: '8px' }}>
                {uploading ? 'Transfiriendo video…' : 'Guardar en depósito'}
              </button>
            </form>
          </section>

          <section className="admin-card">
            <h3>Grabaciones almacenadas ({recordings.length})</h3>
            {busy ? (
              <div style={{ padding: '30px', textAlign: 'center' }}>Cargando grabaciones…</div>
            ) : recordings.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No hay grabaciones cargadas en el depósito.
              </div>
            ) : (
              <div className="table-wrap" style={{ marginTop: '14px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Cámara / Ubicación</th>
                      <th>Inicio</th>
                      <th>Duración</th>
                      <th>Tamaño</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recordings.map(r => (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.camera_label}</strong>
                          <small style={{ display: 'block', color: 'var(--text-muted)' }}>{r.camera_location}</small>
                        </td>
                        <td>
                          {new Date(r.recording_started_at).toLocaleDateString()}{' '}
                          <small>{new Date(r.recording_started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                        </td>
                        <td>{Math.floor(r.duration_seconds / 60)}m {r.duration_seconds % 60}s</td>
                        <td>{(r.size_bytes / (1024 * 1024)).toFixed(1)} MB</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button className="button secondary small" onClick={() => openEditModal(r)}>
                              Editar
                            </button>
                            <button className="button danger-outline small" onClick={() => handleDelete(r.id)}>
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Modal de edición de grabación */}
        {editModal && editingRec && (
          <div className="modal-backdrop" onClick={() => !editingBusy && setEditModal(false)}>
            <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3>Editar Grabación</h3>
                <button className="close-button" onClick={() => !editingBusy && setEditModal(false)}>✕</button>
              </div>
              <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
                <label>
                  Nombre / Etiqueta del video
                  <input
                    type="text"
                    value={editForm.original_name}
                    onChange={e => setEditForm({ ...editForm, original_name: e.target.value })}
                    placeholder="Ej: Camara Salon 303.mp4"
                    disabled={editingBusy}
                  />
                </label>
                <label>
                  Cámara asignada
                  <select
                    value={editForm.camera_id}
                    onChange={e => setEditForm({ ...editForm, camera_id: e.target.value })}
                    disabled={editingBusy}
                    required
                  >
                    <option value="">Selecciona una cámara</option>
                    {renderCameraOptions(cameras)}
                  </select>
                </label>
                <label>
                  Fecha y hora de inicio de la grabación
                  <input
                    type="datetime-local"
                    value={editForm.recording_started_at}
                    onChange={e => setEditForm({ ...editForm, recording_started_at: e.target.value })}
                    disabled={editingBusy}
                    required
                  />
                </label>
                <label>
                  Duración (segundos)
                  <input
                    type="number"
                    min="1"
                    max="7200"
                    value={editForm.duration_seconds}
                    onChange={e => setEditForm({ ...editForm, duration_seconds: e.target.value })}
                    disabled={editingBusy}
                    required
                  />
                  <small style={{ color: 'var(--text-muted)' }}>
                    {Math.floor(Number(editForm.duration_seconds || 0) / 60)} min {Number(editForm.duration_seconds || 0) % 60} seg
                  </small>
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setEditModal(false)}
                    disabled={editingBusy}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="button primary"
                    disabled={editingBusy}
                  >
                    {editingBusy ? 'Guardando…' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  )
}

function AdminUsers({ user }) {
  const [users, setUsers] = useState([])
  const [filterRelation, setFilterRelation] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [_busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const data = await apiRequest('/admin/users')
      setUsers(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleAdmin = async (targetUser) => {
    const newRole = targetUser.role === 'ADMIN' ? 'USER' : 'ADMIN'
    const confirmMsg = newRole === 'ADMIN'
      ? `¿Deseas otorgar permisos de Administrador a ${targetUser.full_name}?`
      : `¿Deseas revocar permisos de Administrador a ${targetUser.full_name}?`
    if (!window.confirm(confirmMsg)) return

    try {
      await apiRequest(`/admin/users/${targetUser.id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole }),
      })
      setSuccess(`Rol de ${targetUser.full_name} actualizado exitosamente.`)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSanction = async (targetUser) => {
    if (targetUser.is_sanctioned) {
      if (!window.confirm(`¿Deseas levantar la sanción a ${targetUser.full_name}?`)) return
      try {
        await apiRequest(`/admin/users/${targetUser.id}/sanction`, {
          method: 'POST',
          body: JSON.stringify({ is_sanctioned: false, reason: null }),
        })
        setSuccess(`Sanción levantada a ${targetUser.full_name}.`)
        await load()
      } catch (e) {
        setError(e.message)
      }
    } else {
      const reason = window.prompt(`Ingresa el motivo de la sanción para ${targetUser.full_name}:`)
      if (!reason || !reason.trim()) return
      try {
        await apiRequest(`/admin/users/${targetUser.id}/sanction`, {
          method: 'POST',
          body: JSON.stringify({ is_sanctioned: true, reason: reason.trim() }),
        })
        setSuccess(`Usuario ${targetUser.full_name} sancionado correctamente.`)
        await load()
      } catch (e) {
        setError(e.message)
      }
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchRelation = !filterRelation || u.institution_relation === filterRelation
      const matchRole = !filterRole || u.role === filterRole
      const matchSearch = !searchQuery ||
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.course && u.course.toLowerCase().includes(searchQuery.toLowerCase()))
      return matchRelation && matchRole && matchSearch
    })
  }, [users, filterRelation, filterRole, searchQuery])

  return (
    <AdminLayout active="users" user={user}>
      <main className="admin-content">
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Gestión de Usuarios</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
            Administra roles, audita miembros de la comunidad y aplica sanciones.
          </p>
        </div>

        {error && <Notice type="danger">{error}</Notice>}
        {success && <Notice type="info">{success}</Notice>}

        <div className="admin-card">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Buscar por nombre, correo o curso…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: '240px' }}
            />
            <select value={filterRelation} onChange={e => setFilterRelation(e.target.value)}>
              <option value="">Todos los roles escolares</option>
              <option value="Estudiante">Estudiantes</option>
              <option value="Acudiente">Acudientes</option>
            </select>
            <select value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="">Todos los permisos</option>
              <option value="ADMIN">Administradores</option>
              <option value="USER">Usuarios regulares</option>
            </select>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Relación / Curso</th>
                  <th>Permisos</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <strong>{u.full_name}</strong>
                      <small style={{ display: 'block', color: 'var(--text-muted)' }}>{u.email}</small>
                    </td>
                    <td>
                      {u.institution_relation}
                      {u.course && <small style={{ display: 'block', color: 'var(--text-muted)' }}>Curso: {u.course} ({u.shift})</small>}
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'ADMIN' ? 'ai' : 'neutral'}`}>
                        {u.role === 'ADMIN' ? 'Administrador' : 'Usuario'}
                      </span>
                    </td>
                    <td>
                      {u.is_sanctioned ? (
                        <span className="badge danger" title={u.sanction_reason || 'Sancionado'}>Sancionado</span>
                      ) : (
                        <span className="badge success">Activo</span>
                      )}
                    </td>
                    <td>
                      {u.id === user.id ? (
                        <small style={{ color: 'var(--text-muted)' }}>(Tu cuenta)</small>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="button secondary small"
                            onClick={() => toggleAdmin(u)}
                          >
                            {u.role === 'ADMIN' ? 'Quitar Admin' : 'Hacer Admin'}
                          </button>
                          <button
                            className={`button small ${u.is_sanctioned ? 'success' : 'danger-outline'}`}
                            onClick={() => handleSanction(u)}
                          >
                            {u.is_sanctioned ? 'Levantar Sanción' : 'Sancionar'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </AdminLayout>
  )
}

function AdminAppeals({ user }) {
  const [appeals, setAppeals] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const data = await apiRequest('/admin/appeals')
      setAppeals(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const resolve = async (id, action) => {
    try {
      await apiRequest(`/admin/appeals/${id}/resolve?action=${action}`, { method: 'PUT' })
      setSuccess(action === 'approve' ? 'Sanción levantada exitosamente.' : 'Apelación rechazada.')
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <AdminLayout active="appeals" user={user}>
      <main className="admin-content">
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800 }}>Apelaciones de Sanciones</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
            Revisa los descargos enviados por usuarios sancionados y decide si restaurar su acceso.
          </p>
        </div>

        {error && <Notice type="danger">{error}</Notice>}
        {success && <Notice type="info">{success}</Notice>}

        <div className="admin-card">
          {busy ? (
            <div style={{ padding: '30px', textAlign: 'center' }}>Cargando apelaciones…</div>
          ) : appeals.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No hay apelaciones registradas.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Mensaje de Apelación</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {appeals.map(a => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.user_full_name}</strong>
                        <small style={{ display: 'block', color: 'var(--text-muted)' }}>{a.user_email} ({a.user_relation})</small>
                      </td>
                      <td style={{ maxWidth: '300px', whiteSpace: 'normal', fontSize: '0.85rem' }}>{a.message}</td>
                      <td>
                        <Badge status={a.status === 'PENDING' ? 'SUBMITTED' : 'NOT_CONCLUSIVE'} />
                      </td>
                      <td>{new Date(a.created_at).toLocaleDateString()}</td>
                      <td>
                        {a.status === 'PENDING' ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="button success small" onClick={() => resolve(a.id, 'approve')}>
                              Levantar sanción
                            </button>
                            <button className="button danger-outline small" onClick={() => resolve(a.id, 'reject')}>
                              Mantener
                            </button>
                          </div>
                        ) : (
                          <small style={{ color: 'var(--text-muted)' }}>Resuelta</small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </AdminLayout>
  )
}


function NexiaProcessingLoader({ report }) {
  const [step, setStep] = useState(1)
  const [progress, setProgress] = useState(30)

  useEffect(() => {
    const t1 = setTimeout(() => { setStep(2); setProgress(68); }, 2500)
    const t2 = setTimeout(() => { setStep(3); setProgress(92); }, 6500)
    return () => { clearTimeout(t1); clearTimeout(t2); }
  }, [])

  return (
    <section className="admin-card nexia-processing-card">
      <div className="nexia-pulse-scanner-ring">
        <div className="scanner-glow-circle">
          <Icon name="spark" size={26} />
        </div>
        <div className="scanner-radar-wave" />
      </div>

      <div className="nexia-processing-badge">
        <span className="live-pulse" />
        <span>MOTOR NEXIA VISION MATRIX · ANÁLISIS EN CURSO</span>
      </div>

      <h3 style={{ margin: '14px 0 6px', fontSize: '1.25rem', color: '#fff' }}>
        NEXIA está procesando el reporte…
      </h3>
      <p style={{ margin: '0 0 18px', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Analizando fotogramas de la cámara en <strong>{report?.location || 'área indicada'}</strong> durante el rango <strong>{report?.approximate_time_start?.slice(0, 5)} - {report?.approximate_time_end?.slice(0, 5)}</strong>.
      </p>

      <div className="nexia-progress-bar-container">
        <div className="nexia-progress-bar-fill" style={{ width: `${progress}%` }}>
          <div className="nexia-progress-bar-shimmer" />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--accent-cyan)' }}>
        <span>TELEMETRÍA DE RED: SINCRONIZADA</span>
        <span>{progress}%</span>
      </div>

      <div className="nexia-steps-list">
        <div className={`nexia-step-item ${step >= 1 ? 'completed' : ''}`}>
          <span className="step-icon">{step > 1 ? '✓' : '●'}</span>
          <span className="step-text">Localizando grabación en el depósito CCTV ({report?.location || 'Cámara escolar'})</span>
        </div>
        <div className={`nexia-step-item ${step >= 2 ? (step === 2 ? 'active' : 'completed') : ''}`}>
          <span className="step-icon">{step > 2 ? '✓' : (step === 2 ? '⚡' : '○')}</span>
          <span className="step-text">Motor NEXIA Vision analizando patrones de movimiento y coincidencia espaciotemporal</span>
        </div>
        <div className={`nexia-step-item ${step >= 3 ? 'active' : ''}`}>
          <span className="step-icon">{step === 3 ? '⚡' : '○'}</span>
          <span className="step-text">Tipificando según Ley 1620 y sintetizando momentos clave</span>
        </div>
      </div>
    </section>
  )
}

function AdminDetail({ reportId, user }) {
  const [report, setReport] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [evidence, setEvidence] = useState(null)
  const [_cameras, setCameras] = useState([])
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const videoRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [item, cameraList] = await Promise.all([
        apiRequest(`/admin/reports/${reportId}`),
        apiRequest('/admin/cameras'),
      ])
      setReport(item)
      setCameras(cameraList)
      try {
        setAnalysis(await apiRequest(`/admin/reports/${reportId}/analysis`))
      } catch {
        setAnalysis(null)
      }
      try {
        setEvidence(await apiRequest(`/admin/reports/${reportId}/evidence`))
      } catch {
        setEvidence(null)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }, [reportId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!['ANALYZING'].includes(report?.status)) return
    const timer = setInterval(load, 2500)
    return () => clearInterval(timer)
  }, [report?.status, load])

  const action = async (kind) => {
    setBusy(true)
    setError('')
    try {
      if (kind === 'reject') {
        const reason = window.prompt('Motivo breve del rechazo:')
        if (!reason) {
          setBusy(false)
          return
        }
        await apiRequest(`/admin/reports/${reportId}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        })
      } else {
        await apiRequest(`/admin/reports/${reportId}/approve`, { method: 'POST' })
      }
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const decide = async (decision) => {
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/admin/reports/${reportId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, observation: 'Decisión tomada tras revisión' }),
      })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (busy && !report) {
    return <AdminLayout user={user}><div style={{ padding: '60px', textAlign: 'center' }}>Cargando caso…</div></AdminLayout>
  }
  if (!report) {
    return <AdminLayout user={user}><main className="admin-content"><Notice type="danger">{error || 'No fue posible abrir el reporte.'}</Notice></main></AdminLayout>
  }

  return (
    <AdminLayout active="reports" user={user}>
      <main className="admin-content">
        <button className="text-button" onClick={() => navigate('admin')}>← Volver a reportes</button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <p className="eyebrow" style={{ color: 'var(--accent-cyan)' }}>DETALLE DEL REPORTE</p>
            <h1 style={{ margin: '4px 0 6px', fontSize: '1.45rem', fontFamily: 'monospace' }}>{report.public_code}</h1>
            <Badge status={report.status} />
          </div>
          <small style={{ color: 'var(--text-muted)' }}>Recibido {new Date(report.created_at).toLocaleString('es-CO')}</small>
        </div>

        {error && <Notice type="danger">{error}</Notice>}

        <div className="report-detail-layout">
          <div>
          <section className="admin-card">
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Información del Suceso</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '14px' }}>
              <div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Tipo</small>
                <div style={{ fontSize: '0.92rem' }}><strong>{TYPE_LABELS[report.incident_type] || report.incident_type}</strong></div>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Fecha y Rango Horario</small>
                <div style={{ fontSize: '0.92rem' }}><strong>{report.incident_date} · {report.approximate_time_start?.slice(0, 5)} - {report.approximate_time_end?.slice(0, 5)}</strong></div>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Ubicación</small>
                <div style={{ fontSize: '0.92rem' }}><strong>{report.location}</strong></div>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Reportante</small>
                <div style={{ fontSize: '0.92rem' }}><strong>{report.reporter_name}</strong></div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Alias involucrados</small>
                <div style={{ fontSize: '0.9rem' }}>{report.involved_aliases || 'No indicados'}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Descripción</small>
                <div style={{ background: 'var(--bg-surface-elevated)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', marginTop: '4px', fontSize: '0.86rem', lineHeight: 1.5, maxHeight: '160px', overflowY: 'auto' }}>
                  {report.description}
                </div>
              </div>
            </div>
          </section>

          {/* Registro de Video CCTV del Hecho con Salto Interactivo a Momentos Clave */}
          <section className="admin-card cctv-evidence-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="hud-rec-dot" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>CCTV · Registro en Video del Suceso</h3>
                </div>
                <small style={{ color: 'var(--text-muted)' }}>
                  Cámara: <strong style={{ color: 'var(--accent-cyan)' }}>{evidence?.camera_label || report.location}</strong>
                  {evidence?.camera_location && ` · Ubicación: ${evidence.camera_location}`}
                </small>
              </div>
              <div className="time-window-badge">
                <Icon name="clock" size={13} />
                <span>RANGO: {report.approximate_time_start?.slice(0, 5)} - {report.approximate_time_end?.slice(0, 5)}</span>
              </div>
            </div>

            <div className="evidence-video-container">
              {evidence?.stream_url ? (
                <video
                  ref={videoRef}
                  key={evidence.stream_url}
                  src={evidence.stream_url.startsWith('http') ? evidence.stream_url : `${API_BASE_URL.replace(/\/api\/?$/, '')}${evidence.stream_url}`}
                  controls
                  playsInline
                  className="evidence-video-player"
                />
              ) : (
                <div className="evidence-video-placeholder">
                  <Icon name="video" size={36} />
                  <p style={{ margin: '10px 0 0', fontSize: '0.85rem' }}>
                    {report.status === 'SUBMITTED'
                      ? 'La grabación de este salón se vinculará de inmediato al aprobar el reporte.'
                      : 'No se encontró grabación precargada para este salón/horario en el depósito.'}
                  </p>
                </div>
              )}
            </div>

            {/* Botones interactivos para saltar a los momentos clave del video */}
            {analysis?.relevant_moments && analysis.relevant_moments.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <small style={{ fontWeight: 700, color: 'var(--accent-cyan)', letterSpacing: '0.04em' }}>
                    ⚡ MOMENTOS CLAVE DETECTADOS POR NEXIA (Haz clic para saltar en el video):
                  </small>
                  <small style={{ color: 'var(--text-muted)' }}>{analysis.relevant_moments.length} eventos</small>
                </div>
                <div className="moments-chips-row">
                  {analysis.relevant_moments.map((m, idx) => {
                    const mins = Math.floor(m.timestamp_seconds / 60)
                    const secs = m.timestamp_seconds % 60
                    const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`
                    return (
                      <button
                        key={idx}
                        type="button"
                        className="moment-seek-chip"
                        onClick={() => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = m.timestamp_seconds
                            videoRef.current.play()
                          }
                        }}
                        title={`Reproducir desde ${m.timestamp_seconds}s (${timeStr}): ${m.description}`}
                      >
                        <span className="moment-seek-badge">▶ {timeStr} ({m.timestamp_seconds}s)</span>
                        <span className="moment-seek-label">{m.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
          </div>

          <div>
            {report.status === 'SUBMITTED' && (
              <section className="admin-card">
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-cyan)', display: 'grid', placeItems: 'center', marginBottom: '16px' }}>
                  <Icon name="shield" size={24} />
                </div>
                <h3>Decisión Inicial</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Al aprobar, el sistema buscará automáticamente el video correspondiente en el depósito e iniciará el análisis con el Motor NEXIA.
                </p>
                <div className="actions" style={{ marginTop: '20px' }}>
                  <button className="button primary" disabled={busy} onClick={() => action('approve')}>
                    Aprobar para análisis
                  </button>
                  <button className="button danger-outline" disabled={busy} onClick={() => action('reject')}>
                    Rechazar
                  </button>
                </div>
              </section>
            )}

            {report.status === 'ANALYZING' && (
              <NexiaProcessingLoader report={report} />
            )}

            {report.status === 'ANALYSIS_FAILED' && (
              <section className="admin-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', display: 'grid', placeItems: 'center', marginBottom: '16px' }}>
                  <Icon name="alert" size={24} />
                </div>
                <h3 style={{ color: 'var(--danger)', margin: '0 0 8px' }}>Análisis no completado</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  {analysis?.safe_error || 'Hubo un inconveniente al conectar con el motor de IA. Puedes reintentar el análisis en cualquier momento con el video ya vinculado.'}
                </p>
                <div className="actions" style={{ marginTop: '20px' }}>
                  <button className="button primary" disabled={busy} onClick={() => action('approve')}>
                    ⚡ Reintentar análisis con IA
                  </button>
                  <button className="button danger-outline" disabled={busy} onClick={() => action('reject')}>
                    Rechazar
                  </button>
                </div>
              </section>
            )}

            {analysis && analysis.summary && (
              <section className="admin-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3>Veredicto de NEXIA</h3>
                  <span className={`badge ${analysis.confidence_level === 'HIGH' ? 'success' : 'warning'}`}>
                    Confianza {analysis.confidence_level === 'HIGH' ? 'Alta' : 'Media'}
                  </span>
                </div>

                <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '16px' }}>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>Resumen Observable:</strong>
                  <p style={{ margin: '6px 0 0', fontSize: '0.85rem', lineHeight: 1.5 }}>
                    {analysis.summary}
                  </p>
                </div>

                {analysis.relevant_moments && analysis.relevant_moments.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <small style={{ color: 'var(--text-muted)', fontWeight: 700 }}>MOMENTOS CLAVE DETECTADOS:</small>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                      {analysis.relevant_moments.map((m, idx) => (
                        <div key={idx} style={{ padding: '10px', background: 'var(--bg-main)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                          <b style={{ color: 'var(--accent-cyan)', fontFamily: 'monospace' }}>[{m.timestamp_seconds}s]</b> <strong>{m.label}:</strong> {m.description}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {['REVIEW_REQUIRED', 'ANALYZING'].includes(report.status) && (
                  <div className="actions">
                    <button className="button success" onClick={() => decide('CONFIRMED')}>
                      Confirmar coincidencia
                    </button>
                    <button className="button secondary" onClick={() => decide('NOT_CONCLUSIVE')}>
                      No concluyente
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </main>
    </AdminLayout>
  )
}

function App() {
  const [route, setRoute] = useState({ page: 'home', payload: null })
  const [currentUser, setCurrentUser] = useState(getStoredUser)
  const [authModal, setAuthModal] = useState({ open: false, tab: 'register', nextRoute: null })
  const [convivenciaModal, setConvivenciaModal] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('nexia_theme') || 'dark')
  const [lang, setLang] = useState(() => localStorage.getItem('nexia_lang') || 'es')

  useEffect(() => {
    setGlobalPage = setRoute
    setGlobalAuthModal = setAuthModal
    setGlobalConvivenciaModal = setConvivenciaModal
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('nexia_theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('nexia_lang', lang)
  }, [lang])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const toggleLang = () => {
    setLang(prev => prev === 'es' ? 'en' : 'es')
  }

  const handleLogout = () => {
    clearSession()
    setCurrentUser(null)
    navigate('home')
  }

  const handleAuthSuccess = (user, token, nextRoute) => {
    setSession(token, user)
    setCurrentUser(user)
    if (nextRoute) navigate(nextRoute)
  }

  return (
    <>
      <Header
        user={currentUser}
        theme={theme}
        lang={lang}
        onToggleTheme={toggleTheme}
        onToggleLang={toggleLang}
        onLogout={handleLogout}
        onOpenAuth={(tab) => setAuthModal({ open: true, tab, nextRoute: null })}
      />

      <AuthModal
        isOpen={authModal.open}
        defaultTab={authModal.tab}
        nextRoute={authModal.nextRoute}
        onClose={() => setAuthModal(prev => ({ ...prev, open: false }))}
        onAuthSuccess={handleAuthSuccess}
      />

      <ConvivenciaModal
        isOpen={convivenciaModal}
        onClose={() => setConvivenciaModal(false)}
      />

      {route.page === 'home' && (
        <Home
          user={currentUser}
          lang={lang}
          onLogout={handleLogout}
          onOpenAuth={(tab) => setAuthModal({ open: true, tab, nextRoute: null })}
        />
      )}
      {route.page === 'report' && <ReportForm user={currentUser} lang={lang} initialData={route.payload} />}
      {route.page === 'track' && <TrackCase initialCode={route.payload} lang={lang} />}
      {route.page === 'admin' && <AdminDashboard user={currentUser} />}
      {route.page === 'admin_cctv' && <AdminLiveCCTV user={currentUser} lang={lang} />}
      {route.page === 'admin_recordings' && <AdminRecordings user={currentUser} />}
      {route.page === 'admin_users' && <AdminUsers user={currentUser} />}
      {route.page === 'admin_appeals' && <AdminAppeals user={currentUser} />}
      {route.page === 'admin_manual' && <AdminManual user={currentUser} />}
      {route.page === 'detail' && <AdminDetail reportId={route.payload} user={currentUser} />}

      {/* Floating AI Chatbot Assistant */}
      <NexiaChatbot user={currentUser} lang={lang} />
    </>
  )
}

export default App
