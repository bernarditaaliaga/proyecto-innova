import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { Usuario } from '../types'

interface AuthContextType {
  usuario: Usuario | null
  token: string | null
  login: (token: string, usuario: Usuario) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const u = localStorage.getItem('usuario')
    return u ? JSON.parse(u) : null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  function login(token: string, usuario: Usuario) {
    localStorage.setItem('token', token)
    localStorage.setItem('usuario', JSON.stringify(usuario))
    setToken(token)
    setUsuario(usuario)
  }

  function logout() {
    const destino = usuario?.rol === 'profesora' ? '/admin' : '/login'
    localStorage.clear()
    setToken(null)
    setUsuario(null)
    window.location.href = destino
  }

  return (
    <AuthContext.Provider value={{ usuario, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
