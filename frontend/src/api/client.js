// URL oficial del backend en Render (comprobada y activa)
const PROD_API_URL = 'https://nexia-backend-jpgx.onrender.com/api'

// En producción (Vercel), usar SIEMPRE la URL oficial de Render ignorando cualquier errata de Vercel
const API_URL = import.meta.env.PROD
  ? PROD_API_URL
  : (import.meta.env.VITE_API_URL || 'http://localhost:8000/api')

const TOKEN_KEY = 'nexia_auth_token'
const USER_KEY = 'nexia_auth_user'

function getCookie(name) {
  try {
    const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]+)'))
    return match ? decodeURIComponent(match[2]) : null
  } catch (_e) {
    return null
  }
}

function setCookie(name, val, days = 730) {
  try {
    const d = new Date()
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000))
    document.cookie = `${name}=${encodeURIComponent(val)};expires=${d.toUTCString()};path=/;SameSite=Lax`
  } catch (_e) {
    // Cookie no disponible en el entorno
  }
}

function deleteCookie(name) {
  try {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`
  } catch (_e) {
    // Cookie no disponible en el entorno
  }
}

export function getToken() {
  try {
    const fromLocal = localStorage.getItem(TOKEN_KEY)
    if (fromLocal && fromLocal !== 'undefined' && fromLocal !== 'null') return fromLocal
  } catch (_e) {
    // LocalStorage no disponible
  }
  return getCookie(TOKEN_KEY)
}

export function setSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch (_e) {
    // LocalStorage no disponible
  }
  setCookie(TOKEN_KEY, token)
  setCookie(USER_KEY, JSON.stringify(user))
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (raw && raw !== 'undefined' && raw !== 'null') {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch (_e) {
    // JSON malformado
  }
  try {
    const fromCookie = getCookie(USER_KEY)
    if (fromCookie && fromCookie !== 'undefined' && fromCookie !== 'null') {
      const parsed = JSON.parse(fromCookie)
      if (parsed && typeof parsed === 'object') return parsed
    }
  } catch (_e) {
    // Cookie malformada
  }
  return null
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  } catch (_e) {
    // LocalStorage no disponible
  }
  deleteCookie(TOKEN_KEY)
  deleteCookie(USER_KEY)
}

export async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const token = getToken()
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    })
  } catch (err) {
    // Si el servidor de Render está despertando del modo reposo o hay intermitencia
    if (import.meta.env.PROD) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        response = await fetch(`${API_URL}${path}`, {
          ...options,
          headers,
        })
      } catch (_retryErr) {
        throw new Error(
          'El servidor en la nube se está iniciando (tarda unos 30 segundos si estaba inactivo). Por favor intenta de nuevo en un momento.'
        )
      }
    } else {
      throw new Error(err.message || 'Error de conexión con el servidor')
    }
  }

  if (!response.ok) {
    let message = 'No fue posible completar la solicitud'
    try {
      const body = await response.json()
      if (body.detail) {
        if (typeof body.detail === 'string') {
          message = body.detail
        } else if (Array.isArray(body.detail)) {
          message = body.detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
        } else {
          message = JSON.stringify(body.detail)
        }
      }
    } catch {
      message = `${message} (${response.status})`
    }
    throw new Error(message)
  }

  if (response.status === 204) return null
  return response.json()
}

export const API_BASE_URL = API_URL

/**
 * Sube un video con reporte continuo de progreso en tiempo real.
 * Usa presigned URLs directas a S3 (evitando límites de 4.5MB en Vercel)
 * con fallback transparente al backend si S3 no está configurado.
 *
 * @param {Object} params
 * @param {File} params.file Archivo de video
 * @param {string} params.prepareUrl Endpoint para obtener presigned URL (ej. '/admin/recordings/presigned-url')
 * @param {string} params.completeUrl Endpoint para registrar la grabación en BD (ej. '/admin/recordings/complete-upload')
 * @param {Object} params.metadata Metadatos del video (camera_id, recording_started_at, duration_seconds)
 * @param {string} params.fallbackUrl Endpoint tradicional multipart (ej. '/admin/recordings')
 * @param {Function} params.onProgress Callback (progressInfo) => void
 * @returns {Promise<Object>} Registro creado
 */
export async function uploadVideoWithProgress({
  file,
  prepareUrl,
  completeUrl,
  metadata = {},
  fallbackUrl,
  onProgress = () => {},
}) {
  const token = getToken()
  const fileSize = file.size

  // Intento 1: Carga directa vía Presigned URL (S3)
  try {
    onProgress({
      stage: 'PREPARING',
      percent: 5,
      loaded: 0,
      total: fileSize,
      speedMBps: 0,
      etaSeconds: null,
      message: 'Preparando enlace seguro de transferencia a S3…',
    })

    const prep = await apiRequest(prepareUrl, {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        content_type: file.type || 'video/mp4',
        file_size_bytes: fileSize,
      }),
    })

    if (prep && prep.upload_url && prep.s3_key) {
      // Subir archivo binario directo a S3 vía XHR para rastrear progreso en vivo
      await uploadDirectToS3({
        uploadUrl: prep.upload_url,
        file,
        contentType: prep.content_type || file.type || 'video/mp4',
        onProgress: ({ percent, loaded, total, speedMBps, etaSeconds }) => {
          onProgress({
            stage: 'UPLOADING',
            percent,
            loaded,
            total,
            speedMBps,
            etaSeconds,
            message: `Transfiriendo a almacenamiento seguro (${percent}% - ${speedMBps} MB/s)…`,
          })
        },
      })

      // Notificar al backend que la carga terminó para indexar en BD
      onProgress({
        stage: 'FINALIZING',
        percent: 98,
        loaded: fileSize,
        total: fileSize,
        speedMBps: 0,
        etaSeconds: null,
        message: 'Registrando e indexando video en la base de datos…',
      })

      const saved = await apiRequest(completeUrl, {
        method: 'POST',
        body: JSON.stringify({
          s3_key: prep.s3_key,
          file_name: file.name,
          file_size_bytes: fileSize,
          ...metadata,
        }),
      })

      onProgress({
        stage: 'COMPLETED',
        percent: 100,
        loaded: fileSize,
        total: fileSize,
        speedMBps: 0,
        etaSeconds: 0,
        message: 'Video sincronizado e indexado correctamente.',
      })

      return saved
    }
  } catch (err) {
    console.warn('Carga directa S3 no disponible o falló, recurriendo a backend:', err)
  }

  // Intento 2: Fallback tradicional multipart directo al backend
  return uploadMultipartWithProgress({
    file,
    fallbackUrl,
    metadata,
    onProgress,
    token,
  })
}

function uploadDirectToS3({ uploadUrl, file, contentType, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const startTime = Date.now()

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        const percent = Math.min(96, Math.round((e.loaded / e.total) * 95))
        const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000)
        const speedMBps = Number(((e.loaded / (1024 * 1024)) / elapsedSec).toFixed(1))
        const remainingBytes = e.total - e.loaded
        const etaSeconds = speedMBps > 0 ? Math.round((remainingBytes / (1024 * 1024)) / speedMBps) : null

        onProgress({
          percent,
          loaded: e.loaded,
          total: e.total,
          speedMBps,
          etaSeconds,
        })
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Fallo en transferencia S3 (HTTP ${xhr.status})`))
      }
    }

    xhr.onerror = () => reject(new Error('Error de red al transferir archivo a S3'))
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.send(file)
  })
}

