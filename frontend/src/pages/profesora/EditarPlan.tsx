import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Planificacion, Ejercicio, Materia, Tema, Sala } from '../../types'
import FormSeleccionMultiple from '../../components/ejercicios/FormSeleccionMultiple'
import FormMatematica from '../../components/ejercicios/FormMatematica'
import FormCompletarTexto from '../../components/ejercicios/FormCompletarTexto'

type TipoEjercicio = Ejercicio['tipo'] | 'matematica_desarrollo'

const TIPOS: { valor: TipoEjercicio; etiqueta: string; icono: string; descripcion: string }[] = [
  { valor: 'seleccion_multiple',  etiqueta: 'Selección múltiple', icono: '☑️', descripcion: 'Pregunta con alternativas (texto o imagen)' },
  { valor: 'matematica_desarrollo', etiqueta: 'Matemática desarrollo', icono: '🔢', descripcion: 'Problema con respuesta + variantes IA' },
  { valor: 'completar_texto',     etiqueta: 'Completar texto',    icono: '✏️', descripcion: 'Texto con palabras ocultas' },
  { valor: 'dibujo',              etiqueta: 'Dibujo libre',       icono: '🎨', descripcion: 'El alumno dibuja la respuesta' },
  { valor: 'video_youtube',       etiqueta: 'Video YouTube',      icono: '▶️', descripcion: 'Muestra un video de YouTube' },
  { valor: 'mostrar_imagen',      etiqueta: 'Mostrar imagen',     icono: '🖼️', descripcion: 'Muestra una imagen a todos' },
]

