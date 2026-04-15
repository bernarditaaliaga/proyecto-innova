import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Sala, Alumno } from '../../types'

export default function Salas() {
  const navigate = useNavigate()
  const [salas, setSalas] = useState<Sala[]>([])
  const [salaSeleccionada, setSalaSeleccionada] = useState<Sala | null>(null)
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [modalSala, setModalSala] = useState(false)
  const [modalAlumno, setModalAlumno] = useState(false)
  const [formSala, setFormSala] = useState({ nombre: '', codigo: '' })
  const [formAlumno, setFormAlumno] = useState({
    nombre: '', apellido: '', username: '', password: '', emailApoderado: ''
  })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { cargarSalas() }, [])

  async function cargarSalas() {
    const { data } = await api.get('/api/salas')
    setSalas(data)
  }

  async function cargarAlumnos(sala: Sala) {
    setSalaSeleccionada(sala)
    const { data } = await api.get(`/api/salas/${sala.id}/alumnos`)
    setAlumnos(data)
  }

  async function crearSala(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await api.post('/api/salas', formSala)
      setModalSala(false)
      setFormSala({ nombre: '', codigo: '' })
      cargarSalas()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Error al crear sala')
    } finally { setCargando(false) }
  }

  async function crearAlumno(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await api.post('/api/alumnos', {
        ...formAlumno,
        salaId: salaSeleccionada?.id
      })
      setModalAlumno(false)
      setFormAlumno({ nombre: '', apellido: '', username: '', password: '', emailApoderado: '' })
      if (salaSeleccionada) cargarAlumnos(salaSeleccionada)
      cargarSalas()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Error al crear alumno')
    } finally { setCargando(false) }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4" style={{ background: 'var(--primary)' }}>
        <button onClick={() => navigate('/profesora')} className="text-white cursor-pointer">←</button>
        <h1 className="text-xl font-bold text-white">Mis Salas</h1>
        <button onClick={() => { setModalSala(true); setError('') }}
          className="ml-auto bg-white/20 hover:bg-white/30 text-white text-sm px-4 py-2 rounded-xl cursor-pointer">
          + Nueva sala
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-6 grid md:grid-cols-2 gap-6">
        {/* Lista de salas */}
        <div>
          <h2 className="font-bold text-lg mb-3" style={{ color: 'var(--text)' }}>Salas</h2>
          {salas.length === 0 && (
            <div className="bg-white rounded-2xl p-8 text-center" style={{ color: 'var(--muted)' }}>
              No tienes salas aún. Crea una para empezar.
            </div>
          )}
          <div className="space-y-3">
            {salas.map(sala => (
              <button key={sala.id} onClick={() => cargarAlumnos(sala)}
                className="w-full text-left bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer border-2"
                style={{ borderColor: salaSeleccionada?.id === sala.id ? 'var(--primary)' : 'transparent' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold" style={{ color: 'var(--text)' }}>{sala.nombre}</p>
                    <p className="text-sm" style={{ color: 'var(--muted)' }}>
                      Código: {sala.codigo} · {sala.total_alumnos} alumnos
                    </p>
                  </div>
                  <span className="text-2xl">🏫</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Lista de alumnos */}
        {salaSeleccionada && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
                Alumnos — {salaSeleccionada.nombre}
              </h2>
              <button onClick={() => { setModalAlumno(true); setError('') }}
                className="text-sm px-3 py-1.5 rounded-xl text-white cursor-pointer"
                style={{ background: 'var(--primary)' }}>
                + Alumno
              </button>
            </div>
            {alumnos.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center" style={{ color: 'var(--muted)' }}>
                No hay alumnos en esta sala.
              </div>
            )}
            <div className="space-y-2">
              {alumnos.map(a => (
                <div key={a.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: 'var(--primary)' }}>
                    {a.nombre[0]}{a.apellido[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                      {a.nombre} {a.apellido}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      @{a.username}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal crear sala */}
      {modalSala && (
        <Modal titulo="Nueva Sala" onClose={() => setModalSala(false)}>
          <form onSubmit={crearSala} className="space-y-4">
            <Campo label="Nombre" placeholder="3ro A"
              value={formSala.nombre} onChange={v => setFormSala(f => ({ ...f, nombre: v }))} />
            <Campo label="Código único" placeholder="3A-2024"
              value={formSala.codigo} onChange={v => setFormSala(f => ({ ...f, codigo: v }))} />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <BtnSubmit cargando={cargando} texto="Crear sala" />
          </form>
        </Modal>
      )}

      {/* Modal crear alumno */}
      {modalAlumno && (
        <Modal titulo={`Nuevo alumno — ${salaSeleccionada?.nombre}`} onClose={() => setModalAlumno(false)}>
          <form onSubmit={crearAlumno} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nombre" placeholder="María"
                value={formAlumno.nombre} onChange={v => setFormAlumno(f => ({ ...f, nombre: v }))} />
              <Campo label="Apellido" placeholder="González"
                value={formAlumno.apellido} onChange={v => setFormAlumno(f => ({ ...f, apellido: v }))} />
            </div>
            <Campo label="Usuario (para login)" placeholder="mgonzalez"
              value={formAlumno.username} onChange={v => setFormAlumno(f => ({ ...f, username: v }))} />
            <Campo label="Contraseña" placeholder="••••••" tipo="password"
              value={formAlumno.password} onChange={v => setFormAlumno(f => ({ ...f, password: v }))} />
            <Campo label="Email apoderado (opcional)" placeholder="apoderado@mail.com"
              value={formAlumno.emailApoderado} onChange={v => setFormAlumno(f => ({ ...f, emailApoderado: v }))} />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <BtnSubmit cargando={cargando} texto="Crear alumno" />
          </form>
        </Modal>
      )}
    </div>
  )
}

function Modal({ titulo, onClose, children }: {
  titulo: string; onClose: () => void; children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>{titulo}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Campo({ label, placeholder, value, onChange, tipo = 'text' }: {
  label: string; placeholder: string; value: string
  onChange: (v: string) => void; tipo?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
      <input type={tipo} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
    </div>
  )
}

function BtnSubmit({ cargando, texto }: { cargando: boolean; texto: string }) {
  return (
    <button type="submit" disabled={cargando}
      className="w-full py-3 rounded-xl font-bold text-white cursor-pointer"
      style={{ background: cargando ? '#a29bfe' : 'var(--primary)' }}>
      {cargando ? 'Guardando...' : texto}
    </button>
  )
}
