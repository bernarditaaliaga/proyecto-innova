import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Materia } from '../../types'

const COLORES = ['#6C5CE7', '#00B894', '#FDCB6E', '#E17055', '#0984e3', '#fd79a8', '#636e72']
const ICONOS = ['📚', '🔢', '🔬', '🌍', '🎨', '🎵', '💬', '🏃', '🧮', '✏️']

export default function Materias() {
  const navigate = useNavigate()
  const [materias, setMaterias] = useState<Materia[]>([])
  const [nuevaMateria, setNuevaMateria] = useState({ nombre: '', color: '#6C5CE7', icono: '📚' })
  const [nuevoTema, setNuevoTema] = useState<{ [materiaId: number]: string }>({})
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const res = await api.get('/materias')
    setMaterias(res.data)
    setCargando(false)
  }

  async function crearMateria() {
    if (!nuevaMateria.nombre.trim()) return
    await api.post('/materias', nuevaMateria)
    setNuevaMateria({ nombre: '', color: '#6C5CE7', icono: '📚' })
    cargar()
  }

  async function eliminarMateria(id: number) {
    if (!confirm('¿Eliminar esta materia y todos sus temas?')) return
    await api.delete(`/materias/${id}`)
    cargar()
  }

  async function crearTema(materiaId: number) {
    const nombre = nuevoTema[materiaId]?.trim()
    if (!nombre) return
    await api.post(`/materias/${materiaId}/temas`, { nombre })
    setNuevoTema(prev => ({ ...prev, [materiaId]: '' }))
    cargar()
  }

  async function eliminarTema(temaId: number) {
    await api.delete(`/materias/temas/${temaId}`)
    cargar()
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="px-6 py-5 flex items-center gap-4" style={{ background: 'var(--primary)' }}>
        <button onClick={() => navigate('/profesora')}
          className="text-purple-200 hover:text-white cursor-pointer text-xl">←</button>
        <h1 className="text-xl font-bold text-white">Materias y Temas</h1>
      </div>

      <div className="max-w-3xl mx-auto p-6 space-y-6">

        {/* Crear materia */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-lg mb-4" style={{ color: 'var(--text)' }}>Nueva materia</h2>
          <div className="flex flex-col gap-3">
            <input
              value={nuevaMateria.nombre}
              onChange={e => setNuevaMateria(p => ({ ...p, nombre: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') crearMateria() }}
              placeholder="Nombre de la materia (ej: Historia)"
              className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-purple-400"
            />
            <div className="flex gap-4 flex-wrap items-center">
              <div>
                <p className="text-xs text-gray-500 mb-1">Color</p>
                <div className="flex gap-2">
                  {COLORES.map(c => (
                    <button key={c} onClick={() => setNuevaMateria(p => ({ ...p, color: c }))}
                      className="w-7 h-7 rounded-full border-2 cursor-pointer"
                      style={{ background: c, borderColor: nuevaMateria.color === c ? '#2d3436' : 'transparent' }} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Ícono</p>
                <div className="flex gap-1 flex-wrap">
                  {ICONOS.map(ic => (
                    <button key={ic} onClick={() => setNuevaMateria(p => ({ ...p, icono: ic }))}
                      className="w-8 h-8 rounded-lg text-lg border-2 cursor-pointer"
                      style={{ borderColor: nuevaMateria.icono === ic ? '#6C5CE7' : 'transparent',
                               background: nuevaMateria.icono === ic ? '#f0efff' : 'transparent' }}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={crearMateria}
              disabled={!nuevaMateria.nombre.trim()}
              className="self-start px-6 py-2 rounded-xl font-bold text-white cursor-pointer disabled:opacity-40"
              style={{ background: 'var(--primary)' }}>
              Agregar materia
            </button>
          </div>
        </div>

        {/* Lista de materias */}
        {cargando ? (
          <p className="text-center text-gray-400">Cargando...</p>
        ) : materias.map(m => (
          <div key={m.id} className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{m.icono}</span>
                <div>
                  <h3 className="font-bold text-lg" style={{ color: m.color }}>{m.nombre}</h3>
                  <p className="text-xs text-gray-400">{m.temas.length} temas</p>
                </div>
              </div>
              <button onClick={() => eliminarMateria(m.id)}
                className="text-red-400 hover:text-red-600 text-sm cursor-pointer">
                Eliminar
              </button>
            </div>

            {/* Temas */}
            <div className="space-y-2 mb-3">
              {m.temas.map(t => (
                <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ background: '#f8f9fa' }}>
                  <span className="text-sm text-gray-700">{t.nombre}</span>
                  <button onClick={() => eliminarTema(t.id)}
                    className="text-gray-300 hover:text-red-400 cursor-pointer text-xs">✕</button>
                </div>
              ))}
            </div>

            {/* Agregar tema */}
            <div className="flex gap-2">
              <input
                value={nuevoTema[m.id] || ''}
                onChange={e => setNuevoTema(p => ({ ...p, [m.id]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') crearTema(m.id) }}
                placeholder="Nuevo tema..."
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-purple-400"
              />
              <button onClick={() => crearTema(m.id)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer"
                style={{ background: m.color }}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
