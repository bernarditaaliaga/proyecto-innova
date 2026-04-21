import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Dashboard() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const secciones = [
    {
      icono: '🏫',
      titulo: 'Mis Salas',
      descripcion: 'Gestiona tus cursos y alumnos',
      ruta: '/profesora/salas',
      color: '#6C5CE7'
    },
    {
      icono: '📋',
      titulo: 'Planificaciones',
      descripcion: 'Crea y administra tus clases',
      ruta: '/profesora/planificaciones',
      color: '#00B894'
    },
    {
      icono: '📊',
      titulo: 'Métricas',
      descripcion: 'Rendimiento de tus alumnos',
      ruta: '/profesora/metricas',
      color: '#FDCB6E'
    },
    {
      icono: '📅',
      titulo: 'Calendario',
      descripcion: 'Organiza tu agenda de clases',
      ruta: '/profesora/calendario',
      color: '#E17055'
    }
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-6 py-5 flex items-center justify-between"
        style={{ background: 'var(--primary)' }}>
        <div>
          <h1 className="text-2xl font-bold text-white">🎓 AprendIA</h1>
          <p className="text-purple-200 text-sm">Hola, {usuario?.nombre}</p>
        </div>
        <button onClick={logout}
          className="text-purple-200 hover:text-white text-sm cursor-pointer">
          Cerrar sesión
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>
          Panel de control
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {secciones.map(s => (
            <button key={s.ruta} onClick={() => navigate(s.ruta)}
              className="bg-white rounded-2xl p-6 shadow-sm text-left hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-purple-200">
              <div className="text-4xl mb-3">{s.icono}</div>
              <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text)' }}>
                {s.titulo}
              </h3>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{s.descripcion}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
