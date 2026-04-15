import { useState } from 'react'

export interface Token { texto: string; esBlanco: boolean }
export interface DatosCompletarTexto { tokens: Token[] }

interface Props {
  onGuardar: (datos: DatosCompletarTexto) => void
  cargando: boolean
}

export default function FormCompletarTexto({ onGuardar, cargando }: Props) {
  const [texto, setTexto] = useState('')
  const [tokens, setTokens] = useState<Token[]>([])
  const [paso, setPaso] = useState<'escribir' | 'marcar'>('escribir')
  const [error, setError] = useState('')

  function procesarTexto() {
    if (!texto.trim()) { setError('Escribe el texto primero'); return }
    // Dividir por espacios manteniendo puntuación como parte de cada palabra
    const palabras = texto.match(/\S+|\s+/g) || []
    setTokens(palabras.map(p => ({ texto: p, esBlanco: false })))
    setPaso('marcar')
    setError('')
  }

  function toggleBlanco(idx: number) {
    // No permitir hacer blanco los espacios
    if (tokens[idx].texto.trim() === '') return
    setTokens(ts => ts.map((t, i) => i === idx ? { ...t, esBlanco: !t.esBlanco } : t))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tokens.some(t => t.esBlanco)) {
      setError('Haz clic en al menos una palabra para hacerla un blanco')
      return
    }
    onGuardar({ tokens })
  }

  const blancos = tokens.filter(t => t.esBlanco).length

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {paso === 'escribir' ? (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Escribe el texto completo</label>
            <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={4}
              placeholder="ej: La fotosíntesis es el proceso por el cual las plantas producen su alimento usando la luz solar"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700 resize-none" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="button" onClick={procesarTexto}
            className="w-full py-3 rounded-xl font-bold text-white cursor-pointer"
            style={{ background: 'var(--primary)' }}>
            Siguiente: marcar blancos →
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-1">
            <button type="button" onClick={() => setPaso('escribir')}
              className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer">← Editar texto</button>
            <span className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
              {blancos} {blancos === 1 ? 'blanco' : 'blancos'} marcados
            </span>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <p className="text-xs text-gray-400 mb-3">
              Toca las palabras que quieres convertir en blancos (aparecerán subrayadas)
            </p>
            <div className="flex flex-wrap gap-0 leading-loose">
              {tokens.map((t, i) => (
                t.texto.trim() === '' ? (
                  <span key={i}>{t.texto}</span>
                ) : (
                  <button key={i} type="button" onClick={() => toggleBlanco(i)}
                    className="cursor-pointer rounded px-0.5 transition-all"
                    style={{
                      background: t.esBlanco ? '#ede9fe' : 'transparent',
                      color: t.esBlanco ? 'var(--primary)' : '#374151',
                      fontWeight: t.esBlanco ? 700 : 400,
                      textDecoration: t.esBlanco ? 'underline' : 'none',
                      fontSize: '15px'
                    }}>
                    {t.texto}
                  </button>
                )
              ))}
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <p className="text-xs text-blue-500 font-medium mb-1">Vista previa para el alumno:</p>
            <p className="text-sm text-gray-700 leading-loose">
              {tokens.map((t, i) => (
                t.esBlanco
                  ? <span key={i} className="inline-block border-b-2 border-gray-400 min-w-12 mx-0.5">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                  : <span key={i}>{t.texto}</span>
              ))}
            </p>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={cargando || blancos === 0}
            className="w-full py-3 rounded-xl font-bold text-white cursor-pointer"
            style={{ background: cargando || blancos === 0 ? '#a29bfe' : 'var(--primary)' }}>
            {cargando ? 'Guardando...' : 'Guardar ejercicio'}
          </button>
        </>
      )}
    </form>
  )
}
