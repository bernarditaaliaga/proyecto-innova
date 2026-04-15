import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../hooks/useSocket'
import type { Ejercicio } from '../../types'
import CanvasDibujo from '../../components/CanvasDibujo'

type EstadoAula = 'esperando' | 'ejercicio' | 'respondido'

export default function Aula() {
  const { usuario, logout } = useAuth()
  const socket = useSocket()
  const [estado, setEstado] = useState<EstadoAula>('esperando')
  const [ejercicio, setEjercicio] = useState<Ejercicio | null>(null)
  const [sesionId, setSesionId] = useState<number | null>(null)
  const [respuesta, setRespuesta] = useState<string | number | null>(null)
  const [fueCorrecta, setFueCorrecta] = useState<boolean>(true)
  const [puntosObtenidos, setPuntosObtenidos] = useState<number | null>(null)
  const [tiempoInicio, setTiempoInicio] = useState<number>(0)
  const [respuestaMatematica, setRespuestaMatematica] = useState('')
  const [respuestasBlancos, setRespuestasBlancos] = useState<string[]>([])
  const [textoLibre, setTextoLibre] = useState('')
  const canvasRef = useRef<{ getImagen: () => string } | null>(null)

  useEffect(() => {
    if (!socket || !usuario) return

    socket.emit('alumno:unirse', { salaId: usuario.salaId, alumnoId: usuario.id })

    socket.on('sesion:esperando', () => setEstado('esperando'))
    socket.on('sesion:iniciada', (data: { sesionId: number }) => {
      setSesionId(data.sesionId)
    })

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

    socket.on('ejercicio:cerrado', () => {
      setEjercicio(null)
      setEstado('esperando')
    })

    socket.on('sesion:finalizada', () => {
      setEstado('esperando')
      setEjercicio(null)
      setSesionId(null)
    })

    socket.on('respuesta:confirmada', (data: { puntosObtenidos: number }) => {
      setPuntosObtenidos(data.puntosObtenidos)
      setEstado('respondido')
    })

    return () => {
      socket.off('sesion:esperando')
      socket.off('sesion:iniciada')
      socket.off('ejercicio:nuevo')
      socket.off('ejercicio:cerrado')
      socket.off('sesion:finalizada')
      socket.off('respuesta:confirmada')
    }
  }, [socket, usuario])

  function enviarRespuesta(contenido: unknown, esCorrecta: boolean) {
    if (!socket || !ejercicio || !sesionId || !usuario) return
    const tiempoSegundos = Math.round((Date.now() - tiempoInicio) / 1000)
    setFueCorrecta(esCorrecta)

    socket.emit('alumno:responder', {
      alumnoId: usuario.id,
      ejercicioId: ejercicio.id,
      sesionId,
      contenido,
      esCorrecta,
      tiempoSegundos
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
    const correcta = String(ejercicio.contenido.respuesta_correcta || '').trim().toLowerCase()
    const dada = respuestaMatematica.trim().toLowerCase()
    enviarRespuesta({ respuesta: respuestaMatematica }, dada === correcta)
  }

  function handleTexto() {
    if (!textoLibre.trim() || !ejercicio) return
    enviarRespuesta({ texto: textoLibre }, true)
  }

  function handleBlancos() {
    if (!ejercicio) return
    enviarRespuesta({ blancos: respuestasBlancos }, true)
  }

  function handleDibujo() {
    if (!canvasRef.current || !ejercicio) return
    const imagen = canvasRef.current.getImagen()
    enviarRespuesta({ imagen }, true)
  }

  // PANTALLA DE ESPERA
  if (estado === 'esperando') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #6C5CE7 0%, #a29bfe 60%, #dfe6e9 100%)' }}>
        <div className="text-center">
          <div className="text-8xl mb-6 animate-bounce">📚</div>
          <h1 className="text-4xl font-bold text-white mb-2">
            Hola, {usuario?.nombre}
          </h1>
          {usuario?.sala && (
            <p className="text-purple-200 text-lg">{usuario.sala}</p>
          )}
          <div className="mt-10 bg-white/20 backdrop-blur rounded-2xl px-8 py-4">
            <p className="text-white text-lg font-medium">Esperando a la profesora...</p>
            <div className="flex justify-center gap-2 mt-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-3 h-3 bg-white rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          </div>
        </div>
        <button onClick={logout}
          className="absolute bottom-4 right-4 text-white/30 text-xs hover:text-white/60 cursor-pointer">
          salir
        </button>
      </div>
    )
  }

  // PANTALLA RESPONDIDO
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
          <p className="mt-4 opacity-80 text-lg">Espera el siguiente ejercicio...</p>
        </div>
      </div>
    )
  }

  // EJERCICIO ACTIVO
  if (!ejercicio) return null

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ background: 'var(--primary)' }}>
        <span className="text-white font-bold text-lg">🎓 AprendIA</span>
        <div className="text-right">
          <p className="text-white font-semibold">{usuario?.nombre}</p>
          <p className="text-purple-200 text-sm">{ejercicio.puntos} pts</p>
        </div>
      </div>

      {/* Contenido del ejercicio */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-lg p-6 w-full">
          <h2 className="text-xl font-bold mb-6 text-center" style={{ color: 'var(--text)' }}>
            {ejercicio.titulo}
          </h2>

          {/* Selección múltiple */}
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

          {/* Matemática desarrollo */}
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
