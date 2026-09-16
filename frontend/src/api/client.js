const PROD_API_URL = 'https://nexia-backend-jogx.onrender.com/api'
const envApiUrl = import.meta.env.VITE_API_URL
const API_URL = (envApiUrl && envApiUrl.startsWith('http') && !envApiUrl.includes('localhost'))
  ? envApiUrl
  : (import.meta.env.PROD ? PROD_API_URL : (envApiUrl || 'http://localhost:8000/api'))


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

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

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