function uploadMultipartWithProgress({ file, fallbackUrl, metadata, onProgress, token }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const startTime = Date.now()

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        const percent = Math.min(95, Math.round((e.loaded / e.total) * 95))
        const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000)
        const speedMBps = Number(((e.loaded / (1024 * 1024)) / elapsedSec).toFixed(1))
        const remainingBytes = e.total - e.loaded
        const etaSeconds = speedMBps > 0 ? Math.round((remainingBytes / (1024 * 1024)) / speedMBps) : null

        onProgress({
          stage: 'UPLOADING',
          percent,
          loaded: e.loaded,
          total: e.total,
          speedMBps,
          etaSeconds,
          message: `Enviando video al servidor (${percent}% - ${speedMBps} MB/s)…`,
        })
      }
    }

    const fd = new FormData()
    fd.append('file', file)
    Object.entries(metadata).forEach(([k, v]) => {
      if (v !== undefined && v !== null) fd.append(k, String(v))
    })

    xhr.open('POST', `${API_URL}${fallbackUrl}`)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress({
          stage: 'COMPLETED',
          percent: 100,
          loaded: file.size,
          total: file.size,
          speedMBps: 0,
          etaSeconds: 0,
          message: 'Video procesado exitosamente.',
        })
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch (_e) {
          resolve(null)
        }
      } else {
        let msg = `Error del servidor (${xhr.status})`
        try {
          const body = JSON.parse(xhr.responseText)
          if (body.detail) msg = body.detail
        } catch (_e) {
          // formato no json
        }
        reject(new Error(msg))
      }
    }

    xhr.onerror = () => reject(new Error('Error de red al comunicarse con el servidor'))
    xhr.send(fd)
  })
}

export function getWebSocketUrl(path) {
  const base = API_BASE_URL.replace(/^http/, 'ws')
  const cleanBase = base.endsWith('/') ? base.slice(0, -1) : base
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  if (cleanBase.endsWith('/api') && cleanPath.startsWith('/api')) {
    return `${cleanBase.slice(0, -4)}${cleanPath}`
  }
  return `${cleanBase}${cleanPath}`
}
