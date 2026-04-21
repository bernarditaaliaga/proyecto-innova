import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

interface EventoCalendario {
  id: number
  titulo: string
  fecha: string
  sala: string
  materia: string
  materia_color: string
  total_ejercicios: number
}

export default function Calendario() {
  const navigate = useNavigate()
  const [eventos, setEventos] = useState<EventoCalendario[]>([])
  const [mesActual, setMesActual] = useState(new Date())
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const { data } = await api.get('/api/calendario')
      setEventos(data)
    } catch { /* silenciar */ }
    finally { setCargando(false) }
  }

  async function eliminarPlan(id: number) {
    if (!confirm('¿Eliminar esta planificación?')) return
    await api.delete(`/api/calendario/${id}`)
    cargar()
  }

  const año = mesActual.getFullYear()
  const mes = mesActual.getMonth()
  const nombreMes = mesActual.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })

  // Build calendar grid
  const primerDia = new Date(año, mes, 1)
  const ultimoDia = new Date(año, mes + 1, 0)
  const diasEnMes = ultimoDia.getDate()
  const inicioSemana = primerDia.getDay() // 0=Sunday

  const dias: (number | null)[] = []
  for (let i = 0; i < inicioSemana; i++) dias.push(null)
  for (let i = 1; i <= diasEnMes; i++) dias.push(i)

  // Suppress unused variable warnings
  void primerDia
  void ultimoDia

  function eventosDelDia(dia: number) {
    const fecha = `${año}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    return eventos.filter(e => e.fecha?.startsWith(fecha))
  }

  const hoy = new Date()
  const esHoy = (dia: number) =>
    hoy.getFullYear() === año && hoy.getMonth() === mes && hoy.getDate() === dia

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="px-6 py-4 flex items-center gap-4" style={{ background: 'var(--primary)' }}>
        <button onClick={() => navigate('/profesora')} className="text-white cursor-pointer text-xl">←</button>
        <h1 className="text-xl font-bold text-white">Calendario</h1>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setMesActual(new Date(año, mes - 1))}
            className="text-gray-500 hover:text-purple-600 cursor-pointer font-bold text-xl px-3">←</button>
          <h2 className="text-xl font-bold capitalize" style={{ color: 'var(--text)' }}>{nombreMes}</h2>
          <button onClick={() => setMesActual(new Date(año, mes + 1))}
            className="text-gray-500 hover:text-purple-600 cursor-pointer font-bold text-xl px-3">→</button>
        </div>

        {cargando ? (
          <p className="text-center text-gray-400 py-8">Cargando...</p>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                <div key={d} className="text-center text-xs font-bold text-gray-400 py-2">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {dias.map((dia, i) => {
                if (dia === null) return <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-gray-50" />
                const evs = eventosDelDia(dia)
                return (
                  <div key={dia}
                    className={`min-h-[80px] border-b border-r border-gray-50 p-1 ${esHoy(dia) ? 'bg-purple-50' : ''}`}>
                    <span className={`text-xs font-bold inline-block w-6 h-6 text-center leading-6 rounded-full ${esHoy(dia) ? 'bg-purple-600 text-white' : 'text-gray-500'}`}>
                      {dia}
                    </span>
                    <div className="space-y-0.5 mt-0.5">
                      {evs.map(ev => (
                        <div key={ev.id} className="group relative">
                          <button
                            onClick={() => navigate(`/profesora/planificaciones/${ev.id}`)}
                            className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate cursor-pointer text-white font-medium"
                            style={{ background: ev.materia_color || 'var(--primary)', fontSize: '10px' }}>
                            {ev.titulo}
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); eliminarPlan(ev.id) }}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-400 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center cursor-pointer"
                            style={{ fontSize: '8px', lineHeight: 1 }}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Upcoming classes list */}
        <div className="mt-6">
          <h3 className="font-bold mb-3" style={{ color: 'var(--text)' }}>Próximas clases</h3>
          {eventos.filter(e => new Date(e.fecha) >= new Date(new Date().toDateString())).length === 0 ? (
            <p className="text-gray-400 text-sm">No hay clases planificadas próximamente</p>
          ) : (
            <div className="space-y-2">
              {eventos
                .filter(e => new Date(e.fecha) >= new Date(new Date().toDateString()))
                .slice(0, 10)
                .map(ev => (
                  <button key={ev.id} onClick={() => navigate(`/profesora/planificaciones/${ev.id}`)}
                    className="w-full bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3 cursor-pointer hover:shadow-md transition-all text-left">
                    <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: ev.materia_color || 'var(--primary)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{ev.titulo}</p>
                      <p className="text-xs text-gray-400">{ev.sala} · {ev.materia} · {ev.total_ejercicios} ejercicios</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(ev.fecha).toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
