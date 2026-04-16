import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { useSocket } from '../../hooks/useSocket'
import type { Planificacion, Ejercicio } from '../../types'

type EstadoSesion = 'cargando' | 'sin_iniciar' | 'esperando' | 'ejercicio_activo' | 'finalizada'

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

    return () => {
      socket.off('sesion:creada')
      socket.off('respuesta:alumno')
    }
  }, [socket])

  async function cargar() {
    const { data } = await api.get(`/api/planificaciones/${id}`)
    setPlan(data)
    setTotalAlumnos(data.total_alumnos || 0)

    // Obtener total de alumnos de la sala
    const sala = await api.get(`/api/salas/${data.sala_id}/alumnos`)
    setTotalAlumnos(sala.data.length)
    setEstado('sin_iniciar')
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
              <h3 className="font-bold mb-3" style={{ color: 'var(--text)' }}>Ejercicios</h3>
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
                  {/* Ejercicio activo */}
                  <div className="bg-white rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">
                          Ejercicio activo
                        </p>
                        <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
                          {ejercicioActivo.titulo}
                        </h3>
                        {ejercicioActivo.contenido.pregunta && (
                          <p className="text-gray-500 text-sm mt-1">{ejercicioActivo.contenido.pregunta}</p>
                        )}
                      </div>
                      <button onClick={cerrarEjercicio}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer flex-shrink-0">
                        ⏹ Cerrar
                      </button>
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
