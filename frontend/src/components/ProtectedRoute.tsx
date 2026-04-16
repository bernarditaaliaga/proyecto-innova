import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect } from 'react'

export default function ProtectedRoute({
  children, rol
}: {
  children: React.ReactNode
  rol?: 'profesora' | 'alumno'
}) {
  const { usuario, cambiarARol } = useAuth()

  // Si la sesión actual no coincide con el rol requerido,
  // intentar cargar la sesión correcta desde localStorage
  useEffect(() => {
    if (rol && usuario && usuario.rol !== rol) {
      cambiarARol(rol)
    }
  }, [rol, usuario, cambiarARol])

  // Sin sesión → landing
  if (!usuario) {
    // Intentar cargar sesión del rol requerido antes de redirigir
    if (rol && cambiarARol(rol)) {
      return null // Se re-renderizará con la sesión correcta
    }
    return <Navigate to="/" replace />
  }

  // Sesión de otro rol y no se pudo cambiar
  if (rol && usuario.rol !== rol) {
    return <Navigate to={usuario.rol === 'profesora' ? '/profesora' : '/aula'} replace />
  }

  return <>{children}</>
}
