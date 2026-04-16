import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Sala } from '../../types'

type Periodo = 'semana' | 'mes' | 'semestre'
type Vista = 'resumen' | 'tabla' | 'materia' | 'alumno'

interface MateriaStats {
  id: number; nombre: string; color: string
  total: number; correctos: number; puntos: number
  porcentaje: number | null; percentil: number | null
}

interface AlumnoClase {
  id: number
  nombre: string
  genero: string | null
  puntosTotales: number
  materias: MateriaStats[]
}

interface ResumenMateria {
  id: number; nombre: string; color: string
  totalAlumnos: number; totalEjercicios: number; correctos: number
  puntos: number; porcentaje: number; tiempoPromedio: number | null
}

interface AlumnoMateria {
  id: number; nombre: string; genero: string | null
  total: number; correctos: number; puntos: number; porcentaje: number
  temas: { nombre: string; total: number; correctos: number; porcentaje: number }[]
}

interface PerfilAlumno {
  alumno: { id: number; nombre: string; apellido: string; email_apoderado?: string; genero?: string; nombre_padre?: string; nombre_madre?: string }
  rol: string | null
  puntosTotales: number
  temas: { materia_id: number; materia: string; color: string; tema: string; total: number; correctos: number; puntos: number }[]
  errores: { titulo: string; tipo: string; materia: string; tema: string; creado_en: string }[]
  historial: { titulo: string; materia: string; color: string; es_correcto: boolean; puntos_obtenidos: number; tiempo_segundos: number; creado_en: string }[]
  percentiles: Record<number, number>
}

const PERIODOS: { valor: Periodo; etiqueta: string }[] = [
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'semestre', etiqueta: 'Semestre' },
]

