import { useState } from 'react'

export interface Opcion { texto: string; correcta: boolean; imagen?: string }
export interface DatosSeleccion {
  pregunta: string
  imagen_pregunta?: string
  opciones: Opcion[]
}

interface Props {
  onGuardar: (datos: DatosSeleccion) => void
  cargando: boolean
}

export default function FormSeleccionMultiple({ onGuardar, cargando }: Props) {
  const [pregunta, setPregunta] = useState('')
  const [imagenPregunta, setImagenPregunta] = useState('')
  const [opciones, setOpciones] = useState<Opcion[]>([
    { texto: '', correcta: false },
    { texto: '', correcta: false },
    { texto: '', correcta: false },
    { texto: '', correcta: false },
  ])
  const [error, setError] = useState('')

  function marcarCorrecta(idx: number) {
    setOpciones(ops => ops.map((o, i) => ({ ...o, correcta: i === idx })))
  }

  function actualizarOpcion(idx: number, campo: 'texto' | 'imagen', valor: string) {
    setOpciones(ops => ops.map((o, i) => i === idx ? { ...o, [campo]: valor } : o))
  }

  function agregarOpcion() {
    if (opciones.length < 6) setOpciones(ops => [...ops, { texto: '', correcta: false }])
  }

  function quitarOpcion(idx: number) {
    if (opciones.length > 2) setOpciones(ops => ops.filter((_, i) => i !== idx))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pregunta.trim()) { setError('Escribe la pregunta'); return }
    if (!opciones.some(o => o.correcta)) { setError('Marca la opción correcta'); return }
    if (opciones.some(o => !o.texto.trim())) { setError('Completa todas las opciones'); return }
    setError('')
    onGuardar({ pregunta, imagen_pregunta: imagenPregunta || undefined, opciones })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">Pregunta</label>
        <textarea value={pregunta} onChange={e => setPregunta(e.target.value)} rows={2} required
          placeholder="ej: ¿Cuál es la capital de Chile?"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700 resize-none" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Imagen para la pregunta <span className="text-gray-400 font-normal">(opcional, pega URL)</span>
        </label>
        <input type="url" value={imagenPregunta} onChange={e => setImagenPregunta(e.target.value)}
          placeholder="https://..."
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
        {imagenPregunta && (
          <img src={imagenPregunta} alt="preview" className="mt-2 rounded-lg max-h-28 object-contain border" />
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-600">
            Opciones <span className="text-gray-400 font-normal">(toca el círculo para marcar la correcta)</span>
          </label>
          {opciones.length < 6 && (
            <button type="button" onClick={agregarOpcion}
              className="text-xs text-purple-600 hover:text-purple-800 cursor-pointer font-semibold">
              + Agregar opción
            </button>
          )}
        </div>
        <div className="space-y-2">
          {opciones.map((op, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => marcarCorrecta(i)}
                  title="Marcar como correcta"
                  className={`w-6 h-6 rounded-full border-2 flex-shrink-0 cursor-pointer transition-all ${
                    op.correcta ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
                  }`} />
                <span className="text-xs font-bold text-gray-400 w-4">{String.fromCharCode(65 + i)}.</span>
                <input type="text" value={op.texto} required
                  onChange={e => actualizarOpcion(i, 'texto', e.target.value)}
                  placeholder={`Opción ${String.fromCharCode(65 + i)}`}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700 text-sm" />
                {opciones.length > 2 && (
                  <button type="button" onClick={() => quitarOpcion(i)}
                    className="text-gray-300 hover:text-red-400 cursor-pointer text-lg leading-none">×</button>
                )}
              </div>
              <div className="pl-14">
                <input type="url" value={op.imagen || ''} placeholder="URL imagen (opcional)"
                  onChange={e => actualizarOpcion(i, 'imagen', e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-100 focus:outline-none focus:border-purple-300 text-gray-500 text-xs" />
                {op.imagen && (
                  <img src={op.imagen} alt="" className="mt-1 h-12 object-contain rounded border" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" disabled={cargando}
        className="w-full py-3 rounded-xl font-bold text-white cursor-pointer"
        style={{ background: cargando ? '#a29bfe' : 'var(--primary)' }}>
        {cargando ? 'Guardando...' : 'Guardar ejercicio'}
      </button>
    </form>
  )
}
