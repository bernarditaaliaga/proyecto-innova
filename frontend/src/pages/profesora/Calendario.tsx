import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

interface EventoCalendario {
  id: number
  titulo: string
  fecha: string
  hora_inicio: string | null
  duracion_minutos: number | null
  sala: string
  materia: string
  materia_color: string
  total_ejercicios: number
}

const HORAS = Array.from({ length: 11 }, (_, i) => i + 7) // 7:00 - 17:00
const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']

function getLunesDeSemana(date: Date): Date {
  const d = new Date(date)
  const dia = d.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatFecha(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function Calendario() {
  const navigate = useNavigate()
  const [eventos, setEventos] = useState<EventoCalendario[]>([])
  const [semanaBase, setSemanaBase] = useState(getLunesDeSemana(new Date()))
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

  // Navegación
  function semanaAnterior() {
    setSemanaBase(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return d
    })
  }
  function semanaSiguiente() {
    setSemanaBase(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return d
    })
  }
  function irAHoy() {
    setSemanaBase(getLunesDeSemana(new Date()))
  }

  // Días de la semana actual
  const diasSemana = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(semanaBase)
    d.setDate(d.getDate() + i)
    return d
  })

  const hoy = new Date()
  const hoyStr = formatFecha(hoy)

  // Rango de la semana para mostrar
  const rangoTexto = (() => {
    const inicio = diasSemana[0]
    const fin = diasSemana[4]
    const mesInicio = inicio.toLocaleDateString('es-CL', { month: 'short' })
    const mesFin = fin.toLocaleDateString('es-CL', { month: 'short' })
    if (mesInicio === mesFin) {
      return `${inicio.getDate()} - ${fin.getDate()} ${mesFin} ${fin.getFullYear()}`
    }
    return `${inicio.getDate()} ${mesInicio} - ${fin.getDate()} ${mesFin} ${fin.getFullYear()}`
  })()

  // Eventos por día
  function eventosDelDia(fecha: string): EventoCalendario[] {
    return eventos.filter(e => e.fecha?.startsWith(fecha))
  }

  // Posición y tamaño de un evento en la grilla
  function estiloEvento(ev: EventoCalendario): { top: string; height: string } {
    const hora = ev.hora_inicio ? parseInt(ev.hora_inicio.split(':')[0]) : 8
    const minuto = ev.hora_inicio ? parseInt(ev.hora_inicio.split(':')[1]) : 0
    const duracion = ev.duracion_minutos || 45
    const topPx = ((hora - 7) * 60 + minuto)
    const heightPx = duracion
    return {
      top: `${topPx}px`,
      height: `${Math.max(heightPx, 25)}px`
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4" style={{ background: 'var(--primary)' }}>
        <button onClick={() => navigate('/profesora')} className="text-white cursor-pointer text-xl">←</button>
        <h1 className="text-xl font-bold text-white flex-1">Calendario</h1>
        <button onClick={() => navigate('/profesora/planificaciones')}
          className="bg-white/20 hover:bg-white/30 text-white text-sm px-4 py-2 rounded-xl cursor-pointer font-semibold">
          + Nueva clase
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Navegación semana */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={semanaAnterior}
              className="text-gray-500 hover:text-purple-600 cursor-pointer font-bold text-lg px-2 py-1 rounded-lg hover:bg-purple-50">←</button>
            <button onClick={semanaSiguiente}
              className="text-gray-500 hover:text-purple-600 cursor-pointer font-bold text-lg px-2 py-1 rounded-lg hover:bg-purple-50">→</button>
            <button onClick={irAHoy}
              className="text-sm font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-purple-50 cursor-pointer text-gray-600 ml-1">
              Hoy
            </button>
          </div>
          <h2 className="text-lg font-bold capitalize" style={{ color: 'var(--text)' }}>{rangoTexto}</h2>
        </div>

        {cargando ? (
          <p className="text-center text-gray-400 py-8">Cargando...</p>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Header: días */}
            <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: '60px repeat(5, 1fr)' }}>
              <div className="border-r border-gray-100" />
              {diasSemana.map((dia, i) => {
                const esHoyDia = formatFecha(dia) === hoyStr
                return (
                  <div key={i} className={`text-center py-3 border-r border-gray-100 ${esHoyDia ? 'bg-purple-50' : ''}`}>
                    <p className="text-xs font-semibold text-gray-400 uppercase">{DIAS_SEMANA[i]}</p>
                    <p className={`text-lg font-bold mt-0.5 ${esHoyDia ? 'text-purple-600' : 'text-gray-700'}`}>
                      {dia.getDate()}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Grid horario */}
            <div className="grid relative" style={{ gridTemplateColumns: '60px repeat(5, 1fr)' }}>
              {/* Columna de horas */}
              <div className="border-r border-gray-100">
                {HORAS.map(h => (
                  <div key={h} className="h-[60px] flex items-start justify-end pr-2 pt-0.5">
                    <span className="text-xs text-gray-400 font-medium">{String(h).padStart(2, '0')}:00</span>
                  </div>
                ))}
              </div>

              {/* Columnas de días */}
              {diasSemana.map((dia, diaIdx) => {
                const fechaStr = formatFecha(dia)
                const evsDia = eventosDelDia(fechaStr)
                const esHoyDia = fechaStr === hoyStr

                return (
                  <div key={diaIdx} className={`relative border-r border-gray-100 ${esHoyDia ? 'bg-purple-50/30' : ''}`}>
                    {/* Líneas de hora */}
                    {HORAS.map(h => (
                      <div key={h} className="h-[60px] border-b border-gray-50" />
                    ))}

                    {/* Línea de hora actual */}
                    {esHoyDia && (() => {
                      const ahora = new Date()
                      const minDesde7 = (ahora.getHours() - 7) * 60 + ahora.getMinutes()
                      if (minDesde7 < 0 || minDesde7 > 660) return null
                      return (
                        <div className="absolute left-0 right-0 z-10 pointer-events-none"
                          style={{ top: `${minDesde7}px` }}>
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-red-500 rounded-full -ml-1" />
                            <div className="flex-1 h-0.5 bg-red-500" />
                          </div>
                        </div>
                      )
                    })()}

                    {/* Eventos */}
                    {evsDia.map(ev => {
                      const estilo = estiloEvento(ev)
                      const horaTexto = ev.hora_inicio ? ev.hora_inicio.slice(0, 5) : ''
                      return (
                        <button key={ev.id}
                          onClick={() => navigate(`/profesora/planificaciones/${ev.id}`)}
                          className="absolute left-1 right-1 rounded-lg px-2 py-1 cursor-pointer text-left overflow-hidden z-20 hover:opacity-90 transition-opacity shadow-sm"
                          style={{
                            top: estilo.top,
                            height: estilo.height,
                            background: ev.materia_color || 'var(--primary)',
                            minHeight: '25px'
                          }}>
                          <p className="text-white font-semibold truncate" style={{ fontSize: '11px' }}>
                            {ev.titulo}
                          </p>
                          <p className="text-white/80 truncate" style={{ fontSize: '10px' }}>
                            {horaTexto && `${horaTexto} · `}{ev.sala}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
