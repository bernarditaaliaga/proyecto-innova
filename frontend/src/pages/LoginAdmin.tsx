import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

type Vista = 'login' | 'registro'

export default function LoginAdmin() {
  const [vista, setVista] = useState<Vista>('login')
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [regForm, setRegForm] = useState({ nombre: '', email: '', password: '', codigoRegistro: '' })
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [cargando, setCargando] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      const { data } = await api.post('/api/auth/profesora', loginForm)
      login(data.token, data.usuario)
      navigate('/profesora')
    } catch {
      setError('Email o contraseña incorrectos')
    } finally {
      setCargando(false)
    }
  }

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await api.post('/api/auth/registro-profesora', regForm)
      setExito('Cuenta creada. Ahora puedes iniciar sesión.')
      setVista('login')
      setLoginForm({ email: regForm.email, password: '' })
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setError(e.response?.data?.error || 'Error al registrarse')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>🎓 AprendIA</h1>
          <p className="text-gray-500 text-sm mt-1">Panel de profesoras</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-xl p-1 mb-4 shadow-sm">
          {(['login', 'registro'] as Vista[]).map(v => (
            <button key={v} onClick={() => { setVista(v); setError(''); setExito('') }}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer"
              style={{
                background: vista === v ? 'var(--primary)' : 'transparent',
                color: vista === v ? 'white' : 'var(--muted)'
              }}>
              {v === 'login' ? 'Iniciar sesión' : 'Registrarse'}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {exito && <div className="bg-green-50 text-green-700 text-sm px-4 py-2 rounded-lg mb-4">{exito}</div>}

          {vista === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Campo label="Correo" tipo="email" placeholder="correo@colegio.cl"
                value={loginForm.email} onChange={v => setLoginForm(f => ({ ...f, email: v }))} />
              <Campo label="Contraseña" tipo="password" placeholder="••••••••"
                value={loginForm.password} onChange={v => setLoginForm(f => ({ ...f, password: v }))} />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <BtnSubmit cargando={cargando} texto="Ingresar" />
            </form>
          ) : (
            <form onSubmit={handleRegistro} className="space-y-4">
              <Campo label="Nombre" tipo="text" placeholder="María González"
                value={regForm.nombre} onChange={v => setRegForm(f => ({ ...f, nombre: v }))} />
              <Campo label="Correo" tipo="email" placeholder="correo@colegio.cl"
                value={regForm.email} onChange={v => setRegForm(f => ({ ...f, email: v }))} />
              <Campo label="Contraseña" tipo="password" placeholder="••••••••"
                value={regForm.password} onChange={v => setRegForm(f => ({ ...f, password: v }))} />
              <Campo label="Código de registro" tipo="password" placeholder="Entregado por el colegio"
                value={regForm.codigoRegistro} onChange={v => setRegForm(f => ({ ...f, codigoRegistro: v }))} />
              <p className="text-xs text-gray-400">El código de registro lo entrega el administrador del colegio.</p>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <BtnSubmit cargando={cargando} texto="Crear cuenta" />
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Campo({ label, tipo, placeholder, value, onChange }: {
  label: string; tipo: string; placeholder: string
  value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
      <input type={tipo} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required
        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-purple-400 text-gray-700" />
    </div>
  )
}

function BtnSubmit({ cargando, texto }: { cargando: boolean; texto: string }) {
  return (
    <button type="submit" disabled={cargando}
      className="w-full py-3 rounded-xl font-bold text-white cursor-pointer"
      style={{ background: cargando ? '#a29bfe' : 'var(--primary)' }}>
      {cargando ? 'Cargando...' : texto}
    </button>
  )
}
