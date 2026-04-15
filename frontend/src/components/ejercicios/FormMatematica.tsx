import { useState } from 'react'
import { api } from '../../lib/api'

export interface DatosMatematica {
  enunciado: string
  respuesta_correcta: string
  variantes?: { enunciado: string; respuesta_correcta: string }[]
}

interface Props {
  onGuardar: (datos: DatosMatematica) => void
  cargando: boolean
}

export default function FormMatematica({ onGuardar, cargando }: Props) {
  const [enunciado, setEnunciado] = useState('')
  const [respuesta, setRespuesta] = useState('')
  const [variantes, setVariantes] = useState<{ enunciado: string; respuesta_correcta: string }[]>([])
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState('')
  const [paso, setPaso] = useState<'editar' | 'variantes'>('editar')

  async function generarVariantes() {
    if (!enunciado.trim() || !respuesta.trim()) {
      setError('Escribe el ejercicio y la respuesta correcta primero')
      return
    }
    setError('')
    setGenerando(true)
    try {
      const { data } = await api.post('/api/ia/variantes', {
        enunciado,
        respuestaCorrecta: respuesta,
        cantidad: 5
      })
      setVariantes(data.variantes)
      setPaso('variantes')
    } catch {
      setError('Error al generar variantes. Revisa que la API Key de IA esté configurada.')
    } finally {
      setGenerando(false)
    }
  }

  function actualizarVariante(idx: number, campo: 'enunciado' | 'respuesta_correcta', valor: string) {
    setVariantes(vs => vs.map((v, i) => i === idx ? { ...v, [campo]: valor } : v))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!enunciado.trim() || !respuesta.trim()) {
      setError('Completa el ejercicio y la respuesta')
      return
    }
    onGuardar({ enunciado, respuesta_correcta: respuesta, variantes: variantes.length > 0 ? variantes : undefined })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {paso === 'editar' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Enunciado del ejercicio</label>
            <textarea value={enunciado} onChange={e => setEnunciado(e.target.value)} rows={3} required
              placeholder="ej: Calcula el área de un rectángulo de 6 cm × 4 cm"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Respuesta correcta</label>
            <input type="text" value={respuesta} onChange={e => setRespuesta(e.target.value)} required
              placeholder="ej: 24 cm²"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
          </div>

          <button type="button" onClick={generarVariantes} disabled={generando}
            className="w-full py-3 rounded-xl font-semibold border-2 cursor-pointer transition-all"
            style={{ borderColor: 'var(--primary)', color: generando ? '#a29bfe' : 'var(--primary)', background: 'white' }}>
            {generando ? '🤖 Generando variantes...' : '🤖 Generar 5 variantes con IA'}
          </button>
          <p className="text-xs text-gray-400 text-center -mt-2">
            La IA crea 5 versiones diferentes para que cada alumno reciba una distinta
          </p>
        </>
      )}

      {paso === 'variantes' && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <button type="button" onClick={() => setPaso('editar')}
              className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">← Volver</button>
            <h4 className="font-bold text-gray-700">5 variantes generadas por IA</h4>
          </div>
          <p className="text-xs text-gray-400 mb-3">Puedes editar cualquier variante antes de guardar.</p>

          {/* Original */}
          <div className="bg-purple-50 rounded-xl p-3 border border-purple-200">
            <p className="text-xs font-bold text-purple-500 mb-1">ORIGINAL</p>
            <p className="text-sm text-gray-700">{enunciado}</p>
            <p className="text-xs text-green-600 font-semibold mt-1">✓ {respuesta}</p>
          </div>

          {/* Variantes */}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {variantes.map((v, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <p className="text-xs font-bold text-gray-400 mb-1">VARIANTE {i + 1}</p>
                <textarea value={v.enunciado}
                  onChange={e => actualizarVariante(i, 'enunciado', e.target.value)}
                  rows={2} className="w-full text-sm text-gray-700 bg-transparent resize-none outline-none border-b border-gray-200 mb-1" />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">Respuesta:</span>
                  <input type="text" value={v.respuesta_correcta}
                    onChange={e => actualizarVariante(i, 'respuesta_correcta', e.target.value)}
                    className="flex-1 text-xs text-green-600 font-semibold bg-transparent outline-none" />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button type="submit" disabled={cargando}
        className="w-full py-3 rounded-xl font-bold text-white cursor-pointer"
        style={{ background: cargando ? '#a29bfe' : 'var(--primary)' }}>
        {cargando ? 'Guardando...' : variantes.length > 0 ? 'Guardar ejercicio + variantes IA' : 'Guardar ejercicio'}
      </button>
    </form>
  )
}
