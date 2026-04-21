import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Planificacion, Sala, Materia } from '../../types'

export default function Planificaciones() {
  const navigate = useNavigate()
  const [planificaciones, setPlanificaciones] = useState<Planificacion[]>([])
  const [salas, setSalas] = useState<Sala[]>([])
  const [materias, setMaterias] = useState<Materia[]>([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ titulo: '', salaId: '', materiaId: '', fecha: '', horaInicio: '', duracionMinutos: '45' })
  const [temaIdsSeleccionados, setTemaIdsSeleccionados] = useState<number[]>([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [cargandoInicial, setCargandoInicial] = useState(true)

  useEffect(() => {
    cargar()
  }, [])

  async function cargar(reintentos = 2) {
    try {
      setCargandoInicial(true)
      const p = await api.get('/api/planificaciones').catch(e => { console.error('[Plan] Error planificaciones:', e); return { data: [] } })
      const s = await api.get('/api/salas').catch(e => { console.error('[Plan] Error salas:', e); return { data: [] } })
      const m = await api.get('/api/materias').catch(e => { console.error('[Plan] Error materias:', e); return { data: [] } })
      console.log('[Plan] planificaciones:', p.data.length, 'salas:', s.data.length, 'materias:', m.data.length)
      setPlanificaciones(p.data)
      setSalas(s.data)
      setMaterias(m.data)
      // Si todo vino vacío y hay reintentos, reintentar (cold start de Railway)
      if (p.data.length === 0 && s.data.length === 0 && reintentos > 0) {
        console.log(`[Plan] Todo vacío, reintentando... (${reintentos})`)
        await new Promise(r => setTimeout(r, 2000))
        return cargar(reintentos - 1)
      }
    } catch (e) {
      console.error('[Plan] Error general cargando:', e)
      if (reintentos > 0) {
        await new Promise(r => setTimeout(r, 2000))
        return cargar(reintentos - 1)
      }
    } finally {
      setCargandoInicial(false)
    }
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      const { data } = await api.post('/api/planificaciones', {
        titulo: form.titulo,
        salaId: Number(form.salaId),
        materiaId: Number(form.materiaId),
        fecha: form.fecha || null,
        horaInicio: form.horaInicio || null,
        duracionMinutos: form.duracionMinutos ? Number(form.duracionMinutos) : 45,
        temaIds: temaIdsSeleccionados
      })
      setModal(false)
      setForm({ titulo: '', salaId: '', materiaId: '', fecha: '', horaInicio: '', duracionMinutos: '45' })
      setTemaIdsSeleccionados([])
      navigate(`/profesora/planificaciones/${data.id}`)
    } catch {
      setError('Error al crear planificación')
    } finally {
      setCargando(false)
    }
  }

  const coloresBadge: Record<string, string> = {
    'Matemáticas': '#E74C3C',
    'Lenguaje': '#3498DB',
    'Ciencias': '#2ECC71'
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="px-6 py-4 flex items-center gap-4" style={{ background: 'var(--primary)' }}>
        <button onClick={() => navigate('/profesora')} className="text-white cursor-pointer text-xl">←</button>
        <h1 className="text-xl font-bold text-white">Planificaciones</h1>
        <button onClick={() => { setModal(true); setError('') }}
          className="ml-auto bg-white/20 hover:bg-white/30 text-white text-sm px-4 py-2 rounded-xl cursor-pointer">
          + Nueva
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {cargandoInicial ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <div className="flex justify-center gap-2 mb-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-3 h-3 bg-purple-300 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            <p className="text-gray-400">Cargando planificaciones...</p>
          </div>
        ) : planificaciones.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-500">No tienes planificaciones aún.</p>
            <button onClick={() => setModal(true)}
              className="mt-4 px-6 py-2 rounded-xl text-white font-semibold cursor-pointer"
              style={{ background: 'var(--primary)' }}>
              Crear primera planificación
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {planificaciones.map(p => (
              <button key={p.id}
                onClick={() => navigate(`/profesora/planificaciones/${p.id}`)}
                className="bg-white rounded-2xl p-5 shadow-sm text-left hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-purple-200 w-full">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ background: coloresBadge[p.materia] || 'var(--primary)' }}>
                        {p.materia}
                      </span>
                      <span className="text-xs text-gray-400">{p.sala}</span>
                    </div>
                    <h3 className="font-bold text-gray-800">{p.titulo}</h3>
                    {p.fecha && (
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(p.fecha).toLocaleDateString('es-CL')}
                      </p>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                      {p.total_ejercicios}
                    </p>
                    <p className="text-xs text-gray-400">ejercicios</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Nueva planificación</h3>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">×</button>
            </div>
            <form onSubmit={crear} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Título</label>
                <input type="text" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="ej: Fracciones - Clase 3" required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Sala</label>
                <select value={form.salaId} onChange={e => setForm(f => ({ ...f, salaId: e.target.value }))} required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700">
                  <option value="">Selecciona una sala</option>
                  {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Materia</label>
                <select value={form.materiaId} onChange={e => setForm(f => ({ ...f, materiaId: e.target.value }))} required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700">
                  <option value="">Selecciona una materia</option>
                  {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
                {form.salaId && materias.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No hay materias disponibles. Agrega materias a esta sala desde Mis Salas.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Fecha (opcional)</label>
                <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Hora inicio</label>
                  <input type="time" value={form.horaInicio} onChange={e => setForm(f => ({ ...f, horaInicio: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Duración (min)</label>
                  <select value={form.duracionMinutos} onChange={e => setForm(f => ({ ...f, duracionMinutos: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700">
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">1 hora</option>
                    <option value="90">1.5 horas</option>
                    <option value="120">2 horas</option>
                  </select>
                </div>
              </div>

              {/* Temas de la clase */}
              {form.materiaId && (() => {
                const temasMateria = materias.find(m => m.id === Number(form.materiaId))?.temas || []
                return temasMateria.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">
                      Temas que se verán en esta clase
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {temasMateria.map(t => {
                        const sel = temaIdsSeleccionados.includes(t.id)
                        return (
                          <button key={t.id} type="button"
                            onClick={() => setTemaIdsSeleccionados(ids =>
                              sel ? ids.filter(i => i !== t.id) : [...ids, t.id]
                            )}
                            className="px-3 py-1.5 rounded-full text-sm font-medium border-2 cursor-pointer transition-all"
                            style={{
                              borderColor: sel ? 'var(--primary)' : '#e5e7eb',
                              background: sel ? '#f0efff' : 'white',
                              color: sel ? 'var(--primary)' : '#6b7280'
                            }}>
                            {t.nombre}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : null
              })()}

              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={cargando}
                className="w-full py-3 rounded-xl font-bold text-white cursor-pointer"
                style={{ background: cargando ? '#a29bfe' : 'var(--primary)' }}>
                {cargando ? 'Creando...' : 'Crear y agregar ejercicios →'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
