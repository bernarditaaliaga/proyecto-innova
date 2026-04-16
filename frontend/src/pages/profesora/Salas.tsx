import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Sala, Alumno } from '../../types'

type ModalAlumnoVista = 'elegir' | 'nuevo' | 'buscar'

interface Profesora {
  id: number
  nombre: string
  email: string
  rol: 'jefe' | 'materia'
}

export default function Salas() {
  const navigate = useNavigate()
  const [salas, setSalas] = useState<Sala[]>([])
  const [salaSeleccionada, setSalaSeleccionada] = useState<Sala | null>(null)
  const [alumnos, setAlumnos] = useState<Alumno[]>([])
  const [profesoras, setProfesoras] = useState<Profesora[]>([])
  const [modalSala, setModalSala] = useState(false)
  const [modalUnirse, setModalUnirse] = useState(false)
  const [modalAlumno, setModalAlumno] = useState(false)
  const [modalPerfil, setModalPerfil] = useState<Alumno | null>(null)
  const [vistaAlumno, setVistaAlumno] = useState<ModalAlumnoVista>('elegir')
  const [formSala, setFormSala] = useState({ nombre: '', codigo: '' })
  const [codigoUnirse, setCodigoUnirse] = useState('')
  const [formAlumno, setFormAlumno] = useState({
    nombre: '', apellido: '', username: '', password: '',
    emailApoderado: '', genero: '', nombrePadre: '', nombreMadre: ''
  })
  const [formPerfil, setFormPerfil] = useState({
    nombre: '', apellido: '', emailApoderado: '', genero: '',
    nombrePadre: '', nombreMadre: '', password: ''
  })
  const [busqueda, setBusqueda] = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState<Alumno[]>([])
  const [cargando, setCargando] = useState(false)
  const [cargandoInicial, setCargandoInicial] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'alumnos' | 'profesoras'>('alumnos')
  const busquedaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const esJefe = salaSeleccionada?.rol === 'jefe'

  useEffect(() => { cargarSalas() }, [])

  async function cargarSalas(reintentos = 2) {
    try {
      setCargandoInicial(true)
      const { data } = await api.get('/api/salas')
      setSalas(data)
    } catch (err) {
      console.error('[Salas] Error cargando salas:', err)
      if (reintentos > 0) {
        await new Promise(r => setTimeout(r, 2000))
        return cargarSalas(reintentos - 1)
      }
    } finally {
      setCargandoInicial(false)
    }
  }

  async function cargarAlumnos(sala: Sala) {
    setSalaSeleccionada(sala)
    setTab('alumnos')
    const { data } = await api.get(`/api/salas/${sala.id}/alumnos`)
    setAlumnos(data)
  }

  async function cargarProfesoras(salaId: number) {
    const { data } = await api.get(`/api/salas/${salaId}/profesoras`)
    setProfesoras(data)
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

  async function unirseConCodigo(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await api.post('/api/salas/unirse', { codigo: codigoUnirse })
      setModalUnirse(false)
      setCodigoUnirse('')
      cargarSalas()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Error al unirse')
    } finally { setCargando(false) }
  }

  async function salirDeSala(salaId: number) {
    if (!confirm('¿Segura que quieres salir de esta sala?')) return
    try {
      await api.delete(`/api/salas/${salaId}/salir`)
      setSalaSeleccionada(null)
      cargarSalas()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      alert(e.response?.data?.error || 'Error al salir')
    }
  }

  async function crearAlumnoNuevo(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await api.post('/api/alumnos', { ...formAlumno, salaId: salaSeleccionada?.id })
      setModalAlumno(false)
      setFormAlumno({ nombre: '', apellido: '', username: '', password: '', emailApoderado: '', genero: '', nombrePadre: '', nombreMadre: '' })
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

  function abrirPerfil(alumno: Alumno) {
    setFormPerfil({
      nombre: alumno.nombre,
      apellido: alumno.apellido,
      emailApoderado: alumno.email_apoderado || '',
      genero: alumno.genero || '',
      nombrePadre: alumno.nombre_padre || '',
      nombreMadre: alumno.nombre_madre || '',
      password: ''
    })
    setModalPerfil(alumno)
    setError('')
  }

  async function guardarPerfil(e: React.FormEvent) {
    e.preventDefault()
    if (!modalPerfil) return
    setError('')
    setCargando(true)
    try {
      await api.put(`/api/alumnos/${modalPerfil.id}`, formPerfil)
      setModalPerfil(null)
      if (salaSeleccionada) cargarAlumnos(salaSeleccionada)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Error al guardar perfil')
    } finally { setCargando(false) }
  }

  function handleBusqueda(valor: string) {
    setBusqueda(valor)
    if (busquedaTimeout.current) clearTimeout(busquedaTimeout.current)
    busquedaTimeout.current = setTimeout(async () => {
      if (valor.length < 2) { setResultadosBusqueda([]); return }
      const { data } = await api.get(`/api/alumnos/buscar?q=${valor}`)
      const yaEnSala = new Set(alumnos.map(a => a.id))
      setResultadosBusqueda(data.filter((a: Alumno) => !yaEnSala.has(a.id)))
    }, 300)
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="px-6 py-4 flex items-center gap-4" style={{ background: 'var(--primary)' }}>
        <button onClick={() => navigate('/profesora')} className="text-white cursor-pointer">←</button>
        <h1 className="text-xl font-bold text-white">Mis Salas</h1>
        <div className="ml-auto flex gap-2">
          <button onClick={() => { setModalUnirse(true); setError('') }}
            className="bg-white/20 hover:bg-white/30 text-white text-sm px-4 py-2 rounded-xl cursor-pointer">
            Unirse con código
          </button>
          <button onClick={() => { setModalSala(true); setError('') }}
            className="bg-white/20 hover:bg-white/30 text-white text-sm px-4 py-2 rounded-xl cursor-pointer">
            + Nueva sala
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 grid md:grid-cols-2 gap-6">
        {/* Salas */}
        <div>
          <h2 className="font-bold text-lg mb-3" style={{ color: 'var(--text)' }}>Salas</h2>
          {cargandoInicial && salas.length === 0 && (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
              <div className="flex justify-center gap-2 mb-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-purple-300 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
              Cargando salas...
            </div>
          )}
          {!cargandoInicial && salas.length === 0 && (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400">No tienes salas aún.</div>
          )}
          <div className="space-y-3">
            {salas.map(sala => (
              <button key={sala.id} onClick={() => cargarAlumnos(sala)}
                className="w-full text-left bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer border-2"
                style={{ borderColor: salaSeleccionada?.id === sala.id ? 'var(--primary)' : 'transparent' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold" style={{ color: 'var(--text)' }}>{sala.nombre}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        sala.rol === 'jefe'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {sala.rol === 'jefe' ? 'Jefe' : 'Materia'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">Código: {sala.codigo} · {sala.total_alumnos} alumnos</p>
                  </div>
                  <span className="text-2xl">{sala.rol === 'jefe' ? '👑' : '📚'}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Panel derecho: Alumnos y Profesoras */}
        {salaSeleccionada && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
                {salaSeleccionada.nombre}
              </h2>
              <div className="flex gap-2">
                {salaSeleccionada.rol === 'materia' && (
                  <button onClick={() => salirDeSala(salaSeleccionada.id)}
                    className="text-xs px-3 py-1.5 rounded-xl text-red-500 border border-red-200 hover:bg-red-50 cursor-pointer">
                    Salir
                  </button>
                )}
                {esJefe && (
                  <button onClick={() => { setModalAlumno(true); setVistaAlumno('elegir'); setError('') }}
                    className="text-sm px-3 py-1.5 rounded-xl text-white cursor-pointer"
                    style={{ background: 'var(--primary)' }}>
                    + Alumno
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-3 bg-gray-100 rounded-xl p-1">
              <button onClick={() => setTab('alumnos')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg cursor-pointer transition-all ${
                  tab === 'alumnos' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-400'
                }`}>
                Alumnos ({alumnos.length})
              </button>
              <button onClick={() => { setTab('profesoras'); cargarProfesoras(salaSeleccionada.id) }}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg cursor-pointer transition-all ${
                  tab === 'profesoras' ? 'bg-white shadow-sm text-purple-700' : 'text-gray-400'
                }`}>
                Profesores
              </button>
            </div>

            {tab === 'alumnos' && (
              <>
                {alumnos.length === 0 && (
                  <div className="bg-white rounded-2xl p-8 text-center text-gray-400">No hay alumnos en esta sala.</div>
                )}
                <div className="space-y-2">
                  {alumnos.map(a => (
                    <div key={a.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ background: a.genero === 'F' ? '#e84393' : a.genero === 'M' ? '#0984e3' : 'var(--primary)' }}>
                        {a.nombre[0]}{a.apellido[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{a.nombre} {a.apellido}</p>
                        <p className="text-xs text-gray-400">@{a.username}</p>
                      </div>
                      {esJefe && (
                        <>
                          <button onClick={() => abrirPerfil(a)}
                            className="text-gray-300 hover:text-purple-500 cursor-pointer text-sm" title="Editar perfil">
                            ✏️
                          </button>
                          <button onClick={() => quitarAlumno(a.id)}
                            className="text-gray-300 hover:text-red-400 cursor-pointer text-lg">×</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {tab === 'profesoras' && (
              <div className="space-y-2">
                {profesoras.length === 0 && (
                  <div className="bg-white rounded-2xl p-8 text-center text-gray-400">Cargando...</div>
                )}
                {profesoras.map(p => (
                  <div key={p.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold bg-purple-500">
                      {p.nombre[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{p.nombre}</p>
                      <p className="text-xs text-gray-400">{p.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      p.rol === 'jefe' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {p.rol === 'jefe' ? 'Jefe' : 'Materia'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal crear sala */}
      {modalSala && (
        <Modal titulo="Nueva Sala" onClose={() => setModalSala(false)}>
          <p className="text-sm text-gray-400 mb-4">Serás profesor jefe de esta sala.</p>
          <form onSubmit={crearSala} className="space-y-4">
            <Campo label="Nombre" placeholder="3ro A" value={formSala.nombre}
              onChange={v => setFormSala(f => ({ ...f, nombre: v }))} />
            <Campo label="Código único" placeholder="3A-2026" value={formSala.codigo}
              onChange={v => setFormSala(f => ({ ...f, codigo: v }))} />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <BtnSubmit cargando={cargando} texto="Crear sala" />
          </form>
        </Modal>
      )}

      {/* Modal unirse con código */}
      {modalUnirse && (
        <Modal titulo="Unirse a sala" onClose={() => setModalUnirse(false)}>
          <p className="text-sm text-gray-400 mb-4">Ingresa el código de la sala para unirte como profesor de materia.</p>
          <form onSubmit={unirseConCodigo} className="space-y-4">
            <Campo label="Código de sala" placeholder="3A-2026" value={codigoUnirse}
              onChange={v => setCodigoUnirse(v)} />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <BtnSubmit cargando={cargando} texto="Unirse" />
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
                <span className="text-3xl">+</span>
                <span className="text-sm font-semibold text-gray-700">Alumno nuevo</span>
                <span className="text-xs text-gray-400 text-center">Crear cuenta nueva</span>
              </button>
              <button onClick={() => setVistaAlumno('buscar')}
                className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50 cursor-pointer transition-all">
                <span className="text-3xl">?</span>
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
                    <span className="ml-auto text-purple-400 text-sm">Añadir</span>
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
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Género</label>
                <div className="flex gap-3">
                  {[{ v: 'M', l: 'Masculino' }, { v: 'F', l: 'Femenino' }].map(g => (
                    <button key={g.v} type="button" onClick={() => setFormAlumno(f => ({ ...f, genero: f.genero === g.v ? '' : g.v }))}
                      className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold cursor-pointer transition-all ${
                        formAlumno.genero === g.v ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-400'
                      }`}>
                      {g.l}
                    </button>
                  ))}
                </div>
              </div>
              <Campo label="Nombre padre (opcional)" placeholder="" value={formAlumno.nombrePadre} required={false}
                onChange={v => setFormAlumno(f => ({ ...f, nombrePadre: v }))} />
              <Campo label="Nombre madre (opcional)" placeholder="" value={formAlumno.nombreMadre} required={false}
                onChange={v => setFormAlumno(f => ({ ...f, nombreMadre: v }))} />
              <Campo label="Email apoderado (opcional)" placeholder="apoderado@mail.com" value={formAlumno.emailApoderado} required={false}
                onChange={v => setFormAlumno(f => ({ ...f, emailApoderado: v }))} />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <BtnSubmit cargando={cargando} texto="Crear y añadir a la sala" />
            </form>
          )}
        </Modal>
      )}

      {/* Modal editar perfil alumno */}
      {modalPerfil && (
        <Modal titulo={`Perfil — ${modalPerfil.nombre} ${modalPerfil.apellido}`} onClose={() => setModalPerfil(null)}>
          <form onSubmit={guardarPerfil} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nombre" placeholder="" value={formPerfil.nombre}
                onChange={v => setFormPerfil(f => ({ ...f, nombre: v }))} />
              <Campo label="Apellido" placeholder="" value={formPerfil.apellido}
                onChange={v => setFormPerfil(f => ({ ...f, apellido: v }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Género</label>
              <div className="flex gap-3">
                {[{ v: 'M', l: 'Masculino' }, { v: 'F', l: 'Femenino' }].map(g => (
                  <button key={g.v} type="button" onClick={() => setFormPerfil(f => ({ ...f, genero: f.genero === g.v ? '' : g.v }))}
                    className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold cursor-pointer transition-all ${
                      formPerfil.genero === g.v ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-400'
                    }`}>
                    {g.l}
                  </button>
                ))}
              </div>
            </div>
            <Campo label="Nombre padre" placeholder="" value={formPerfil.nombrePadre} required={false}
              onChange={v => setFormPerfil(f => ({ ...f, nombrePadre: v }))} />
            <Campo label="Nombre madre" placeholder="" value={formPerfil.nombreMadre} required={false}
              onChange={v => setFormPerfil(f => ({ ...f, nombreMadre: v }))} />
            <Campo label="Email apoderado" placeholder="apoderado@mail.com" value={formPerfil.emailApoderado} required={false}
              onChange={v => setFormPerfil(f => ({ ...f, emailApoderado: v }))} />
            <Campo label="Nueva contraseña (dejar vacío para no cambiar)" placeholder="" value={formPerfil.password} required={false} tipo="password"
              onChange={v => setFormPerfil(f => ({ ...f, password: v }))} />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <BtnSubmit cargando={cargando} texto="Guardar cambios" />
          </form>
        </Modal>
      )}
    </div>
  )
}

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-0 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>{titulo}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 cursor-pointer text-2xl font-bold leading-none">×</button>
        </div>
        <div className="p-6 pt-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

function Campo({ label, placeholder, value, onChange, tipo = 'text', required = true }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; tipo?: string; required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
      <input type={tipo} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
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
