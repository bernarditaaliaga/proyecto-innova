import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

export default function Login() {
  const [rol, setRol] = useState<'profesora' | 'alumno' | null>(null)
  const [form, setForm] = useState({ campo: '', password: '' })
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)

    try {
      const body = rol === 'profesora'
        ? { email: form.campo, password: form.password }
        : { username: form.campo, password: form.password }

      const { data } = await api.post(`/api/auth/${rol}`, body)
      login(data.token, data.usuario)
      navigate(rol === 'profesora' ? '/profesora' : '/aula')
    } catch {
      setError('Usuario o contraseña incorrectos')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%)' }}>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🎓</div>
          <h1 className="text-4xl font-bold text-white tracking-tight">AprendIA</h1>
          <p className="text-purple-200 mt-1">Plataforma educativa inteligente</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {!rol ? (
            <>
              <h2 className="text-xl font-bold text-center mb-6" style={{ color: 'var(--text)' }}>
                ¿Quién eres?
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setRol('profesora')}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-purple-100 hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer">
                  <span className="text-4xl">👩‍🏫</span>
                  <span className="font-semibold text-gray-700">Profesora</span>
                </button>
                <button
                  onClick={() => setRol('alumno')}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-purple-100 hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer">
                  <span className="text-4xl">🧒</span>
                  <span className="font-semibold text-gray-700">Alumno</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => { setRol(null); setError('') }}
                className="text-sm text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1 cursor-pointer">
                ← Volver
              </button>
              <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text)' }}>
                {rol === 'profesora' ? '👩‍🏫 Ingreso profesora' : '🧒 Ingreso alumno'}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    {rol === 'profesora' ? 'Correo electrónico' : 'Nombre de usuario'}
                  </label>
                  <input
                    type={rol === 'profesora' ? 'email' : 'text'}
                    value={form.campo}
                    onChange={e => setForm(f => ({ ...f, campo: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700"
                    placeholder={rol === 'profesora' ? 'correo@colegio.cl' : 'usuario123'}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Contraseña</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full py-3 rounded-xl font-bold text-white transition-all cursor-pointer"
                  style={{ background: cargando ? '#a29bfe' : 'var(--primary)' }}>
                  {cargando ? 'Ingresando...' : 'Ingresar'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
