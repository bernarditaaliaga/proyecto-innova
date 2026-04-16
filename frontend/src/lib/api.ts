import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const api = axios.create({ baseURL: BASE_URL })

function getTokenActual(): string | null {
  // Determinar rol por la ruta actual
  const path = window.location.pathname
  if (path.startsWith('/profesora') || path.startsWith('/admin')) {
    return localStorage.getItem('token_profesora')
  }
  if (path.startsWith('/aula')) {
    return localStorage.getItem('token_alumno')
  }
  // Fallback
  return localStorage.getItem('token_profesora') || localStorage.getItem('token_alumno')
}

api.interceptors.request.use((config) => {
  const token = getTokenActual()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname
      if (path.startsWith('/profesora')) {
        localStorage.removeItem('token_profesora')
        localStorage.removeItem('usuario_profesora')
      } else if (path.startsWith('/aula')) {
        localStorage.removeItem('token_alumno')
        localStorage.removeItem('usuario_alumno')
      }
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)
