import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../hooks/useSocket'
import type { Ejercicio } from '../../types'
import CanvasDibujo from '../../components/CanvasDibujo'

type EstadoAula = 'metricas' | 'en_clase' | 'ejercicio' | 'respondido'

export default function Aula() {
  const { usuario, logout } = useAuth()
  const socket = useSocket()
  const [estado, setEstado] = useState<EstadoAula>('metricas')
  const [ejercicio, setEjercicio] = useState<Ejercicio | null>(null)
  const [sesionId, setSesionId] = useState<number | null>(null)
  const [respuesta, setRespuesta] = useState<string | number | null>(null)
  const [fueCorrecta, setFueCorrecta] = useState<boolean>(true)
  const [puntosObtenidos, setPuntosObtenidos] = useState<number | null>(null)
  const [tiempoInicio, setTiempoInicio] = useState<number>(0)
  const [respuestaMatematica, setRespuestaMatematica] = useState('')
  const [respuestasBlancos, setRespuestasBlancos] = useState<string[]>([])
  const [puntosTotal, setPuntosTotal] = useState(0)
  const [claseInfo, setClaseInfo] = useState<{ materia: string; profesora: string } | null>(null)
  const [comentarioIA, setComentarioIA] = useState('')
  const canvasRef = useRef<{ getImagen: () => string } | null>(null)

  useEffect(() => {
    if (!socket || !usuario) return

    const unirse = () => {
      console.log('[Aula] Emitiendo alumno:unirse', { salaId: usuario.salaId, alumnoId: usuario.id })
      socket.emit('alumno:unirse', { salaId: usuario.salaId, alumnoId: usuario.id })
    }

    // Unirse al conectar (y reconectar)
    socket.on('connect', unirse)
    // Si ya está conectado, unirse ahora
    if (socket.connected) unirse()

    // No hay sesion activa -> metricas
    socket.on('sesion:esperando', () => {
      setEstado('metricas')
      setClaseInfo(null)
      setSesionId(null)
    })

    // Hay sesion activa (reconexion)
    socket.on('sesion:estado', (data: {
      sesionId: number
      materia?: string
      profesora?: string
      ejercicio?: Ejercicio
      yaRespondio?: boolean
      puntosYaObtenidos?: number
    }) => {
      setSesionId(data.sesionId)
      setClaseInfo({ materia: data.materia || '', profesora: data.profesora || '' })

      if (data.ejercicio && !data.yaRespondio) {
        setEjercicio(data.ejercicio)
        setEstado('ejercicio')
        setTiempoInicio(Date.now())
        const blancos = (data.ejercicio.contenido.tokens || []).filter(t => t.esBlanco).length
        setRespuestasBlancos(Array(blancos).fill(''))
      } else if (data.yaRespondio) {
        setPuntosObtenidos(data.puntosYaObtenidos ?? 0)
        setEstado('respondido')
      } else {
        setEstado('en_clase')
      }
    })

    // Profesora inicia clase
    socket.on('sesion:iniciada', (data: { sesionId: number; materia?: string; profesora?: string }) => {
      setSesionId(data.sesionId)
      setPuntosTotal(0)
      setClaseInfo({ materia: data.materia || '', profesora: data.profesora || '' })
      setEstado('en_clase')
    })

    // Profesora lanza ejercicio
    socket.on('ejercicio:nuevo', (ej: Ejercicio) => {
      setEjercicio(ej)
      setEstado('ejercicio')
      setRespuesta(null)
      setFueCorrecta(true)
      setRespuestaMatematica('')
      const blancos = (ej.contenido.tokens || []).filter((t: { esBlanco: boolean }) => t.esBlanco).length
      setRespuestasBlancos(Array(blancos).fill(''))
      setPuntosObtenidos(null)
      setTiempoInicio(Date.now())
    })

    // Profesora cierra ejercicio -> vuelve a pantalla de clase
    socket.on('ejercicio:cerrado', () => {
      setEjercicio(null)
      setEstado('en_clase')
    })

    // Profesora termina la clase -> vuelve a metricas
    socket.on('sesion:finalizada', () => {
      setEstado('metricas')
      setEjercicio(null)
      setSesionId(null)
      setClaseInfo(null)
    })

    // Respuesta confirmada
    socket.on('respuesta:confirmada', (data: { puntosObtenidos: number; comentarioIA?: string }) => {
      setPuntosObtenidos(data.puntosObtenidos)
      setPuntosTotal(prev => prev + data.puntosObtenidos)
      if (data.comentarioIA) setComentarioIA(data.comentarioIA)
      setEstado('respondido')
    })

    return () => {
      socket.off('connect', unirse)
      socket.off('sesion:esperando')
      socket.off('sesion:estado')
      socket.off('sesion:iniciada')
      socket.off('ejercicio:nuevo')
      socket.off('ejercicio:cerrado')
      socket.off('sesion:finalizada')
      socket.off('respuesta:confirmada')
    }
  }, [socket, usuario])

  function enviarRespuesta(contenido: unknown, esCorrecta: boolean, extra?: Record<string, unknown>) {
    if (!socket || !ejercicio || !sesionId || !usuario) return
    const tiempoSegundos = Math.round((Date.now() - tiempoInicio) / 1000)
    setFueCorrecta(esCorrecta)
    setComentarioIA('')

    socket.emit('alumno:responder', {
      alumnoId: usuario.id,
      ejercicioId: ejercicio.id,
      sesionId,
      contenido,
      esCorrecta,
      tiempoSegundos,
      ...extra
    })
  }

  function handleSeleccion(idx: number) {
    if (estado === 'respondido' || !ejercicio) return
    const opciones = ejercicio.contenido.opciones || []
    const esCorrecta = opciones[idx]?.correcta || false
    setRespuesta(idx)
    enviarRespuesta({ opcionSeleccionada: idx, texto: opciones[idx]?.texto }, esCorrecta)
  }

  function handleMatematica() {
    if (!respuestaMatematica.trim() || !ejercicio) return
    const dada = respuestaMatematica.trim().toLowerCase()
    const correcta = String(ejercicio.contenido.respuesta_correcta || '').trim().toLowerCase()
    // Verificar respuesta principal y alternativas
    const alternativas = (ejercicio.contenido.respuestas_alternativas || []) as string[]
    const todasLasRespuestas = [correcta, ...alternativas.map(a => a.trim().toLowerCase())]
    const esCorrecta = todasLasRespuestas.includes(dada)
    enviarRespuesta({ respuesta: respuestaMatematica }, esCorrecta)
  }

  function handleBlancos() {
    if (!ejercicio) return
    enviarRespuesta({ blancos: respuestasBlancos }, true)
  }

  function handleDibujo() {
    if (!canvasRef.current || !ejercicio) return
    const imagen = canvasRef.current.getImagen()
    // Por defecto evaluar con IA, a menos que explícitamente esté desactivado
    const evaluarConIA = ejercicio.contenido.evaluar_con_ia !== false
    const instruccionDibujo = ejercicio.contenido.instruccion || ''
    // Enviar esCorrecta=false (la IA decidirá), y pasar los datos para evaluación
    enviarRespuesta({ imagen }, false, { evaluarConIA, instruccionDibujo })
  }

  // ═══════════════════════════════════════════
  // PANTALLA: METRICAS (sin clase activa)
  // ═══════════════════════════════════════════
  if (estado === 'metricas') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #6C5CE7 0%, #a29bfe 60%, #dfe6e9 100%)' }}>
        <div className="text-center">
          <div className="text-7xl mb-6">🎓</div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Hola, {usuario?.nombre}
          </h1>
          {usuario?.sala && (
            <p className="text-purple-200 text-lg mb-8">{usuario.sala}</p>
          )}
          <div className="bg-white/20 backdrop-blur rounded-2xl px-8 py-6">
            <p className="text-white text-lg font-medium">Metricas</p>
            <p className="text-purple-200 text-sm mt-1">Proximamente...</p>
          </div>
        </div>
        <button onClick={logout}
          className="absolute bottom-4 right-4 text-white/30 text-xs hover:text-white/60 cursor-pointer">
          salir
        </button>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // PANTALLA: EN CLASE (esperando ejercicio)
  // ═══════════════════════════════════════════
  if (estado === 'en_clase') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #00B894 0%, #55efc4 60%, #dfe6e9 100%)' }}>
        <div className="text-center">
          <div className="text-7xl mb-6">📖</div>
          <h1 className="text-3xl font-bold text-white mb-1">
            {claseInfo?.materia || 'Clase en curso'}
          </h1>
          <p className="text-green-100 text-lg mb-8">
            Prof. {claseInfo?.profesora || ''}
          </p>
          <div className="bg-white/20 backdrop-blur rounded-2xl px-8 py-4">
            <p className="text-white text-lg font-medium">Clase en curso</p>
            <div className="flex justify-center gap-2 mt-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-3 h-3 bg-white rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
          {puntosTotal > 0 && (
            <div className="mt-6 bg-white/20 rounded-2xl px-6 py-3 inline-block">
              <p className="text-white text-lg font-bold">⭐ {puntosTotal} pts</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // PANTALLA: RESPONDIDO
  // ═══════════════════════════════════════════
  if (estado === 'respondido') {
    const esCorrecta = fueCorrecta

    return (
      <div className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: esCorrecta ? '#00B894' : '#E17055' }}>
        <div className="text-center text-white">
          <div className="text-8xl mb-4">{esCorrecta ? '⭐' : '💪'}</div>
          <h2 className="text-4xl font-bold mb-2">
            {esCorrecta ? '¡Correcto!' : '¡Sigue intentando!'}
          </h2>
          {puntosObtenidos !== null && puntosObtenidos > 0 && (
            <p className="text-2xl font-semibold opacity-90">+{puntosObtenidos} puntos</p>
          )}
          {comentarioIA && (
            <div className="mt-4 bg-white/20 rounded-2xl px-6 py-3 max-w-sm mx-auto">
              <p className="text-sm opacity-90">💬 {comentarioIA}</p>
            </div>
          )}
          <div className="mt-4 bg-white/20 rounded-2xl px-6 py-3 inline-block">
            <p className="text-lg font-bold">⭐ Total: {puntosTotal} pts</p>
          </div>
          <p className="mt-4 opacity-80 text-lg">Espera el siguiente ejercicio...</p>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // PANTALLA: EJERCICIO ACTIVO
  // ═══════════════════════════════════════════
  if (!ejercicio) return null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ background: 'var(--primary)' }}>
        <div>
          <span className="text-white font-bold text-lg">🎓 AprendIA</span>
          {claseInfo?.materia && (
            <p className="text-purple-200 text-xs">{claseInfo.materia}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-white font-semibold">{usuario?.nombre}</p>
          <p className="text-yellow-300 text-sm font-bold">⭐ {puntosTotal} pts</p>
        </div>
      </div>

      {/* Contenido del ejercicio */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-lg p-6 w-full">
          <h2 className="text-xl font-bold mb-6 text-center" style={{ color: 'var(--text)' }}>
            {ejercicio.titulo}
          </h2>

          {/* Seleccion multiple */}
          {ejercicio.tipo === 'seleccion_multiple' && (
            <div className="space-y-3">
              {ejercicio.contenido.pregunta && (
                <p className="text-gray-600 mb-4 text-center">{ejercicio.contenido.pregunta}</p>
              )}
              {(ejercicio.contenido.opciones || []).map((op, i) => {
                const seleccionada = respuesta === i
                return (
                  <button key={i} onClick={() => handleSeleccion(i)}
                    disabled={estado !== 'ejercicio'}
                    className="w-full text-left px-5 py-4 rounded-xl border-2 font-medium transition-all cursor-pointer"
                    style={{
                      borderColor: seleccionada ? 'var(--primary)' : '#e5e7eb',
                      background: seleccionada ? '#f0efff' : 'white',
                      color: 'var(--text)'
                    }}>
                    <span className="font-bold mr-3"
                      style={{ color: 'var(--primary)' }}>
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {op.texto}
                  </button>
                )
              })}
            </div>
          )}

          {/* Matematica desarrollo */}
          {ejercicio.tipo === 'matematica_desarrollo' && (
            <div className="space-y-4">
              {ejercicio.contenido.enunciado && (
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap">
                    {ejercicio.contenido.enunciado}
                  </p>
                </div>
              )}
              <input
                type="text"
                value={respuestaMatematica}
                onChange={e => setRespuestaMatematica(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleMatematica() }}
                placeholder="Escribe tu respuesta..."
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700 text-center text-xl font-bold"
              />
              <button onClick={handleMatematica}
                disabled={!respuestaMatematica.trim()}
                className="w-full py-3 rounded-xl font-bold text-white cursor-pointer disabled:opacity-40"
                style={{ background: 'var(--primary)' }}>
                Enviar respuesta
              </button>
            </div>
          )}

          {/* Completar texto */}
          {ejercicio.tipo === 'completar_texto' && (() => {
            const tokens: { texto: string; esBlanco: boolean }[] = ejercicio.contenido.tokens || []
            let blankIdx = -1
            return (
              <div className="space-y-4">
                <div className="text-lg leading-relaxed text-gray-700 flex flex-wrap items-center gap-1">
                  {tokens.map((token, i) => {
                    if (!token.esBlanco) return <span key={i}>{token.texto}</span>
                    blankIdx++
                    const idx = blankIdx
                    return (
                      <input key={i}
                        type="text"
                        value={respuestasBlancos[idx] || ''}
                        onChange={e => {
                          const copia = [...respuestasBlancos]
                          copia[idx] = e.target.value
                          setRespuestasBlancos(copia)
                        }}
                        className="border-b-2 border-purple-400 focus:outline-none text-center font-bold text-purple-700 bg-transparent"
                        style={{ width: `${Math.max(token.texto.length * 12, 60)}px` }}
                      />
                    )
                  })}
                </div>
                <button onClick={handleBlancos}
                  disabled={respuestasBlancos.some(b => !b.trim())}
                  className="w-full py-3 rounded-xl font-bold text-white cursor-pointer disabled:opacity-40"
                  style={{ background: 'var(--primary)' }}>
                  Enviar respuesta
                </button>
              </div>
            )
          })()}

          {/* Dibujo */}
          {ejercicio.tipo === 'dibujo' && (
            <div className="space-y-4">
              {ejercicio.contenido.instruccion && (
                <p className="text-gray-600 text-center">{ejercicio.contenido.instruccion}</p>
              )}
              <CanvasDibujo ref={canvasRef} />
              <button onClick={handleDibujo}
                className="w-full py-3 rounded-xl font-bold text-white cursor-pointer"
                style={{ background: 'var(--primary)' }}>
                Enviar dibujo
              </button>
            </div>
          )}

          {/* Video YouTube */}
          {ejercicio.tipo === 'video_youtube' && ejercicio.contenido.url_video && (
            <div className="aspect-video rounded-xl overflow-hidden">
              <iframe
                src={(() => {
                  const url = ejercicio.contenido.url_video!
                  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
                  const id = match?.[1]
                  return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : url
                })()}
                className="w-full h-full"
                allow="autoplay"
                allowFullScreen
              />
            </div>
          )}

          {/* Mostrar imagen */}
          {ejercicio.tipo === 'mostrar_imagen' && ejercicio.contenido.url_imagen && (
            <div className="flex justify-center">
              <img src={ejercicio.contenido.url_imagen}
                alt="Imagen del ejercicio"
                className="max-w-full rounded-xl max-h-96 object-contain"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
