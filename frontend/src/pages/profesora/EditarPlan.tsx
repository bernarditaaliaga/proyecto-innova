import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Planificacion, Ejercicio, Materia } from '../../types'

type TipoEjercicio = Ejercicio['tipo']

const TIPOS: { valor: TipoEjercicio; etiqueta: string; icono: string }[] = [
  { valor: 'seleccion_multiple', etiqueta: 'Selección múltiple', icono: '☑️' },
  { valor: 'completar_texto',    etiqueta: 'Completar texto',    icono: '✏️' },
  { valor: 'dibujo',             etiqueta: 'Dibujo libre',       icono: '🎨' },
  { valor: 'video_youtube',      etiqueta: 'Video YouTube',      icono: '▶️' },
  { valor: 'mostrar_imagen',     etiqueta: 'Mostrar imagen',     icono: '🖼️' },
]

interface Opcion { texto: string; correcta: boolean }

export default function EditarPlan() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<Planificacion | null>(null)
  const [materias, setMaterias] = useState<Materia[]>([])
  const [modal, setModal] = useState(false)
  const [tipo, setTipo] = useState<TipoEjercicio>('seleccion_multiple')
  const [paso, setPaso] = useState<'tipo' | 'form'>('tipo')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  // Campos del formulario
  const [titulo, setTitulo] = useState('')
  const [puntos, setPuntos] = useState(10)
  const [temaId, setTemaId] = useState('')
  const [generarVariantes, setGenerarVariantes] = useState(false)
  const [opciones, setOpciones] = useState<Opcion[]>([
    { texto: '', correcta: false },
    { texto: '', correcta: false },
    { texto: '', correcta: false },
    { texto: '', correcta: false },
  ])
  const [pregunta, setPregunta] = useState('')
  const [textoBlancos, setTextoBlancos] = useState('')
  const [instruccion, setInstruccion] = useState('')
  const [urlVideo, setUrlVideo] = useState('')
  const [urlImagen, setUrlImagen] = useState('')

  useEffect(() => {
    cargar()
  }, [id])

  async function cargar() {
    const [p, m] = await Promise.all([
      api.get(`/api/planificaciones/${id}`),
      api.get('/api/materias')
    ])
    setPlan(p.data)
    setMaterias(m.data)
  }

  function abrirModal() {
    setModal(true)
    setPaso('tipo')
    setTitulo('')
    setPuntos(10)
    setTemaId('')
    setGenerarVariantes(false)
    setPregunta('')
    setTextoBlancos('')
    setInstruccion('')
    setUrlVideo('')
    setUrlImagen('')
    setOpciones([
      { texto: '', correcta: false },
      { texto: '', correcta: false },
      { texto: '', correcta: false },
      { texto: '', correcta: false },
    ])
    setError('')
  }

  function construirContenido() {
    switch (tipo) {
      case 'seleccion_multiple':
        return { pregunta, opciones }
      case 'completar_texto':
        return { texto_con_blancos: textoBlancos }
      case 'dibujo':
        return { instruccion }
      case 'video_youtube':
        return { url_video: urlVideo }
      case 'mostrar_imagen':
        return { url_imagen: urlImagen }
    }
  }

  async function guardarEjercicio(e: React.FormEvent) {
    e.preventDefault()
    if (tipo === 'seleccion_multiple' && !opciones.some(o => o.correcta)) {
      setError('Debes marcar al menos una opción como correcta')
      return
    }
    setError('')
    setCargando(true)
    try {
      await api.post(`/api/planificaciones/${id}/ejercicios`, {
        titulo,
        tipo,
        contenido: construirContenido(),
        puntos,
        temaId: temaId ? Number(temaId) : null,
        generarVariantes,
        orden: plan?.ejercicios?.length || 0
      })
      setModal(false)
      cargar()
    } catch {
      setError('Error al guardar el ejercicio')
    } finally {
      setCargando(false)
    }
  }

  const temasDePlan = materias.find(m => m.id === plan?.materia_id)?.temas || []

  if (!plan) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-gray-400">Cargando...</div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-6 py-4" style={{ background: 'var(--primary)' }}>
        <div className="flex items-center gap-3 mb-1">
          <button onClick={() => navigate('/profesora/planificaciones')} className="text-white cursor-pointer text-xl">←</button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">{plan.titulo}</h1>
            <p className="text-purple-200 text-sm">{plan.sala} · {plan.materia}</p>
          </div>
          <button
            onClick={() => navigate(`/profesora/sesion/${id}`)}
            className="bg-green-400 hover:bg-green-300 text-white font-bold px-4 py-2 rounded-xl text-sm cursor-pointer">
            ▶ Iniciar clase
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6">
        {/* Botón agregar */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
            Ejercicios ({plan.ejercicios?.length || 0})
          </h2>
          <button onClick={abrirModal}
            className="px-4 py-2 rounded-xl text-white font-semibold text-sm cursor-pointer"
            style={{ background: 'var(--primary)' }}>
            + Agregar ejercicio
          </button>
        </div>

        {/* Lista de ejercicios */}
        {!plan.ejercicios?.length ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-gray-500">Aún no hay ejercicios en esta planificación.</p>
            <button onClick={abrirModal}
              className="mt-4 px-5 py-2 rounded-xl text-white font-semibold cursor-pointer text-sm"
              style={{ background: 'var(--primary)' }}>
              Agregar primer ejercicio
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {plan.ejercicios.map((ej, i) => {
              const tipoInfo = TIPOS.find(t => t.valor === ej.tipo)
              return (
                <div key={ej.id} className="bg-white rounded-xl px-5 py-4 shadow-sm flex items-center gap-4">
                  <span className="text-2xl">{tipoInfo?.icono}</span>
                  <div className="flex-1">
                    <p className="font-semibold" style={{ color: 'var(--text)' }}>
                      {i + 1}. {ej.titulo}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{tipoInfo?.etiqueta}</span>
                      {ej.tema && (
                        <span className="text-xs text-gray-400">· {ej.tema}</span>
                      )}
                      {ej.generar_variantes && (
                        <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                          🤖 IA variantes
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-sm" style={{ color: 'var(--primary)' }}>
                    {ej.puntos} pts
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl my-4">
            <div className="flex items-center justify-between p-6 pb-4">
              <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
                {paso === 'tipo' ? 'Tipo de ejercicio' : 'Configurar ejercicio'}
              </h3>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">×</button>
            </div>

            {paso === 'tipo' ? (
              <div className="px-6 pb-6 grid grid-cols-2 gap-3">
                {TIPOS.map(t => (
                  <button key={t.valor}
                    onClick={() => { setTipo(t.valor); setPaso('form') }}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer">
                    <span className="text-3xl">{t.icono}</span>
                    <span className="text-sm font-semibold text-gray-700 text-center">{t.etiqueta}</span>
                  </button>
                ))}
              </div>
            ) : (
              <form onSubmit={guardarEjercicio} className="px-6 pb-6 space-y-4">
                {/* Campos comunes */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Título del ejercicio</label>
                  <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} required
                    placeholder="ej: Suma de fracciones"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Puntos</label>
                    <input type="number" min={1} max={100} value={puntos} onChange={e => setPuntos(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                  </div>
                  {temasDePlan.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Tema</label>
                      <select value={temaId} onChange={e => setTemaId(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700">
                        <option value="">Sin tema</option>
                        {temasDePlan.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Campos según tipo */}
                {tipo === 'seleccion_multiple' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Pregunta</label>
                      <textarea value={pregunta} onChange={e => setPregunta(e.target.value)} rows={2} required
                        placeholder="ej: ¿Cuánto es 3/4 + 1/4?"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700 resize-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">
                        Opciones <span className="text-gray-400 font-normal">(marca la correcta)</span>
                      </label>
                      <div className="space-y-2">
                        {opciones.map((op, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <button type="button"
                              onClick={() => setOpciones(ops => ops.map((o, j) => ({ ...o, correcta: j === i })))}
                              className={`w-6 h-6 rounded-full border-2 flex-shrink-0 cursor-pointer transition-all ${
                                op.correcta ? 'bg-green-500 border-green-500' : 'border-gray-300'
                              }`} />
                            <input type="text" value={op.texto} required
                              onChange={e => setOpciones(ops => ops.map((o, j) => j === i ? { ...o, texto: e.target.value } : o))}
                              placeholder={`Opción ${String.fromCharCode(65 + i)}`}
                              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700 text-sm" />
                          </div>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={generarVariantes} onChange={e => setGenerarVariantes(e.target.checked)}
                        className="w-4 h-4 accent-purple-600" />
                      <span className="text-sm text-gray-600">🤖 Generar variantes con IA (cada alumno recibe una versión diferente)</span>
                    </label>
                  </>
                )}

                {tipo === 'completar_texto' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Texto o instrucción
                      </label>
                      <textarea value={textoBlancos} onChange={e => setTextoBlancos(e.target.value)} rows={3} required
                        placeholder="ej: Completa la oración: El sol sale por el ___"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700 resize-none" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={generarVariantes} onChange={e => setGenerarVariantes(e.target.checked)}
                        className="w-4 h-4 accent-purple-600" />
                      <span className="text-sm text-gray-600">🤖 Generar variantes con IA</span>
                    </label>
                  </>
                )}

                {tipo === 'dibujo' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Instrucción para el alumno</label>
                    <input type="text" value={instruccion} onChange={e => setInstruccion(e.target.value)} required
                      placeholder="ej: Dibuja el ciclo del agua"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                  </div>
                )}

                {tipo === 'video_youtube' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Link de YouTube</label>
                    <input type="url" value={urlVideo} onChange={e => setUrlVideo(e.target.value)} required
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                  </div>
                )}

                {tipo === 'mostrar_imagen' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">URL de la imagen</label>
                    <input type="url" value={urlImagen} onChange={e => setUrlImagen(e.target.value)} required
                      placeholder="https://..."
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                    {urlImagen && (
                      <img src={urlImagen} alt="preview" className="mt-2 rounded-lg max-h-32 object-contain w-full border" />
                    )}
                  </div>
                )}

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setPaso('tipo')}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold cursor-pointer hover:bg-gray-50">
                    ← Cambiar tipo
                  </button>
                  <button type="submit" disabled={cargando}
                    className="flex-1 py-3 rounded-xl font-bold text-white cursor-pointer"
                    style={{ background: cargando ? '#a29bfe' : 'var(--primary)' }}>
                    {cargando ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