export default function Metricas() {
  const navigate = useNavigate()
  const [salas, setSalas] = useState<Sala[]>([])
  const [salaId, setSalaId] = useState<number | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [vista, setVista] = useState<Vista>('resumen')
  const [rol, setRol] = useState<'jefe' | 'materia' | null>(null)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState('')

  // Data states
  const [resumenMaterias, setResumenMaterias] = useState<ResumenMateria[]>([])
  const [clase, setClase] = useState<AlumnoClase[]>([])
  const [materiaDetalle, setMateriaDetalle] = useState<{ materia: ResumenMateria; alumnos: AlumnoMateria[] } | null>(null)
  const [perfil, setPerfil] = useState<PerfilAlumno | null>(null)

  useEffect(() => {
    api.get('/api/salas').then(r => {
      const salasData = r.data || []
      setSalas(salasData)
      if (salasData.length > 0) setSalaId(salasData[0].id)
      else setCargando(false)
    }).catch(() => setCargando(false))
  }, [])

  useEffect(() => {
    if (salaId) {
      setVista('resumen')
      setMateriaDetalle(null)
      setPerfil(null)
      cargarResumen()
      cargarClase()
    }
  }, [salaId, periodo])

  async function cargarResumen() {
    try {
      const { data } = await api.get(`/api/metricas/resumen-materias/${salaId}?periodo=${periodo}`)
      setResumenMaterias(data?.materias || [])
      if (data?.rol) setRol(data.rol)
    } catch (err) {
      console.error('[Metricas] Error cargando resumen:', err)
      setResumenMaterias([])
    }
  }

  async function cargarClase() {
    setCargando(true)
    try {
      const { data } = await api.get(`/api/metricas/clase/${salaId}?periodo=${periodo}`)
      // Compatibilidad: respuesta puede ser { rol, alumnos } o array directo
      if (Array.isArray(data)) {
        setClase(data)
      } else {
        setClase(data?.alumnos || [])
        if (data?.rol) setRol(data.rol)
      }
    } catch (err) {
      console.error('[Metricas] Error cargando clase:', err)
      setClase([])
    } finally { setCargando(false) }
  }

  async function cargarDetalleMateria(materia: ResumenMateria) {
    setCargando(true)
    try {
      const { data } = await api.get(`/api/metricas/materia/${materia.id}/sala/${salaId}?periodo=${periodo}`)
      setMateriaDetalle({ materia, alumnos: Array.isArray(data) ? data : [] })
      setVista('materia')
    } catch (err) {
      console.error('[Metricas] Error cargando detalle materia:', err)
    } finally { setCargando(false) }
  }

  async function cargarPerfil(alumnoId: number) {
    setCargando(true)
    try {
      const { data } = await api.get(`/api/metricas/alumno/${alumnoId}?salaId=${salaId}&periodo=${periodo}`)
      setPerfil(data || null)
      if (data) setVista('alumno')
    } finally { setCargando(false) }
  }

  async function enviarReporte() {
    if (!salaId) return
    setEnviando(true)
    try {
      const { data } = await api.post(`/api/metricas/reporte/${salaId}`)
      setExito(`Reportes enviados a ${data.enviados} apoderados`)
      setTimeout(() => setExito(''), 4000)
    } catch {
      setExito('Error al enviar reportes')
      setTimeout(() => setExito(''), 3000)
    } finally { setEnviando(false) }
  }

  const materiasUnicas = Array.from(
    new Map(clase.flatMap(a => a.materias).map(m => [m.id, m])).values()
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3" style={{ background: 'var(--primary)' }}>
        <button onClick={() => {
          if (vista === 'alumno') { setPerfil(null); setVista(materiaDetalle ? 'materia' : 'resumen') }
          else if (vista === 'materia') { setMateriaDetalle(null); setVista('resumen') }
          else navigate('/profesora')
        }} className="text-white cursor-pointer text-xl">←</button>
        <h1 className="text-xl font-bold text-white flex-1">
          {vista === 'alumno' && perfil ? `${perfil.alumno.nombre} ${perfil.alumno.apellido}`
            : vista === 'materia' && materiaDetalle ? materiaDetalle.materia.nombre
            : 'Métricas'}
        </h1>
        {exito && <span className="text-sm bg-white/20 text-white px-3 py-1 rounded-full">{exito}</span>}
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select value={salaId || ''} onChange={e => setSalaId(Number(e.target.value))}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 focus:outline-none focus:border-purple-400">
            {salas.map(s => (
              <option key={s.id} value={s.id}>
                {s.nombre} {s.rol === 'jefe' ? '(Jefe)' : '(Materia)'}
              </option>
            ))}
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

          {rol === 'jefe' && vista === 'resumen' && (
            <button onClick={enviarReporte} disabled={enviando}
              className="ml-auto px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer border-2 transition-all"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'white' }}>
              {enviando ? 'Enviando...' : 'Enviar reporte a apoderados'}
            </button>
          )}
        </div>

        {/* Badge de rol */}
        {rol && vista === 'resumen' && (
          <div className="mb-4 flex items-center gap-2">
            <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
              rol === 'jefe' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {rol === 'jefe' ? 'Profesor Jefe — Acceso completo' : 'Profesor de Materia — Tus materias'}
            </span>
          </div>
        )}

        {cargando ? (
          <div className="text-center py-16 text-gray-400">Cargando métricas...</div>
        ) : (
          <>
            {/* ══════ VISTA RESUMEN ══════ */}
            {vista === 'resumen' && (
              <>
                {/* Cards por materia */}
                {resumenMaterias.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                    <div className="text-4xl mb-3">-</div>
                    <p className="text-gray-500">Aún no hay datos para este período.</p>
                    <p className="text-gray-400 text-sm mt-1">Las métricas aparecen después de que los alumnos respondan ejercicios.</p>
                  </div>
                ) : (
                  <>
                    {/* Resumen por materia - cards */}
                    <h2 className="font-bold text-gray-700 mb-3">Rendimiento por materia</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                      {resumenMaterias.map(mat => (
                        <button key={mat.id} onClick={() => cargarDetalleMateria(mat)}
                          className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer text-left border-2 border-transparent hover:border-purple-200">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-3 h-3 rounded-full" style={{ background: mat.color }} />
                            <span className="font-bold text-gray-700">{mat.nombre}</span>
                            <span className="ml-auto text-xs text-gray-400">Ver detalle →</span>
                          </div>
                          <div className="flex items-end gap-4 mb-3">
                            <div>
                              <p className="text-3xl font-black" style={{ color: colorPct(mat.porcentaje) }}>{mat.porcentaje}%</p>
                              <p className="text-xs text-gray-400">acierto promedio</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-600">{mat.totalEjercicios}</p>
                              <p className="text-xs text-gray-400">ejercicios</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-600">{mat.totalAlumnos}</p>
                              <p className="text-xs text-gray-400">alumnos</p>
                            </div>
                          </div>
                          {/* Barra */}
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${mat.porcentaje}%`, background: mat.color }} />
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Tabs: Tabla vs Resumen */}
                    <div className="flex items-center gap-3 mb-4">
                      <h2 className="font-bold text-gray-700">Vista de alumnos</h2>
                    </div>

                    {/* Tabla alumnos x materias */}
                    {clase.length > 0 && (
                      <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wide">
                                <th className="px-5 py-3 text-left">#</th>
                                <th className="px-5 py-3 text-left">Alumno</th>
                                {materiasUnicas.map(m => (
                                  <th key={m.id} className="px-4 py-3 text-center" style={{ color: m.color }}>{m.nombre}</th>
                                ))}
                                <th className="px-4 py-3 text-center">Puntos</th>
                              </tr>
                            </thead>
                            <tbody>
                              {clase.map((a, idx) => (
                                <tr key={a.id}
                                  onClick={() => cargarPerfil(a.id)}
                                  className="border-t border-gray-50 hover:bg-purple-50 cursor-pointer transition-colors">
                                  <td className="px-5 py-3 text-xs text-gray-400 font-mono">{idx + 1}</td>
                                  <td className="px-5 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                        style={{ background: a.genero === 'F' ? '#e84393' : a.genero === 'M' ? '#0984e3' : 'var(--primary)' }}>
                                        {a.nombre.split(' ')[0][0]}{a.nombre.split(' ')[1]?.[0] || ''}
                                      </div>
                                      <span className="font-medium text-sm text-gray-700">{a.nombre}</span>
                                    </div>
                                  </td>
                                  {materiasUnicas.map(mat => {
                                    const stats = a.materias.find(m => m.id === mat.id)
                                    const pct = stats?.porcentaje ?? null
                                    return (
                                      <td key={mat.id} className="px-4 py-3 text-center">
                                        {pct !== null ? (
                                          <div className="flex flex-col items-center gap-0.5">
                                            <span className="text-sm font-bold" style={{ color: colorPct(pct) }}>{pct}%</span>
                                            <span className="text-xs text-gray-400">{stats!.correctos}/{stats!.total}</span>
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
                    )}
                  </>
                )}
              </>
            )}

            {/* ══════ VISTA DETALLE MATERIA ══════ */}
            {vista === 'materia' && materiaDetalle && (
              <div>
                {/* Header materia */}
                <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-4 h-4 rounded-full" style={{ background: materiaDetalle.materia.color }} />
                    <h2 className="font-bold text-lg text-gray-700">{materiaDetalle.materia.nombre}</h2>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    <Stat label="Promedio clase" valor={`${materiaDetalle.materia.porcentaje}%`} color={colorPct(materiaDetalle.materia.porcentaje)} />
                    <Stat label="Ejercicios totales" valor={String(materiaDetalle.materia.totalEjercicios)} color="var(--primary)" />
                    <Stat label="Alumnos activos" valor={String(materiaDetalle.materia.totalAlumnos)} color="var(--primary)" />
                  </div>
                </div>

                {/* Ranking de alumnos */}
                <h3 className="font-bold text-gray-700 mb-3">Ranking de alumnos</h3>
                <div className="space-y-3">
                  {materiaDetalle.alumnos.map((a, idx) => (
                    <div key={a.id}
                      onClick={() => cargarPerfil(a.id)}
                      className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-all">
                      <div className="flex items-center gap-3">
                        {/* Posición */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                          idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                          idx === 1 ? 'bg-gray-100 text-gray-500' :
                          idx === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-50 text-gray-400'
                        }`}>
                          {idx + 1}
                        </div>
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ background: a.genero === 'F' ? '#e84393' : a.genero === 'M' ? '#0984e3' : 'var(--primary)' }}>
                          {a.nombre.split(' ')[0][0]}{a.nombre.split(' ')[1]?.[0] || ''}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-gray-700">{a.nombre}</p>
                          <p className="text-xs text-gray-400">{a.correctos}/{a.total} correctos · {a.puntos} pts</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black" style={{ color: colorPct(a.porcentaje) }}>{a.porcentaje}%</p>
                        </div>
                      </div>

                      {/* Barra general */}
                      <div className="h-1.5 bg-gray-100 rounded-full mt-3 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${a.porcentaje}%`, background: materiaDetalle.materia.color }} />
                      </div>

                      {/* Temas */}
                      {a.temas.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                          {a.temas.map((t, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 truncate flex-1">{t.nombre}</span>
                              <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${t.porcentaje}%`, background: colorPct(t.porcentaje) }} />
                              </div>
                              <span className="text-xs font-semibold w-8 text-right" style={{ color: colorPct(t.porcentaje) }}>{t.porcentaje}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {materiaDetalle.alumnos.length === 0 && (
                    <div className="bg-white rounded-2xl p-8 text-center text-gray-400">
                      No hay datos de alumnos para esta materia en este período.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══════ VISTA PERFIL ALUMNO ══════ */}
            {vista === 'alumno' && perfil && (
              <div>
                {/* Header alumno */}
                <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold"
                      style={{ background: perfil.alumno.genero === 'F' ? '#e84393' : perfil.alumno.genero === 'M' ? '#0984e3' : 'var(--primary)' }}>
                      {perfil.alumno.nombre[0]}{perfil.alumno.apellido[0]}
                    </div>
                    <div className="flex-1">
                      <h2 className="font-bold text-lg text-gray-800">{perfil.alumno.nombre} {perfil.alumno.apellido}</h2>
                      <div className="flex gap-4 text-sm text-gray-400 mt-0.5">
                        {perfil.alumno.genero && <span>{perfil.alumno.genero === 'F' ? 'Femenino' : 'Masculino'}</span>}
                        {perfil.alumno.email_apoderado && <span>{perfil.alumno.email_apoderado}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black" style={{ color: 'var(--primary)' }}>{perfil.puntosTotales}</p>
                      <p className="text-xs text-gray-400">puntos totales</p>
                    </div>
                  </div>
                </div>

                {/* Rendimiento por materia */}
                {(() => {
                  const materias = Array.from(
                    new Map(perfil.temas.map(t => [t.materia_id, { id: t.materia_id, nombre: t.materia, color: t.color }])).values()
                  )
                  if (materias.length === 0) {
                    return (
                      <div className="bg-white rounded-2xl p-8 text-center text-gray-400 mb-6">
                        Sin datos de rendimiento para este período.
                      </div>
                    )
                  }
                  return (
                    <div className="space-y-4 mb-6">
                      <h3 className="font-bold text-gray-700">Rendimiento por materia</h3>
                      {materias.map(mat => {
                        const temasMateria = perfil.temas.filter(t => t.materia_id === mat.id)
                        const totalMat = temasMateria.reduce((s, t) => s + Number(t.total), 0)
                        const correctosMat = temasMateria.reduce((s, t) => s + Number(t.correctos), 0)
                        const pctMat = totalMat > 0 ? Math.round((correctosMat / totalMat) * 100) : 0
                        const percentil = perfil.percentiles[mat.id]
                        const badge = badgePercentil(percentil ?? null)

                        return (
                          <div key={mat.id} className="bg-white rounded-xl p-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 rounded-full" style={{ background: mat.color }} />
                              <span className="font-bold text-sm" style={{ color: mat.color }}>{mat.nombre}</span>
                              <span className="text-sm font-bold" style={{ color: colorPct(pctMat) }}>{pctMat}%</span>
                              <span className="text-xs text-gray-400">{correctosMat}/{totalMat}</span>
                              {badge && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium ml-auto"
                                  style={{ background: badge.bg, color: badge.color }}>{badge.txt}</span>
                              )}
                            </div>
                            {/* Barra general */}
                            <div className="h-2 bg-gray-100 rounded-full mb-3 overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pctMat}%`, background: mat.color }} />
                            </div>
                            {/* Temas */}
                            <div className="space-y-1.5 pl-1">
                              {temasMateria.map((t, i) => {
                                const pct = Number(t.total) > 0 ? Math.round((Number(t.correctos) / Number(t.total)) * 100) : 0
                                return (
                                  <div key={i} className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 w-36 truncate">{t.tema}</span>
                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: colorPct(pct) }} />
                                    </div>
                                    <span className="text-xs font-semibold w-12 text-right" style={{ color: colorPct(pct) }}>
                                      {pct}% <span className="text-gray-300 font-normal">({t.correctos}/{t.total})</span>
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* Historial reciente */}
                {perfil.historial && perfil.historial.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-bold text-gray-700 mb-3">Actividad reciente</h3>
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className="divide-y divide-gray-50">
                        {perfil.historial.map((h, i) => (
                          <div key={i} className="flex items-center gap-3 px-4 py-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              h.es_correcto ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'
                            }`}>
                              {h.es_correcto ? 'O' : 'X'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-700 truncate">{h.titulo}</p>
                              <div className="flex gap-2 text-xs text-gray-400">
                                <span style={{ color: h.color }}>{h.materia}</span>
                                {h.tiempo_segundos && <span>· {h.tiempo_segundos}s</span>}
                              </div>
                            </div>
                            <span className="text-sm font-bold" style={{ color: h.es_correcto ? '#00B894' : '#E17055' }}>
                              +{h.puntos_obtenidos}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Ejercicios incorrectos */}
                {perfil.errores.length > 0 && (
                  <div>
                    <h3 className="font-bold text-gray-700 mb-3">Ejercicios incorrectos ({perfil.errores.length})</h3>
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className="divide-y divide-gray-50">
                        {perfil.errores.map((e, i) => (
                          <div key={i} className="flex items-start gap-3 px-4 py-3">
                            <span className="text-red-400 mt-0.5 flex-shrink-0 text-sm">X</span>
                            <div>
                              <p className="text-sm font-medium text-gray-700">{e.titulo}</p>
                              <p className="text-xs text-gray-400">{e.materia} · {e.tema}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function colorPct(pct: number | null) {
  if (pct === null) return '#e5e7eb'
  if (pct >= 70) return '#00B894'
  if (pct >= 50) return '#FDCB6E'
  return '#E17055'
}

function badgePercentil(p: number | null) {
  if (p === null) return null
  if (p >= 75) return { txt: `Top ${100 - p}%`, bg: '#d1fae5', color: '#065f46' }
  if (p >= 50) return { txt: `P${p}`, bg: '#fef3c7', color: '#92400e' }
  return { txt: `P${p}`, bg: '#fee2e2', color: '#991b1b' }
}

function Stat({ label, valor, color }: { label: string; valor: string; color: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-black" style={{ color }}>{valor}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}
