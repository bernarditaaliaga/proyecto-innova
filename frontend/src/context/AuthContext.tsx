import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Usuario } from '../types'

interface AuthContextType {
  usuario: Usuario | null
  token: string | null
  login: (token: string, usuario: Usuario) => void
  logout: () => void
  cambiarARol: (rol: 'profesora' | 'alumno') => boolean
}

const AuthContext = createContext<AuthContextType>(null!)

function getStorageKey(rol: string) {
  return { token: `token_${rol}`, usuario: `usuario_${rol}` }
}

function cargarPorRol(rol: string): { usuario: Usuario | null; token: string | null } {
  const keys = getStorageKey(rol)
  const u = localStorage.getItem(keys.usuario)
  const t = localStorage.getItem(keys.token)
  if (u && t) return { usuario: JSON.parse(u), token: t }
  return { usuario: null, token: null }
}

function cargarSesionInicial(): { usuario: Usuario | null; token: string | null } {
  const path = window.location.pathname
  const rolPrioritario = path.startsWith('/profesora') || path.startsWith('/admin')
    ? 'profesora' : path.startsWith('/aula') ? 'alumno' : null

  if (rolPrioritario) {
    const sesion = cargarPorRol(rolPrioritario)
    if (sesion.usuario) return sesion
  }

  // Fallback: cualquier sesión activa
  for (const rol of ['profesora', 'alumno']) {
    const sesion = cargarPorRol(rol)
    if (sesion.usuario) return sesion
  }

  // Migrar formato antiguo
  const oldU = localStorage.getItem('usuario')
  const oldT = localStorage.getItem('token')
  if (oldU && oldT) {
    const usuario = JSON.parse(oldU) as Usuario
    const keys = getStorageKey(usuario.rol)
    localStorage.setItem(keys.token, oldT)
    localStorage.setItem(keys.usuario, oldU)
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    return { usuario, token: oldT }
  }

  return { usuario: null, token: null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => cargarSesionInicial().usuario)
  const [token, setToken] = useState<string | null>(() => cargarSesionInicial().token)

  function login(newToken: string, newUsuario: Usuario) {
    const keys = getStorageKey(newUsuario.rol)
    localStorage.setItem(keys.token, newToken)
    localStorage.setItem(keys.usuario, JSON.stringify(newUsuario))
    setToken(newToken)
    setUsuario(newUsuario)
  }

  function logout() {
    if (usuario) {
      const keys = getStorageKey(usuario.rol)
      localStorage.removeItem(keys.token)
      localStorage.removeItem(keys.usuario)
    }
    setToken(null)
    setUsuario(null)
    window.location.href = '/'
  }

  // Cambiar a una sesión de otro rol si existe en localStorage
  const cambiarARol = useCallback((rol: 'profesora' | 'alumno'): boolean => {
    const sesion = cargarPorRol(rol)
    if (sesion.usuario && sesion.token) {
      setUsuario(sesion.usuario)
      setToken(sesion.token)
      return true
    }
    return false
  }, [])

  return (
    <AuthContext.Provider value={{ usuario, token, login, logout, cambiarARol }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
