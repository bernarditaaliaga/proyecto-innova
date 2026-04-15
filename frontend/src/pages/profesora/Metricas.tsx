import { useNavigate } from 'react-router-dom'

export default function Metricas() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="px-6 py-4 flex items-center gap-4" style={{ background: 'var(--primary)' }}>
        <button onClick={() => navigate('/profesora')} className="text-white cursor-pointer text-xl">←</button>
        <h1 className="text-xl font-bold text-white">Métricas</h1>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
          <div className="text-5xl mb-4">📊</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">Métricas de rendimiento</h2>
          <p className="text-gray-400">
            Las métricas aparecerán aquí una vez que los alumnos comiencen a responder ejercicios.
          </p>
        </div>
      </div>
    </div>
  )
}
