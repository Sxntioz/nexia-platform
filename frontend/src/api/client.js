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
