import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({
  children, rol
}: {
  children: React.ReactNode
  rol?: 'profesora' | 'alumno'
}) {
  const { usuario } = useAuth()

  if (!usuario) return <Navigate to={rol === 'profesora' ? '/admin' : '/login'} replace />
  if (rol && usuario.rol !== rol) {
    return <Navigate to={usuario.rol === 'profesora' ? '/profesora' : '/aula'} replace />
  }

  return <>{children}</>
}
