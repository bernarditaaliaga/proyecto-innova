import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useSocket } from '../../hooks/useSocket'
import type { Planificacion, Ejercicio, Materia, Tema } from '../../types'

type EstadoSesion = 'cargando' | 'sin_iniciar' | 'esperando' | 'ejercicio_activo' | 'finalizada'
type TipoEjRapido = 'seleccion_multiple' | 'matematica_desarrollo' | 'dibujo'

interface RespuestaAlumno {
  alumnoId: number
  nombre: string
  respondio: boolean
  esCorrecta: boolean | null
  puntos: number
}

export default function Sesion() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const socket = useSocket()

  const [plan, setPlan] = useState<Planificacion | null>(null)
  const [estado, setEstado] = useState<EstadoSesion>('cargando')
  const [sesionId, setSesionId] = useState<number | null>(null)
  const [ejercicioActivo, setEjercicioActivo] = useState<Ejercicio | null>(null)
  const [respuestas, setRespuestas] = useState<RespuestaAlumno[]>([])
  const [totalAlumnos, setTotalAlumnos] = useState(0)
  const [confirmFinalizar, setConfirmFinalizar] = useState(false)
  const ejercicioActivoRef = useRef<Ejercicio | null>(null)

  // Crear ejercicio en vivo
  const [modalNuevoEj, setModalNuevoEj] = useState(false)
  const [nuevoEjTipo, setNuevoEjTipo] = useState<TipoEjRapido | null>(null)
  const [nuevoEjTitulo, setNuevoEjTitulo] = useState('')
  const [nuevoEjTemaId, setNuevoEjTemaId] = useState('')
  const [nuevoEjPuntos, setNuevoEjPuntos] = useState(10)
  const [nuevoEjCargando, setNuevoEjCargando] = useState(false)
  const [nuevoEjError, setNuevoEjError] = useState('')
  const [temasMateriaVivo, setTemasMateriaVivo] = useState<Tema[]>([])
  // Campos específicos
  const [ejPregunta, setEjPregunta] = useState('')
  const [ejOpciones, setEjOpciones] = useState([{ texto: '', correcta: false }, { texto: '', correcta: false }])
  const [ejEnunciado, setEjEnunciado] = useState('')
  const [ejRespuesta, setEjRespuesta] = useState('')
  const [ejInstruccion, setEjInstruccion] = useState('')
  const [ejEvaluarConIA, setEjEvaluarConIA] = useState(true)

  useEffect(() => { cargar() }, [id])

  useEffect(() => {
    if (!socket) return

    socket.on('sesion:creada', (data: { id: number }) => {
      setSesionId(data.id)
      setEstado('esperando')
    })

    socket.on('respuesta:alumno', (data: RespuestaAlumno) => {
      setRespuestas(prev => {
        const existe = prev.find(r => r.alumnoId === data.alumnoId)
        if (existe) return prev.map(r => r.alumnoId === data.alumnoId ? data : r)
        return [...prev, data]
      })
    })

    // Reconectar la profesora al room de la sala si hay sesión activa
    const reconectar = () => {
      if (plan && sesionId) {
        console.log('[Sesion] Reconectando profesora a sala:', plan.sala_id)
        socket.emit('profesora:reconectar', { salaId: plan.sala_id, sesionId })
      }
    }
    socket.on('connect', reconectar)

    return () => {
      socket.off('sesion:creada')
      socket.off('respuesta:alumno')
      socket.off('connect', reconectar)
    }
  }, [socket, plan, sesionId])

  async function cargar() {
    const { data } = await api.get(`/api/planificaciones/${id}`)
    setPlan(data)
    setTotalAlumnos(data.total_alumnos || 0)

    // Obtener total de alumnos de la sala
    const sala = await api.get(`/api/salas/${data.sala_id}/alumnos`)
    setTotalAlumnos(sala.data.length)

    // Cargar temas de la materia para ejercicios en vivo
    try {
      const m = await api.get('/api/materias')
      const materia = (m.data as Materia[]).find(mat => mat.id === data.materia_id)
      if (materia) setTemasMateriaVivo(materia.temas || [])
    } catch { /* silenciar */ }

    setEstado('sin_iniciar')
  }

  function abrirModalNuevoEj() {
    setModalNuevoEj(true)
    setNuevoEjTipo(null)
    setNuevoEjTitulo('')
    setNuevoEjTemaId('')
    setNuevoEjPuntos(10)
    setNuevoEjError('')
    setEjPregunta('')
    setEjOpciones([{ texto: '', correcta: false }, { texto: '', correcta: false }])
    setEjEnunciado('')
    setEjRespuesta('')
    setEjInstruccion('')
    setEjEvaluarConIA(true)
  }

  async function crearEjercicioEnVivo(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevoEjTitulo.trim()) { setNuevoEjError('Escribe el título'); return }
    if (!nuevoEjTemaId) { setNuevoEjError('Selecciona un tema'); return }

    let contenido: unknown
    if (nuevoEjTipo === 'seleccion_multiple') {
      if (ejOpciones.filter(o => o.texto.trim()).length < 2) { setNuevoEjError('Agrega al menos 2 opciones'); return }
      if (!ejOpciones.some(o => o.correcta)) { setNuevoEjError('Marca una opción como correcta'); return }
      contenido = { pregunta: ejPregunta, opciones: ejOpciones.filter(o => o.texto.trim()) }
    } else if (nuevoEjTipo === 'matematica_desarrollo') {
      if (!ejEnunciado || !ejRespuesta) { setNuevoEjError('Completa enunciado y respuesta'); return }
      contenido = { enunciado: ejEnunciado, respuesta_correcta: ejRespuesta }
    } else if (nuevoEjTipo === 'dibujo') {
      contenido = { instruccion: ejInstruccion, evaluar_con_ia: ejEvaluarConIA }
    }

    setNuevoEjCargando(true)
    try {
      await api.post(`/api/planificaciones/${id}/ejercicios`, {
        titulo: nuevoEjTitulo,
        tipo: nuevoEjTipo,
        contenido,
        puntos: nuevoEjPuntos,
        temaId: Number(nuevoEjTemaId),
        orden: plan?.ejercicios?.length || 0
      })
      setModalNuevoEj(false)
      cargar() // Recargar plan con el nuevo ejercicio
    } catch {
      setNuevoEjError('Error al crear ejercicio')
    } finally { setNuevoEjCargando(false) }
  }

  function iniciarSesion() {
    if (!socket) return
    socket.emit('profesora:iniciar_sesion', { planificacionId: Number(id) })
  }

  function lanzarEjercicio(ej: Ejercicio) {
    if (!socket || !sesionId || !plan) return
    socket.emit('profesora:lanzar_ejercicio', {
      sesionId,
      ejercicioId: ej.id,
      salaId: plan.sala_id
    })
    setEjercicioActivo(ej)
    ejercicioActivoRef.current = ej
    setEstado('ejercicio_activo')
    setRespuestas([])
  }

  function cerrarEjercicio() {
    if (!socket || !sesionId || !plan) return
    socket.emit('profesora:cerrar_ejercicio', { sesionId, salaId: plan.sala_id })
    setEjercicioActivo(null)
    ejercicioActivoRef.current = null
    setEstado('esperando')
  }

  function finalizarSesion() {
    if (!socket || !sesionId || !plan) return
    socket.emit('profesora:finalizar_sesion', { sesionId, salaId: plan.sala_id })
    setEstado('finalizada')
    setConfirmFinalizar(false)
  }

  // Revisar respuestas
  const [modalRevisar, setModalRevisar] = useState(false)
  const [respuestasDetalle, setRespuestasDetalle] = useState<{
    id: number; alumno_id: number; alumno: string; contenido: unknown;
    es_correcto: boolean; puntos_obtenidos: number; puntos_max: number;
    tipo: string; ejercicio_contenido: unknown; tiempo_segundos: number
  }[]>([])
  const [cargandoRevisar, setCargandoRevisar] = useState(false)

  async function abrirRevisar() {
    if (!ejercicioActivo || !plan) return
    setCargandoRevisar(true)
    setModalRevisar(true)
    try {
      const { data } = await api.get(`/api/planificaciones/${plan.id}/ejercicios/${ejercicioActivo.id}/respuestas`)
      setRespuestasDetalle(data)
    } catch { setRespuestasDetalle([]) }
    finally { setCargandoRevisar(false) }
  }

  async function editarPuntos(respuestaId: number, puntosObtenidos: number) {
    try {
      await api.put(`/api/planificaciones/respuestas/${respuestaId}`, {
        puntosObtenidos,
        esCorreecto: puntosObtenidos > 0
      })
      setRespuestasDetalle(prev => prev.map(r =>
        r.id === respuestaId ? { ...r, puntos_obtenidos: puntosObtenidos, es_correcto: puntosObtenidos > 0 } : r
      ))
    } catch { /* silenciar */ }
  }

  const respondieron = respuestas.filter(r => r.respondio).length
  const correctas = respuestas.filter(r => r.esCorrecta).length
  const porcentaje = respondieron > 0 ? Math.round((correctas / respondieron) * 100) : 0

  if (!plan) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <p className="text-gray-400">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-3" style={{ background: 'var(--primary)' }}>
        <button onClick={() => navigate('/profesora/planificaciones')}
          className="text-white cursor-pointer text-xl">←</button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">{plan.titulo}</h1>
          <p className="text-purple-200 text-sm">{plan.sala} · {plan.materia}</p>
        </div>
        {estado !== 'sin_iniciar' && estado !== 'finalizada' && (
          <button onClick={() => setConfirmFinalizar(true)}
            className="bg-red-400 hover:bg-red-300 text-white text-sm font-bold px-4 py-2 rounded-xl cursor-pointer">
            Finalizar clase
          </button>
        )}
      </div>

      <div className="max-w-5xl mx-auto p-6 w-full flex-1">

        {/* SIN INICIAR */}
        {estado === 'sin_iniciar' && (
          <div className="flex flex-col items-center justify-center h-full py-16">
            <div className="bg-white rounded-2xl p-10 shadow-sm text-center max-w-md w-full">
              <div className="text-5xl mb-4">🎓</div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
                ¿Lista para comenzar?
              </h2>
              <p className="text-gray-500 mb-6">
                Se conectarán <strong>{totalAlumnos} alumnos</strong> de {plan.sala}.
                Todos verán la pantalla de espera hasta que lances el primer ejercicio.
              </p>
              <button onClick={iniciarSesion}
                className="w-full py-4 rounded-xl font-bold text-white text-lg cursor-pointer"
                style={{ background: 'var(--success)' }}>
                ▶ Iniciar clase
              </button>
            </div>
          </div>
        )}

        {/* CLASE ACTIVA */}
        {(estado === 'esperando' || estado === 'ejercicio_activo') && (
          <div className="grid md:grid-cols-3 gap-6">

            {/* Panel izquierdo: ejercicios */}
            <div className="md:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold" style={{ color: 'var(--text)' }}>Ejercicios</h3>
                <button onClick={abrirModalNuevoEj}
                  className="text-xs px-3 py-1.5 rounded-xl text-white cursor-pointer font-semibold"
                  style={{ background: 'var(--primary)' }}>
                  + Nuevo
                </button>
              </div>
              <div className="space-y-2">
                {plan.ejercicios?.map((ej, i) => {
                  const activo = ejercicioActivo?.id === ej.id
                  return (
                    <button key={ej.id} onClick={() => lanzarEjercicio(ej)}
                      className="w-full text-left px-4 py-3 rounded-xl border-2 transition-all cursor-pointer"
                      style={{
                        background: activo ? '#f0efff' : 'white',
                        borderColor: activo ? 'var(--primary)' : 'transparent',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                      }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0"
                          style={{ background: activo ? 'var(--primary)' : '#ccc', fontSize: '10px' }}>
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-700 flex-1 truncate">{ej.titulo}</span>
                        <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>{ej.puntos}p</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Panel derecho: estado actual */}
            <div className="md:col-span-2 space-y-4">

              {/* Estado */}
              {estado === 'esperando' && !ejercicioActivo && (
                <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
                  <div className="text-4xl mb-3">⏳</div>
                  <p className="text-gray-500 font-medium">Alumnos en pantalla de espera</p>
                  <p className="text-sm text-gray-400 mt-1">Selecciona un ejercicio de la izquierda para lanzarlo</p>
                </div>
              )}

              {estado === 'ejercicio_activo' && ejercicioActivo && (
                <>
                  {/* Ejercicio activo — vista profesora */}
                  <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">
                          Ejercicio activo
                        </p>
                        <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
                          {ejercicioActivo.titulo}
                        </h3>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {respondieron > 0 && (
                          <button onClick={abrirRevisar}
                            className="bg-purple-100 hover:bg-purple-200 text-purple-700 text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer">
                            📋 Revisar
                          </button>
                        )}
                        <button onClick={cerrarEjercicio}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer">
                          ⏹ Cerrar
                        </button>
                      </div>
                    </div>

                    {/* Contenido del ejercicio según tipo */}
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                      {/* Selección múltiple */}
                      {ejercicioActivo.tipo === 'seleccion_multiple' && (
                        <>
                          <p className="text-gray-700 font-medium">{ejercicioActivo.contenido.pregunta}</p>
                          <div className="space-y-1 mt-2">
                            {(ejercicioActivo.contenido.opciones || []).map((op, i) => (
                              <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${op.correcta ? 'bg-green-100 border border-green-300' : ''}`}>
                                <span className="font-bold text-gray-400 text-xs">{String.fromCharCode(65 + i)}.</span>
                                <span className={op.correcta ? 'text-green-700 font-semibold' : 'text-gray-600'}>{op.texto}</span>
                                {op.correcta && <span className="text-green-600 text-xs ml-auto">✓ Correcta</span>}
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Matemática desarrollo */}
                      {ejercicioActivo.tipo === 'matematica_desarrollo' && (
                        <>
                          <p className="text-gray-700">{ejercicioActivo.contenido.enunciado}</p>
                          <div className="bg-green-100 border border-green-300 rounded-lg px-3 py-2 mt-2">
                            <span className="text-xs text-green-600 font-semibold">Respuesta correcta: </span>
                            <span className="text-green-700 font-bold">{ejercicioActivo.contenido.respuesta_correcta}</span>
                            {ejercicioActivo.contenido.respuestas_alternativas && (
                              <p className="text-xs text-green-500 mt-1">
                                También acepta: {(ejercicioActivo.contenido.respuestas_alternativas as string[]).join(', ')}
                              </p>
                            )}
                          </div>
                        </>
                      )}

                      {/* Completar texto */}
                      {ejercicioActivo.tipo === 'completar_texto' && (
                        <div className="text-gray-700">
                          {(ejercicioActivo.contenido.tokens || []).map((t, i) => (
                            <span key={i} className={t.esBlanco ? 'font-bold text-green-700 bg-green-100 px-1 rounded' : ''}>
                              {t.esBlanco ? `[${t.texto}]` : t.texto}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Dibujo */}
                      {ejercicioActivo.tipo === 'dibujo' && (
                        <p className="text-gray-700">{ejercicioActivo.contenido.instruccion}</p>
                      )}

                      {/* Video */}
                      {ejercicioActivo.tipo === 'video_youtube' && (
                        <p className="text-gray-700">{ejercicioActivo.contenido.url_video}</p>
                      )}

                      {/* Imagen */}
                      {ejercicioActivo.tipo === 'mostrar_imagen' && ejercicioActivo.contenido.url_imagen && (
                        <img src={ejercicioActivo.contenido.url_imagen} alt="" className="max-h-32 rounded-lg object-contain" />
                      )}
                    </div>
                  </div>

                  {/* Progreso */}
                  <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold" style={{ color: 'var(--text)' }}>Respuestas en vivo</h4>
                      <span className="text-sm font-bold" style={{ color: 'var(--primary)' }}>
                        {respondieron} / {totalAlumnos}
                      </span>
                    </div>

                    {/* Barra de progreso */}
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${totalAlumnos > 0 ? (respondieron / totalAlumnos) * 100 : 0}%`,
                          background: 'var(--primary)'
                        }} />
                    </div>

                    {/* Stats */}
                    {respondieron > 0 && (
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="bg-green-50 rounded-xl p-3">
                          <p className="text-2xl font-bold text-green-600">{correctas}</p>
                          <p className="text-xs text-green-500">Correctas</p>
                        </div>
                        <div className="bg-red-50 rounded-xl p-3">
                          <p className="text-2xl font-bold text-red-500">{respondieron - correctas}</p>
                          <p className="text-xs text-red-400">Incorrectas</p>
                        </div>
                        <div className="bg-purple-50 rounded-xl p-3">
                          <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{porcentaje}%</p>
                          <p className="text-xs text-purple-400">Acierto</p>
                        </div>
                      </div>
                    )}

                    {/* Lista de alumnos */}
                    {respuestas.length > 0 && (
                      <div className="mt-4 space-y-1 max-h-48 overflow-y-auto">
                        {respuestas.map(r => (
                          <div key={r.alumnoId} className="flex items-center gap-2 text-sm">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.esCorrecta ? 'bg-green-500' : 'bg-red-400'}`} />
                            <span className="text-gray-600 flex-1">{r.nombre}</span>
                            <span className="font-semibold" style={{ color: 'var(--primary)' }}>+{r.puntos}p</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* FINALIZADA */}
        {estado === 'finalizada' && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="bg-white rounded-2xl p-10 shadow-sm text-center max-w-md">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>Clase finalizada</h2>
              <p className="text-gray-500 mb-6">Los alumnos verán la pantalla de espera.</p>
              <div className="flex gap-3">
                <button onClick={() => navigate('/profesora/metricas')}
                  className="flex-1 py-3 rounded-xl font-bold text-white cursor-pointer"
                  style={{ background: 'var(--primary)' }}>
                  Ver métricas
                </button>
                <button onClick={() => navigate('/profesora')}
                  className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-semibold text-gray-600 cursor-pointer hover:bg-gray-50">
                  Inicio
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal crear ejercicio en vivo */}
      {modalNuevoEj && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl my-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center gap-2">
                {nuevoEjTipo && (
                  <button onClick={() => setNuevoEjTipo(null)} className="text-gray-500 hover:text-purple-600 cursor-pointer font-bold">←</button>
                )}
                <h3 className="font-bold" style={{ color: 'var(--text)' }}>
                  {nuevoEjTipo ? 'Nuevo ejercicio' : 'Tipo de ejercicio'}
                </h3>
              </div>
              <button onClick={() => setModalNuevoEj(false)}
                className="text-gray-400 hover:text-red-500 cursor-pointer text-2xl font-bold">×</button>
            </div>
            <div className="p-5 overflow-y-auto">
              {!nuevoEjTipo && (
                <div className="grid grid-cols-1 gap-2">
                  {([
                    { v: 'seleccion_multiple' as TipoEjRapido, l: 'Seleccion multiple', d: 'Pregunta con alternativas' },
                    { v: 'matematica_desarrollo' as TipoEjRapido, l: 'Matematica', d: 'Problema con respuesta' },
                    { v: 'dibujo' as TipoEjRapido, l: 'Dibujo libre', d: 'El alumno dibuja' },
                  ]).map(t => (
                    <button key={t.v} onClick={() => setNuevoEjTipo(t.v)}
                      className="text-left px-4 py-3 rounded-xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50 cursor-pointer transition-all">
                      <span className="text-sm font-bold text-gray-700">{t.l}</span>
                      <span className="text-xs text-gray-400 ml-2">{t.d}</span>
                    </button>
                  ))}
                </div>
              )}

              {nuevoEjTipo && (
                <form onSubmit={crearEjercicioEnVivo} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Titulo *</label>
                    <input type="text" value={nuevoEjTitulo} onChange={e => setNuevoEjTitulo(e.target.value)} required
                      placeholder="ej: Suma de fracciones"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Tema *</label>
                      <select value={nuevoEjTemaId} onChange={e => setNuevoEjTemaId(e.target.value)} required
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700">
                        <option value="">Selecciona</option>
                        {temasMateriaVivo.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Puntos</label>
                      <input type="number" min={1} max={100} value={nuevoEjPuntos}
                        onChange={e => setNuevoEjPuntos(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  {/* Seleccion multiple */}
                  {nuevoEjTipo === 'seleccion_multiple' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Pregunta</label>
                        <input type="text" value={ejPregunta} onChange={e => setEjPregunta(e.target.value)} required
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                      </div>
                      {ejOpciones.map((op, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input type="radio" name="correcta" checked={op.correcta}
                            onChange={() => setEjOpciones(ops => ops.map((o, j) => ({ ...o, correcta: j === i })))}
                            className="cursor-pointer" />
                          <input type="text" value={op.texto}
                            onChange={e => setEjOpciones(ops => ops.map((o, j) => j === i ? { ...o, texto: e.target.value } : o))}
                            placeholder={`Opcion ${i + 1}`}
                            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700 text-sm" />
                          {ejOpciones.length > 2 && (
                            <button type="button" onClick={() => setEjOpciones(ops => ops.filter((_, j) => j !== i))}
                              className="text-gray-300 hover:text-red-400 cursor-pointer">×</button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => setEjOpciones(ops => [...ops, { texto: '', correcta: false }])}
                        className="text-xs text-purple-500 font-semibold cursor-pointer">+ Agregar opcion</button>
                    </div>
                  )}

                  {/* Matematica */}
                  {nuevoEjTipo === 'matematica_desarrollo' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Enunciado</label>
                        <textarea value={ejEnunciado} onChange={e => setEjEnunciado(e.target.value)} required rows={2}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Respuesta correcta</label>
                        <input type="text" value={ejRespuesta} onChange={e => setEjRespuesta(e.target.value)} required
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                      </div>
                    </div>
                  )}

                  {/* Dibujo */}
                  {nuevoEjTipo === 'dibujo' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Instruccion</label>
                        <input type="text" value={ejInstruccion} onChange={e => setEjInstruccion(e.target.value)} required
                          placeholder="ej: Dibuja el ciclo del agua"
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                      </div>
                      <div className="flex items-center gap-3 bg-purple-50 rounded-xl p-3">
                        <input type="checkbox" id="evaluar-ia-vivo" checked={ejEvaluarConIA}
                          onChange={e => setEjEvaluarConIA(e.target.checked)}
                          className="w-4 h-4 cursor-pointer accent-purple-600" />
                        <label htmlFor="evaluar-ia-vivo" className="cursor-pointer flex-1">
                          <span className="text-sm font-medium text-gray-700">Evaluar con IA</span>
                          <p className="text-xs text-gray-400">
                            {ejEvaluarConIA ? 'La IA evalúa automáticamente' : 'Revisión manual después'}
                          </p>
                        </label>
                      </div>
                    </div>
                  )}

                  {nuevoEjError && <p className="text-red-500 text-sm">{nuevoEjError}</p>}
                  <button type="submit" disabled={nuevoEjCargando}
                    className="w-full py-3 rounded-xl font-bold text-white cursor-pointer"
                    style={{ background: nuevoEjCargando ? '#a29bfe' : 'var(--primary)' }}>
                    {nuevoEjCargando ? 'Guardando...' : 'Crear ejercicio'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal revisar respuestas */}
      {modalRevisar && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 pb-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <h3 className="font-bold" style={{ color: 'var(--text)' }}>
                Respuestas — {ejercicioActivo?.titulo}
              </h3>
              <button onClick={() => setModalRevisar(false)}
                className="text-gray-400 hover:text-red-500 cursor-pointer text-2xl font-bold">×</button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {cargandoRevisar ? (
                <p className="text-gray-400 text-center py-8">Cargando...</p>
              ) : respuestasDetalle.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No hay respuestas aún</p>
              ) : (
                <div className="space-y-3">
                  {respuestasDetalle.map(r => {
                    const contenido = r.contenido as Record<string, unknown>
                    return (
                      <div key={r.id} className="border rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-gray-700">{r.alumno}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r.es_correcto ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                              {r.es_correcto ? 'Correcto' : 'Incorrecto'}
                            </span>
                            <span className="text-xs text-gray-400">{r.tiempo_segundos}s</span>
                          </div>
                        </div>

                        {/* Mostrar dibujo si es tipo dibujo */}
                        {r.tipo === 'dibujo' && contenido?.imagen && (
                          <img src={contenido.imagen as string} alt="Dibujo"
                            className="rounded-lg border max-h-48 object-contain w-full bg-gray-50 mb-2" />
                        )}

                        {/* Mostrar respuesta texto */}
                        {r.tipo === 'matematica_desarrollo' && contenido?.respuesta && (
                          <p className="text-sm text-gray-600 mb-2">Respuesta: <strong>{String(contenido.respuesta)}</strong></p>
                        )}
                        {r.tipo === 'seleccion_multiple' && contenido?.texto && (
                          <p className="text-sm text-gray-600 mb-2">Seleccionó: <strong>{String(contenido.texto)}</strong></p>
                        )}

                        {/* Editar puntos */}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-500">Puntos:</span>
                          <input type="number" min={0} max={r.puntos_max}
                            value={r.puntos_obtenidos}
                            onChange={e => {
                              const val = Math.min(Number(e.target.value), r.puntos_max)
                              setRespuestasDetalle(prev => prev.map(x =>
                                x.id === r.id ? { ...x, puntos_obtenidos: val } : x
                              ))
                            }}
                            className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-center text-sm font-bold" />
                          <span className="text-xs text-gray-400">/ {r.puntos_max}</span>
                          <button onClick={() => editarPuntos(r.id, r.puntos_obtenidos)}
                            className="text-xs px-3 py-1 rounded-lg font-semibold cursor-pointer text-white"
                            style={{ background: 'var(--primary)' }}>
                            Guardar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmar finalizar */}
      {confirmFinalizar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="font-bold text-lg mb-2">¿Finalizar la clase?</h3>
            <p className="text-gray-500 text-sm mb-5">Todos los alumnos volverán a la pantalla de espera.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmFinalizar(false)}
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-semibold text-gray-600 cursor-pointer">
                Cancelar
              </button>
              <button onClick={finalizarSesion}
                className="flex-1 py-3 rounded-xl font-bold text-white cursor-pointer bg-red-500">
                Sí, finalizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
