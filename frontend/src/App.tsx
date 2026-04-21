import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import LoginAlumno from './pages/LoginAlumno'
import LoginAdmin from './pages/LoginAdmin'
import Dashboard from './pages/profesora/Dashboard'
import Salas from './pages/profesora/Salas'
import Planificaciones from './pages/profesora/Planificaciones'
import EditarPlan from './pages/profesora/EditarPlan'
import Sesion from './pages/profesora/Sesion'
import Metricas from './pages/profesora/Metricas'
import Materias from './pages/profesora/Materias'
import Calendario from './pages/profesora/Calendario'
import Aula from './pages/alumno/Aula'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing → Soy Alumno / Soy Profesora */}
          <Route path="/" element={<Landing />} />

          {/* Login alumnos */}
          <Route path="/login" element={<LoginAlumno />} />

          {/* Login/registro profesoras */}
          <Route path="/admin" element={<LoginAdmin />} />

          {/* Profesora */}
          <Route path="/profesora" element={
            <ProtectedRoute rol="profesora"><Dashboard /></ProtectedRoute>
          } />
          <Route path="/profesora/salas" element={
            <ProtectedRoute rol="profesora"><Salas /></ProtectedRoute>
          } />
          <Route path="/profesora/planificaciones" element={
            <ProtectedRoute rol="profesora"><Planificaciones /></ProtectedRoute>
          } />
          <Route path="/profesora/planificaciones/:id" element={
            <ProtectedRoute rol="profesora"><EditarPlan /></ProtectedRoute>
          } />
          <Route path="/profesora/sesion/:id" element={
            <ProtectedRoute rol="profesora"><Sesion /></ProtectedRoute>
          } />
          <Route path="/profesora/metricas" element={
            <ProtectedRoute rol="profesora"><Metricas /></ProtectedRoute>
          } />
          <Route path="/profesora/calendario" element={
            <ProtectedRoute rol="profesora"><Calendario /></ProtectedRoute>
          } />
          <Route path="/profesora/materias" element={
            <ProtectedRoute rol="profesora"><Materias /></ProtectedRoute>
          } />

          {/* Alumno */}
          <Route path="/aula" element={
            <ProtectedRoute rol="alumno"><Aula /></ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
