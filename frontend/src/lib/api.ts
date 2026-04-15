import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      const stored = localStorage.getItem('usuario')
      const rol = stored ? JSON.parse(stored).rol : null
      localStorage.clear()
      window.location.href = rol === 'profesora' ? '/admin' : '/login'
    }
    return Promise.reject(err)
  }
)
