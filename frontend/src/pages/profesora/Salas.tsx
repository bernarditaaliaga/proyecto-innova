import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Sala, Alumno } from '../../types'

type ModalAlumnoVista = 'elegir' | 'nuevo' | 'buscar'

export default function Salas() {
  const navigate = useNavigate()
  const [salas, setSalas] = useState<Sala[]>([])
  const [salaSeleccionada, setSalaSeleccionada] = useState<Sala | null>(null)
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [modalSala, setModalSala] = useState(false)
  const [modalAlumno, setModalAlumno] = useState(false)
  const [vistaAlumno, setVistaAlumno] = useState<ModalAlumnoVista>('elegir')
  const [formSala, setFormSala] = useState({ nombre: '', codigo: '' })
  const [formAlumno, setFormAlumno] = useState({ nombre: '', apellido: '', username: '', password: '', emailApoderado: '' })
  const [busqueda, setBusqueda] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Alumno[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const busquedaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { cargarSalas() }, [])

  async function cargarSalas() {
    try {
      const { data } = await api.get('/api/salas')
      console.log('[Salas] Salas cargadas:', data)
      setSalas(data)
    } catch (err) {
      console.error('[Salas] Error cargando salas:', err)
    }
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

  async function crearAlumnoNuevo(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await api.post('/api/alumnos', { ...formAlumno, salaId: salaSeleccionada?.id })
      setModalAlumno(false)
      setFormAlumno({ nombre: '', apellido: '', username: '', password: '', emailApoderado: '' })
      if (salaSeleccionada) cargarAlumnos(salaSeleccionada)
      cargarSalas()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Error al crear alumno')
    } finally { setCargando(false) }
  }

  async function añadirAlumnoExistente(alumno: Alumno) {
    if (!salaSeleccionada) return
    setCargando(true)
    try {
      await api.post(`/api/alumnos/${alumno.id}/salas/${salaSeleccionada.id}`)
      setModalAlumno(false)
      setBusqueda('')
      setResultadosBusqueda([])
      cargarAlumnos(salaSeleccionada)
      cargarSalas()
    } catch {
      setError('Error al añadir alumno')
    } finally { setCargando(false) }
  }

  async function quitarAlumno(alumnoId: number) {
    if (!salaSeleccionada) return
    await api.delete(`/api/alumnos/${alumnoId}/salas/${salaSeleccionada.id}`)
    cargarAlumnos(salaSeleccionada)
    cargarSalas()
  }

  function handleBusqueda(valor: string) {
    setBusqueda(valor)
    if (busquedaTimeout.current) clearTimeout(busquedaTimeout.current)
    busquedaTimeout.current = setTimeout(async () => {
      if (valor.length < 2) { setResultadosBusqueda([]); return }
      const { data } = await api.get(`/api/alumnos/buscar?q=${valor}`)
      // Filtrar los que ya están en la sala
      const yaEnSala = new Set(alumnos.map(a => a.id))
      setResultadosBusqueda(data.filter((a: Alumno) => !yaEnSala.has(a.id)))
    }, 300)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="px-6 py-4 flex items-center gap-4" style={{ background: 'var(--primary)' }}>
        <button onClick={() => navigate('/profesora')} className="text-white cursor-pointer">←</button>
        <h1 className="text-xl font-bold text-white">Mis Salas</h1>
        <button onClick={() => { setModalSala(true); setError('') }}
          className="ml-auto bg-white/20 hover:bg-white/30 text-white text-sm px-4 py-2 rounded-xl cursor-pointer">
          + Nueva sala
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-6 grid md:grid-cols-2 gap-6">
        {/* Salas */}
        <div>
          <h2 className="font-bold text-lg mb-3" style={{ color: 'var(--text)' }}>Salas</h2>
          {salas.length === 0 && (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400">No tienes salas aún.</div>
          )}
          <div className="space-y-3">
            {salas.map(sala => (
              <button key={sala.id} onClick={() => cargarAlumnos(sala)}
                className="w-full text-left bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer border-2"
                style={{ borderColor: salaSeleccionada?.id === sala.id ? 'var(--primary)' : 'transparent' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold" style={{ color: 'var(--text)' }}>{sala.nombre}</p>
                    <p className="text-sm text-gray-400">Código: {sala.codigo} · {sala.total_alumnos} alumnos</p>
                  </div>
                  <span className="text-2xl">🏫</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Alumnos */}
        {salaSeleccionada && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
                {salaSeleccionada.nombre}
              </h2>
              <button onClick={() => { setModalAlumno(true); setVistaAlumno('elegir'); setError('') }}
                className="text-sm px-3 py-1.5 rounded-xl text-white cursor-pointer"
                style={{ background: 'var(--primary)' }}>
                + Alumno
              </button>
            </div>
            {alumnos.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400">No hay alumnos en esta sala.</div>
            )}
            <div className="space-y-2">
              {alumnos.map(a => (
                <div key={a.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: 'var(--primary)' }}>
                    {a.nombre[0]}{a.apellido[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{a.nombre} {a.apellido}</p>
                    <p className="text-xs text-gray-400">@{a.username}</p>
                  </div>
                  <button onClick={() => quitarAlumno(a.id)}
                    className="text-gray-300 hover:text-red-400 cursor-pointer text-lg">×</button>
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
            <Campo label="Nombre" placeholder="3ro A" value={formSala.nombre}
              onChange={v => setFormSala(f => ({ ...f, nombre: v }))} />
            <Campo label="Código único" placeholder="3A-2024" value={formSala.codigo}
              onChange={v => setFormSala(f => ({ ...f, codigo: v }))} />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <BtnSubmit cargando={cargando} texto="Crear sala" />
          </form>
        </Modal>
      )}

      {/* Modal añadir alumno */}
      {modalAlumno && (
        <Modal titulo={`Añadir alumno — ${salaSeleccionada?.nombre}`} onClose={() => { setModalAlumno(false); setBusqueda(''); setResultadosBusqueda([]) }}>

          {vistaAlumno === 'elegir' && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setVistaAlumno('nuevo')}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50 cursor-pointer transition-all">
                <span className="text-3xl">➕</span>
                <span className="text-sm font-semibold text-gray-700">Alumno nuevo</span>
                <span className="text-xs text-gray-400 text-center">Crear cuenta nueva</span>
              </button>
              <button onClick={() => setVistaAlumno('buscar')}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50 cursor-pointer transition-all">
                <span className="text-3xl">🔍</span>
                <span className="text-sm font-semibold text-gray-700">Ya registrado</span>
                <span className="text-xs text-gray-400 text-center">Buscar y añadir</span>
              </button>
            </div>
          )}

          {vistaAlumno === 'buscar' && (
            <div className="space-y-4">
              <button onClick={() => setVistaAlumno('elegir')} className="text-sm text-gray-400 cursor-pointer">← Volver</button>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Buscar por nombre o usuario</label>
                <input type="text" value={busqueda} onChange={e => handleBusqueda(e.target.value)}
                  placeholder="ej: María González"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
              </div>
              {resultadosBusqueda.length === 0 && busqueda.length >= 2 && (
                <p className="text-sm text-gray-400 text-center">No se encontraron alumnos</p>
              )}
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {resultadosBusqueda.map(a => (
                  <button key={a.id} onClick={() => añadirAlumnoExistente(a)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-purple-300 hover:bg-purple-50 cursor-pointer transition-all text-left">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: 'var(--primary)' }}>
                      {a.nombre[0]}{a.apellido[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-700">{a.nombre} {a.apellido}</p>
                      <p className="text-xs text-gray-400">@{a.username}</p>
                    </div>
                    <span className="ml-auto text-purple-400 text-sm">Añadir →</span>
                  </button>
                ))}
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
          )}

          {vistaAlumno === 'nuevo' && (
            <form onSubmit={crearAlumnoNuevo} className="space-y-4">
              <button type="button" onClick={() => setVistaAlumno('elegir')} className="text-sm text-gray-400 cursor-pointer">← Volver</button>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Nombre" placeholder="María" value={formAlumno.nombre}
                  onChange={v => setFormAlumno(f => ({ ...f, nombre: v }))} />
                <Campo label="Apellido" placeholder="González" value={formAlumno.apellido}
                  onChange={v => setFormAlumno(f => ({ ...f, apellido: v }))} />
              </div>
              <Campo label="Usuario" placeholder="mgonzalez" value={formAlumno.username}
                onChange={v => setFormAlumno(f => ({ ...f, username: v }))} />
              <Campo label="Contraseña" placeholder="••••••" tipo="password" value={formAlumno.password}
                onChange={v => setFormAlumno(f => ({ ...f, password: v }))} />
              <Campo label="Email apoderado (opcional)" placeholder="apoderado@mail.com" value={formAlumno.emailApoderado}
                onChange={v => setFormAlumno(f => ({ ...f, emailApoderado: v }))} />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <BtnSubmit cargando={cargando} texto="Crear y añadir a la sala" />
            </form>
          )}
        </Modal>
      )}
    </div>
  )
}

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
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
  label: string; placeholder: string; value: string; onChange: (v: string) => void; tipo?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
      <input type={tipo} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required
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