export default function EditarPlan() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<Planificacion | null>(null)
  const [materias, setMaterias] = useState<Materia[]>([])
  const [salas, setSalas] = useState<Sala[]>([])
  const [modal, setModal] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [editForm, setEditForm] = useState({ titulo: '', salaId: '', materiaId: '', fecha: '' })
  const [editTemaIds, setEditTemaIds] = useState<number[]>([])
  const [editCargando, setEditCargando] = useState(false)
  const [editError, setEditError] = useState('')
  const [tipo, setTipo] = useState<TipoEjercicio | null>(null)
  const [titulo, setTitulo] = useState('')
  const [puntos, setPuntos] = useState(10)
  const [temaId, setTemaId] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  // Campos simples
  const [instruccion, setInstruccion] = useState('')
  const [evaluarConIA, setEvaluarConIA] = useState(true)
  const [urlVideo, setUrlVideo] = useState('')
  const [urlImagen, setUrlImagen] = useState('')
  const [subiendoImagen, setSubiendoImagen] = useState(false)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    const [p, m, s] = await Promise.all([
      api.get(`/api/planificaciones/${id}`),
      api.get('/api/materias'),
      api.get('/api/salas')
    ])
    setPlan(p.data)
    setMaterias(m.data)
    setSalas(s.data)
  }

  function abrirModal() {
    setModal(true)
    setTipo(null)
    setTitulo('')
    setPuntos(10)
    setTemaId('')
    setInstruccion('')
    setEvaluarConIA(true)
    setUrlVideo('')
    setUrlImagen('')
    setError('')
  }

  async function guardarConContenido(contenido: unknown, tipoFinal?: string) {
    if (!temaId) { setError('Debes seleccionar un tema'); return }
    setCargando(true)
    try {
      await api.post(`/api/planificaciones/${id}/ejercicios`, {
        titulo,
        tipo: tipoFinal || tipo,
        contenido,
        puntos,
        temaId: temaId ? Number(temaId) : null,
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

  async function handleSimple(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) { setError('Escribe el título'); return }
    let contenido: unknown
    if (tipo === 'dibujo') contenido = { instruccion, evaluar_con_ia: evaluarConIA }
    else if (tipo === 'video_youtube') contenido = { url_video: urlVideo }
    else if (tipo === 'mostrar_imagen') contenido = { url_imagen: urlImagen }
    await guardarConContenido(contenido)
  }

  function abrirEditar() {
    if (!plan) return
    setEditForm({
      titulo: plan.titulo,
      salaId: String(plan.sala_id),
      materiaId: String(plan.materia_id),
      fecha: plan.fecha ? plan.fecha.split('T')[0] : ''
    })
    setEditTemaIds(plan.temas?.map(t => t.id) || [])
    setEditError('')
    setModalEditar(true)
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault()
    if (!editForm.titulo.trim()) { setEditError('Escribe el título'); return }
    setEditCargando(true)
    try {
      await api.put(`/api/planificaciones/${id}`, {
        titulo: editForm.titulo,
        salaId: Number(editForm.salaId),
        materiaId: Number(editForm.materiaId),
        fecha: editForm.fecha || null,
        temaIds: editTemaIds
      })
      setModalEditar(false)
      cargar()
    } catch {
      setEditError('Error al guardar')
    } finally { setEditCargando(false) }
  }

  async function eliminarEjercicio(ejercicioId: number) {
    await api.delete(`/api/planificaciones/${id}/ejercicios/${ejercicioId}`)
    cargar()
  }

  // Temas: usar los de la materia del plan (no solo los seleccionados al crear)
  const materiaDelPlan = materias.find(m => m.id === plan?.materia_id)
  const temasDisponibles: Tema[] = materiaDelPlan?.temas || plan?.temas || []

  if (!plan) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <p className="text-gray-400">Cargando...</p>
    </div>
  )

  const tipoInfo = TIPOS.find(t => t.valor === tipo)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-6 py-4" style={{ background: 'var(--primary)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/profesora/planificaciones')} className="text-white cursor-pointer text-xl">←</button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{plan.titulo}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-purple-200 text-sm">{plan.sala} · {plan.materia}</p>
              {temasDisponibles.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {temasDisponibles.map(t => (
                    <span key={t.id} className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">{t.nombre}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={abrirEditar}
              className="bg-white/20 hover:bg-white/30 text-white font-bold px-3 py-2 rounded-xl text-sm cursor-pointer">
              Editar
            </button>
            <button onClick={() => navigate(`/profesora/sesion/${id}`)}
              className="bg-green-400 hover:bg-green-300 text-white font-bold px-4 py-2 rounded-xl text-sm cursor-pointer">
              ▶ Iniciar clase
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
            Contenido de la clase ({plan.ejercicios?.length || 0} elementos)
          </h2>
          <button onClick={abrirModal}
            className="px-4 py-2 rounded-xl text-white font-semibold text-sm cursor-pointer"
            style={{ background: 'var(--primary)' }}>
            + Añadir
          </button>
        </div>

        {!plan.ejercicios?.length ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-gray-500 mb-4">Esta clase no tiene contenido aún.</p>
            <button onClick={abrirModal}
              className="px-5 py-2 rounded-xl text-white font-semibold cursor-pointer text-sm"
              style={{ background: 'var(--primary)' }}>
              Añadir primer elemento
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {plan.ejercicios.map((ej, i) => {
              const t = TIPOS.find(t => t.valor === ej.tipo) || TIPOS.find(t => t.valor === 'seleccion_multiple')!
              return (
                <div key={ej.id} className="bg-white rounded-xl px-5 py-4 shadow-sm flex items-center gap-3">
                  <span className="text-xl flex-shrink-0">{t.icono}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {i + 1}. {ej.titulo}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">{t.etiqueta}</span>
                      {ej.tema && <span className="text-xs text-purple-500">· {ej.tema}</span>}
                    </div>
                  </div>
                  <span className="font-bold text-sm flex-shrink-0" style={{ color: 'var(--primary)' }}>
                    {ej.puntos}pts
                  </span>
                  <button onClick={() => eliminarEjercicio(ej.id)}
                    className="text-gray-300 hover:text-red-400 cursor-pointer text-xl flex-shrink-0">×</button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal editar planificación */}
      {modalEditar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Editar planificación</h3>
              <button onClick={() => setModalEditar(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl">×</button>
            </div>
            <form onSubmit={guardarEdicion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Título</label>
                <input type="text" value={editForm.titulo}
                  onChange={e => setEditForm(f => ({ ...f, titulo: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Sala</label>
                <select value={editForm.salaId}
                  onChange={e => setEditForm(f => ({ ...f, salaId: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700">
                  <option value="">Selecciona una sala</option>
                  {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Materia</label>
                <select value={editForm.materiaId}
                  onChange={e => setEditForm(f => ({ ...f, materiaId: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700">
                  <option value="">Selecciona una materia</option>
                  {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Fecha (opcional)</label>
                <input type="date" value={editForm.fecha}
                  onChange={e => setEditForm(f => ({ ...f, fecha: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
              </div>

              {/* Temas */}
              {editForm.materiaId && (() => {
                const temasMateria = materias.find(m => m.id === Number(editForm.materiaId))?.temas || []
                return temasMateria.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Temas de la clase</label>
                    <div className="flex flex-wrap gap-2">
                      {temasMateria.map(t => {
                        const sel = editTemaIds.includes(t.id)
                        return (
                          <button key={t.id} type="button"
                            onClick={() => setEditTemaIds(ids =>
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

              {editError && <p className="text-red-500 text-sm">{editError}</p>}
              <button type="submit" disabled={editCargando}
                className="w-full py-3 rounded-xl font-bold text-white cursor-pointer"
                style={{ background: editCargando ? '#a29bfe' : 'var(--primary)' }}>
                {editCargando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal añadir ejercicio */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl my-4 flex flex-col max-h-[90vh]">

            {/* Cabecera modal — sticky */}
            <div className="flex items-center justify-between p-5 pb-3 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
              <div className="flex items-center gap-2">
                {tipo && (
                  <button onClick={() => setTipo(null)}
                    className="text-gray-500 hover:text-purple-600 cursor-pointer text-lg font-bold px-1">←</button>
                )}
                <h3 className="font-bold" style={{ color: 'var(--text)' }}>
                  {tipo ? `${tipoInfo?.icono} ${tipoInfo?.etiqueta}` : 'Añadir a la clase'}
                </h3>
              </div>
              <button onClick={() => setModal(false)}
                className="text-gray-400 hover:text-red-500 cursor-pointer text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 transition-all">×</button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {/* Selección de tipo */}
              {!tipo && (
                <div className="grid grid-cols-2 gap-3">
                  {TIPOS.map(t => (
                    <button key={t.valor} onClick={() => setTipo(t.valor)}
                      className="flex flex-col items-start gap-1 p-4 rounded-xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50 transition-all cursor-pointer text-left">
                      <span className="text-2xl">{t.icono}</span>
                      <span className="text-sm font-bold text-gray-700">{t.etiqueta}</span>
                      <span className="text-xs text-gray-400">{t.descripcion}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Campos comunes (título, puntos, tema) */}
              {tipo && (
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Título del elemento</label>
                    <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} required
                      placeholder="ej: Suma de fracciones"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {tipo !== 'video_youtube' && tipo !== 'mostrar_imagen' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Puntos</label>
                        <input type="number" min={1} max={100} value={puntos}
                          onChange={e => setPuntos(Number(e.target.value))}
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Tema *</label>
                      <select value={temaId} onChange={e => setTemaId(e.target.value)} required
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700">
                        <option value="">Selecciona un tema</option>
                        {temasDisponibles.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                  <hr className="border-gray-100" />
                </div>
              )}

              {/* Formulario según tipo */}
              {tipo === 'seleccion_multiple' && (
                <FormSeleccionMultiple
                  onGuardar={datos => guardarConContenido(datos)}
                  cargando={cargando} />
              )}

              {tipo === 'matematica_desarrollo' && (
                <FormMatematica
                  onGuardar={datos => guardarConContenido(datos, 'matematica_desarrollo')}
                  cargando={cargando} />
              )}

              {tipo === 'completar_texto' && (
                <FormCompletarTexto
                  onGuardar={datos => guardarConContenido(datos)}
                  cargando={cargando} />
              )}

              {(tipo === 'dibujo' || tipo === 'video_youtube' || tipo === 'mostrar_imagen') && (
                <form onSubmit={handleSimple} className="space-y-4">
                  {tipo === 'dibujo' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Instrucción para el alumno</label>
                        <input type="text" value={instruccion} onChange={e => setInstruccion(e.target.value)} required
                          placeholder="ej: Dibuja el ciclo del agua"
                          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
                      </div>
                      <div className="flex items-center gap-3 bg-purple-50 rounded-xl p-3">
                        <input type="checkbox" id="evaluar-ia" checked={evaluarConIA}
                          onChange={e => setEvaluarConIA(e.target.checked)}
                          className="w-4 h-4 cursor-pointer accent-purple-600" />
                        <label htmlFor="evaluar-ia" className="cursor-pointer flex-1">
                          <span className="text-sm font-medium text-gray-700">Evaluar con IA</span>
                          <p className="text-xs text-gray-400">
                            {evaluarConIA
                              ? 'La IA evaluará el dibujo automáticamente'
                              : 'Tú revisarás y puntuarás manualmente después de la clase'}
                          </p>
                        </label>
                      </div>
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
                      <label className="block text-sm font-medium text-gray-600 mb-1">Imagen (JPG, PNG, GIF, WebP)</label>
                      <input type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setSubiendoImagen(true)
                          try {
                            const formData = new FormData()
                            formData.append('imagen', file)
                            const { data } = await api.post('/api/upload', formData, {
                              headers: { 'Content-Type': 'multipart/form-data' }
                            })
                            setUrlImagen(data.url)
                          } catch {
                            setError('Error al subir imagen')
                          } finally { setSubiendoImagen(false) }
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700 text-sm" />
                      {subiendoImagen && <p className="text-sm text-purple-500 mt-1">Subiendo imagen...</p>}
                      <p className="text-xs text-gray-400 mt-1">O pega una URL directamente:</p>
                      <input type="url" value={urlImagen} onChange={e => setUrlImagen(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700 mt-1" />
                      {urlImagen && (
                        <img src={urlImagen} alt="preview" className="mt-2 rounded-lg max-h-32 object-contain w-full border" />
                      )}
                    </div>
                  )}
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <button type="submit" disabled={cargando}
                    className="w-full py-3 rounded-xl font-bold text-white cursor-pointer"
                    style={{ background: cargando ? '#a29bfe' : 'var(--primary)' }}>
                    {cargando ? 'Guardando...' : 'Guardar'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
