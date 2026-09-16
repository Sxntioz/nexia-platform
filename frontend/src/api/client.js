// URL oficial del backend en Render (comprobada y activa)
const PROD_API_URL = 'https://nexia-backend-jpgx.onrender.com/api'

// En producción (Vercel), usar SIEMPRE la URL oficial de Render ignorando cualquier errata de Vercel
const API_URL = import.meta.env.PROD
  ? PROD_API_URL
  : (import.meta.env.VITE_API_URL || 'http://localhost:8000/api')

const TOKEN_KEY = 'nexia_auth_token'
const USER_KEY = 'nexia_auth_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData
  const token = getToken()
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
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
      } catch (retryErr) {
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
      message = typeof body.detail === 'string' ? body.detail : message
    } catch {
      // El servidor puede devolver una respuesta sin JSON.
    }
    throw new Error(message)
  }

  return response.status === 204 ? null : response.json()
}

export const API_BASE_URL = API_URL

/**
 * Realiza la subida de un video grabando métricas en tiempo real (bytes, %, velocidad, tiempo restante).
 * Soporta Direct-to-S3 (bypass de proxy con URL prefirmada) y fallback local.
 */
export async function uploadVideoWithProgress({
  file,
  prepareUrl = '/admin/recordings/presigned-url',
  completeUrl = '/admin/recordings/complete-upload',
  metadata = {},
  fallbackUrl = '/admin/recordings',
  onProgress = () => {},
}) {
  const token = getToken()
  const startTime = Date.now()

  onProgress({
    stage: 'PREPARING',
    percent: 0,
    loaded: 0,
    total: file.size,
    speedMBps: 0,
    etaSeconds: null,
    message: 'Preparando subida segura…',
  })

  let prepData
  try {
    prepData = await apiRequest(prepareUrl, {
      method: 'POST',
      body: JSON.stringify({
        ...metadata,
        original_name: file.name,
        mime_type: file.type || 'video/mp4',
        size_bytes: file.size,
      }),
    })
  } catch (err) {
    console.warn('Fallo al obtener URL prefirmada, usando subida directa al servidor:', err)
    prepData = { s3_upload: false }
  }

  const createProgressHandler = (stage, message) => {
    return (e) => {
      const total = e.lengthComputable ? e.total : file.size
      const loaded = e.loaded
      const percent = Math.min(100, Math.round((loaded / total) * 100))

      const now = Date.now()
      const totalElapsedSec = Math.max(0.1, (now - startTime) / 1000)
      const avgSpeedBytesPerSec = loaded / totalElapsedSec
      const speedMBps = (avgSpeedBytesPerSec / (1024 * 1024)).toFixed(2)

      const remainingBytes = Math.max(0, total - loaded)
      const etaSeconds = avgSpeedBytesPerSec > 1024 ? Math.round(remainingBytes / avgSpeedBytesPerSec) : null

      onProgress({
        stage,
        percent,
        loaded,
        total,
        speedMBps: parseFloat(speedMBps) || 0,
        etaSeconds,
        message,
      })
    }
  }

  // CASO A: Subida directa a Amazon S3 (Sin timeout de Render, máxima velocidad)
  if (prepData?.s3_upload && prepData?.upload_url) {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', prepData.upload_url, true)
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')

      xhr.upload.onprogress = createProgressHandler(
        'UPLOADING',
        'Subiendo directamente a Amazon S3 (Nube)…'
      )

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`Error al transferir a AWS S3 (HTTP ${xhr.status})`))
        }
      }

      xhr.onerror = () => reject(new Error('Error de red al conectar con Amazon S3'))
      xhr.ontimeout = () => reject(new Error('Tiempo de espera agotado al conectar con AWS'))
      xhr.send(file)
    })

    onProgress({
      stage: 'FINALIZING',
      percent: 100,
      loaded: file.size,
      total: file.size,
      speedMBps: 0,
      etaSeconds: 0,
      message: 'Sincronizando y registrando en NEXIA…',
    })

    const finalResult = await apiRequest(completeUrl, {
      method: 'POST',
      body: JSON.stringify({
        ...metadata,
        stored_name: prepData.stored_name,
        original_name: file.name,
        mime_type: file.type || 'video/mp4',
        size_bytes: file.size,
      }),
    })

    onProgress({
      stage: 'DONE',
      percent: 100,
      loaded: file.size,
      total: file.size,
      speedMBps: 0,
      etaSeconds: 0,
      message: '¡Video sincronizado exitosamente en AWS S3!',
    })

    return finalResult
  }

  // CASO B: Fallback subida tradicional al backend local (con barra de progreso)
  const fd = new FormData()
  for (const [key, val] of Object.entries(metadata)) {
    fd.append(key, val)
  }
  fd.append('clip', file)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}${fallbackUrl}`, true)
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    }

    xhr.upload.onprogress = createProgressHandler(
      'UPLOADING',
      'Subiendo grabación al servidor…'
    )

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress({
          stage: 'DONE',
          percent: 100,
          loaded: file.size,
          total: file.size,
          speedMBps: 0,
          etaSeconds: 0,
          message: '¡Grabación guardada con éxito!',
        })
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          resolve(null)
        }
      } else {
        let msg = `Error del servidor (${xhr.status})`
        try {
          const body = JSON.parse(xhr.responseText)
          if (body.detail) msg = body.detail
        } catch {}
        reject(new Error(msg))
      }
    }

    xhr.onerror = () => reject(new Error('Error de red al comunicarse con el servidor'))
    xhr.send(fd)
  })
}
