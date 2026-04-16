import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()
  const [mostrarCodigo, setMostrarCodigo] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState('')

  function verificarCodigo() {
    if (codigo.trim().toUpperCase() === 'INNOVA26') {
      navigate('/admin')
    } else {
      setError('Codigo incorrecto')
      setCodigo('')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(160deg, #6C5CE7 0%, #a29bfe 60%, #dfe6e9 100%)' }}>

      <div className="text-center mb-10">
        <div className="text-7xl mb-4">🎓</div>
        <h1 className="text-5xl font-bold text-white mb-2">AprendIA</h1>
        <p className="text-purple-200 text-lg">Plataforma educativa interactiva</p>
      </div>

      {!mostrarCodigo ? (
        <div className="flex flex-col gap-4 w-full max-w-sm px-6">
          <button onClick={() => navigate('/login')}
            className="w-full py-5 rounded-2xl font-bold text-xl text-white cursor-pointer shadow-lg transition-transform hover:scale-105"
            style={{ background: '#00B894' }}>
            Soy Alumno
          </button>
          <button onClick={() => setMostrarCodigo(true)}
            className="w-full py-5 rounded-2xl font-bold text-xl text-white cursor-pointer shadow-lg transition-transform hover:scale-105"
            style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
            Soy Profesora
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm px-6">
          <div className="bg-white/20 backdrop-blur rounded-2xl p-6">
            <p className="text-white font-semibold mb-3 text-center">Ingresa el codigo de acceso</p>
            <input
              type="text"
              value={codigo}
              onChange={e => { setCodigo(e.target.value); setError('') }}
              onKeyDown={e => { if (e.key === 'Enter') verificarCodigo() }}
              placeholder="Codigo..."
              autoFocus
              className="w-full px-4 py-3 rounded-xl border-2 border-white/30 bg-white/10 text-white text-center text-xl font-bold placeholder-white/40 focus:outline-none focus:border-white/60"
            />
            {error && <p className="text-red-300 text-sm text-center mt-2">{error}</p>}
            <button onClick={verificarCodigo}
              disabled={!codigo.trim()}
              className="w-full mt-4 py-3 rounded-xl font-bold text-white cursor-pointer disabled:opacity-40"
              style={{ background: '#6C5CE7' }}>
              Entrar
            </button>
            <button onClick={() => { setMostrarCodigo(false); setCodigo(''); setError('') }}
              className="w-full mt-2 py-2 text-purple-200 text-sm cursor-pointer hover:text-white">
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
