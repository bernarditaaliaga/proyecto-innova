import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginAlumno from './pages/LoginAlumno'
import LoginAdmin from './pages/LoginAdmin'
import Dashboard from './pages/profesora/Dashboard'
import Salas from './pages/profesora/Salas'
import Planificaciones from './pages/profesora/Planificaciones'
import EditarPlan from './pages/profesora/EditarPlan'
import Metricas from './pages/profesora/Metricas'
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
          <Route path="/profesora/planificaciones" element={
            <ProtectedRoute rol="profesora"><Planificaciones /></ProtectedRoute>
          } />
          <Route path="/profesora/planificaciones/:id" element={
            <ProtectedRoute rol="profesora"><EditarPlan /></ProtectedRoute>
          } />
          <Route path="/profesora/metricas" element={
            <ProtectedRoute rol="profesora"><Metricas /></ProtectedRoute>
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
