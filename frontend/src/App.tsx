import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginAlumno from './pages/LoginAlumno'
import LoginAdmin from './pages/LoginAdmin'
import Dashboard from './pages/profesora/Dashboard'
import Salas from './pages/profesora/Salas'
import Aula from './pages/alumno/Aula'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* /login → solo alumnos (va en los tablets) */}
          <Route path="/login" element={<LoginAlumno />} />

          {/* /admin → solo profesoras (URL secreta) */}
          <Route path="/admin" element={<LoginAdmin />} />

          {/* Profesora */}
          <Route path="/profesora" element={
            <ProtectedRoute rol="profesora"><Dashboard /></ProtectedRoute>
          } />
          <Route path="/profesora/salas" element={
            <ProtectedRoute rol="profesora"><Salas /></ProtectedRoute>
          } />

          {/* Alumno */}
          <Route path="/aula" element={
            <ProtectedRoute rol="alumno"><Aula /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
