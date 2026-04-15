import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Sala } from '../../types'

type Periodo = 'semana' | 'mes' | 'semestre'

interface AlumnoClase {
  id: number
  nombre: string
  puntosTotales: number
  materias: {
    id: number; nombre: string; color: string
    total: number; correctos: number; puntos: number
    porcentaje: number | null; percentil: number | null
  }[]
}

interface PerfilAlumno {
  alumno: { id: number; nombre: string; apellido: string; email_apoderado?: string }
  puntosTotales: number
  temas: { materia_id: number; materia: string; color: string; tema: string; total: number; correctos: number; puntos: number }[]
  errores: { titulo: string; tipo: string; materia: string; tema: string; creado_en: string }[]
  percentiles: Record<number, number>
}

const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: 'semana', etiqueta: 'Esta semana' },
  { valor: 'mes', etiqueta: 'Este mes' },
  { valor: 'semestre', etiqueta: 'Semestre' },
]

export default function Metricas() {
  const navigate = useNavigate()
  const [salas, setSalas] = useState<Sala[]>([])
  const [salaId, setSalaId] = useState<number | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [clase, setClase] = useState<AlumnoClase[]>([])
  const [perfil, setPerfil] = useState<PerfilAlumno | null>(null)
  const [cargando, setCargando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState('')

  useEffect(() => {
    api.get('/api/salas').then(r => {
      setSalas(r.data)
      if (r.data.length > 0) setSalaId(r.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (salaId) cargarClase()
  }, [salaId, periodo])

  async function cargarClase() {
    setCargando(true)
    try {
      const { data } = await api.get(`/api/metricas/clase/${salaId}?periodo=${periodo}`)
      setClase(data)
    } finally { setCargando(false) }
  }

  async function cargarPerfil(alumnoId: number) {
    const { data } = await api.get(`/api/metricas/alumno/${alumnoId}?salaId=${salaId}&periodo=${periodo}`)
    setPerfil(data)
  }

  async function enviarReporte() {
    if (!salaId) return
    setEnviando(true)
    try {
      const { data } = await api.post(`/api/metricas/reporte/${salaId}`)
      setExito(`✓ Reportes enviados a ${data.enviados} apoderados`)
      setTimeout(() => setExito(''), 4000)
    } catch {
      setExito('Error al enviar reportes')
      setTimeout(() => setExito(''), 3000)
    } finally { setEnviando(false) }
  }

  // Obtener todas las materias únicas de la clase
  const materiasUnicas = Array.from(
    new Map(clase.flatMap(a => a.materias).map(m => [m.id, m])).values()
  )

  function colorPct(pct: number | null) {
    if (pct === null) return '#e5e7eb'
    if (pct >= 70) return '#00B894'
    if (pct >= 50) return '#FDCB6E'
    return '#E17055'
  }

  function badgePercentil(p: number | null) {
    if (p === null) return null
    if (p >= 75) return { txt: `Top ${100 - p}%`, bg: '#d1fae5', color: '#065f46' }
    if (p >= 50) return { txt: `${p}° percentil`, bg: '#fef3c7', color: '#92400e' }
    return { txt: `${p}° percentil`, bg: '#fee2e2', color: '#991b1b' }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3" style={{ background: 'var(--primary)' }}>
        <button onClick={() => navigate('/profesora')} className="text-white cursor-pointer text-xl">←</button>
        <h1 className="text-xl font-bold text-white flex-1">Métricas</h1>
        {exito && <span className="text-sm bg-white/20 text-white px-3 py-1 rounded-full">{exito}</span>}
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select value={salaId || ''} onChange={e => setSalaId(Number(e.target.value))}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-purple-400">
            {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>

          <div className="flex bg-white rounded-xl border border-gray-200 overflow-hidden">
            {PERIODOS.map(p => (
              <button key={p.valor} onClick={() => setPeriodo(p.valor)}
                className="px-4 py-2 text-sm font-medium cursor-pointer transition-all"
                style={{
                  background: periodo === p.valor ? 'var(--primary)' : 'white',
                  color: periodo === p.valor ? 'white' : 'var(--muted)'
                }}>
                {p.etiqueta}
              </button>
            ))}
          </div>

          <button onClick={enviarReporte} disabled={enviando}
            className="ml-auto px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer border-2 transition-all"
            style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'white' }}>
            {enviando ? 'Enviando...' : '📧 Enviar reporte a apoderados'}
          </button>
        </div>

        {cargando ? (
          <div className="text-center py-16 text-gray-400">Cargando métricas...</div>
        ) : clase.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-gray-500">Aún no hay datos para este período.</p>
            <p className="text-gray-400 text-sm mt-1">Las métricas aparecen después de que los alumnos respondan ejercicios.</p>
          </div>
        ) : (
          <>
            {/* Tabla resumen clase */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-700">Resumen de la clase</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wide">
                      <th className="px-5 py-3 text-left">Alumno</th>
                      {materiasUnicas.map(m => (
                        <th key={m.id} className="px-4 py-3 text-center" style={{ color: m.color }}>{m.nombre}</th>
                      ))}
                      <th className="px-4 py-3 text-center">Puntos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clase.map(a => (
                      <tr key={a.id}
                        onClick={() => cargarPerfil(a.id)}
                        className="border-t border-gray-50 hover:bg-purple-50 cursor-pointer transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ background: 'var(--primary)' }}>
                              {a.nombre.split(' ')[0][0]}{a.nombre.split(' ')[1]?.[0] || ''}
                            </div>
                            <span className="font-medium text-sm text-gray-700">{a.nombre}</span>
                          </div>
                        </td>
                        {materiasUnicas.map(mat => {
                          const stats = a.materias.find(m => m.id === mat.id)
                          const pct = stats?.porcentaje ?? null
                          const perc = stats?.percentil ?? null
                          const badge = badgePercentil(perc)
                          return (
                            <td key={mat.id} className="px-4 py-3 text-center">
                              {pct !== null ? (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-sm font-bold" style={{ color: colorPct(pct) }}>{pct}%</span>
                                  {badge && (
                                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                                      style={{ background: badge.bg, color: badge.color }}>
                                      {badge.txt}
                                    </span>
                                  )}
                                </div>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-center font-bold text-sm" style={{ color: 'var(--primary)' }}>
                          {a.puntosTotales}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Panel perfil alumno */}
      {perfil && (
        <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="bg-white w-full md:max-w-2xl md:rounded-2xl shadow-2xl max-h-screen md:max-h-[90vh] flex flex-col">
            {/* Header perfil */}
            <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100 flex-shrink-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: 'var(--primary)' }}>
                {perfil.alumno.nombre[0]}{perfil.alumno.apellido[0]}
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-800">{perfil.alumno.nombre} {perfil.alumno.apellido}</p>
                <p className="text-sm font-bold" style={{ color: 'var(--primary)' }}>{perfil.puntosTotales} puntos totales</p>
              </div>
              <button onClick={() => setPerfil(null)} className="text-gray-400 hover:text-gray-600 cursor-pointer text-2xl">×</button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5">
              {/* Rendimiento por materia y tema */}
              {(() => {
                const materias = Array.from(new Map(perfil.temas.map(t => [t.materia_id, { id: t.materia_id, nombre: t.materia, color: t.color }])).values())
                return materias.map(mat => {
                  const temasMateria = perfil.temas.filter(t => t.materia_id === mat.id)
                  const totalMat = temasMateria.reduce((s, t) => s + Number(t.total), 0)
                  const correctosMat = temasMateria.reduce((s, t) => s + Number(t.correctos), 0)
                  const pctMat = totalMat > 0 ? Math.round((correctosMat / totalMat) * 100) : 0
                  const percentil = perfil.percentiles[mat.id]
                  const badge = badgePercentil(percentil ?? null)

                  return (
                    <div key={mat.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-sm" style={{ color: mat.color }}>{mat.nombre}</span>
                        <span className="text-sm font-bold" style={{ color: colorPct(pctMat) }}>{pctMat}%</span>
                        {badge && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: badge.bg, color: badge.color }}>{badge.txt}</span>
                        )}
                      </div>
                      {/* Barra general */}
                      <div className="h-2 bg-gray-100 rounded-full mb-3 overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pctMat}%`, background: mat.color }} />
                      </div>
                      {/* Temas */}
                      <div className="space-y-1.5 pl-2">
                        {temasMateria.map((t, i) => {
                          const pct = t.total > 0 ? Math.round((Number(t.correctos) / Number(t.total)) * 100) : 0
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 w-32 truncate">{t.tema}</span>
                              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colorPct(pct) }} />
                              </div>
                              <span className="text-xs font-semibold w-8 text-right" style={{ color: colorPct(pct) }}>{pct}%</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              })()}

              {/* Ejercicios incorrectos */}
              {perfil.errores.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-700 mb-3">Ejercicios incorrectos</h4>
                  <div className="space-y-2">
                    {perfil.errores.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 bg-red-50 rounded-xl px-4 py-2.5">
                        <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>
                        <div>
                          <p className="text-sm font-medium text-gray-700">{e.titulo}</p>
                          <p className="text-xs text-gray-400">{e.materia} · {e.tema}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
