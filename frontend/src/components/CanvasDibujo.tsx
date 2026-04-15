import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react'

interface CanvasDibujoHandle {
  getImagen: () => string
}

const CanvasDibujo = forwardRef<CanvasDibujoHandle>((_, ref) => {
  const canvasEl = useRef<HTMLCanvasElement>(null)
  const dibujando = useRef(false)
  const [color, setColor] = useState('#2D3436')
  const [grosor, setGrosor] = useState(4)

  useImperativeHandle(ref, () => ({
    getImagen: () => canvasEl.current?.toDataURL('image/png') || ''
  }))

  useEffect(() => {
    const canvas = canvasEl.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasEl.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  function iniciar(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    dibujando.current = true
    const ctx = canvasEl.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function dibujar(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!dibujando.current) return
    const ctx = canvasEl.current!.getContext('2d')!
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = color
    ctx.lineWidth = grosor
    ctx.lineCap = 'round'
    ctx.stroke()
  }

  function terminar() { dibujando.current = false }

  function limpiar() {
    const canvas = canvasEl.current!
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const colores = ['#2D3436', '#E17055', '#6C5CE7', '#00B894', '#FDCB6E', '#0984e3', '#fd79a8']

  return (
    <div className="space-y-3">
      {/* Controles */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {colores.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full border-2 cursor-pointer transition-transform hover:scale-110"
              style={{
                background: c,
                borderColor: color === c ? '#6C5CE7' : '#e5e7eb',
                transform: color === c ? 'scale(1.2)' : 'scale(1)'
              }} />
          ))}
        </div>
        <input type="range" min={2} max={20} value={grosor}
          onChange={e => setGrosor(Number(e.target.value))}
          className="w-24" />
        <button onClick={limpiar}
          className="ml-auto text-sm px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 cursor-pointer">
          Borrar todo
        </button>
      </div>

      {/* Canvas */}
      <canvas ref={canvasEl}
        width={600} height={400}
        className="w-full border-2 border-gray-200 rounded-xl touch-none"
        style={{ cursor: 'crosshair', background: 'white' }}
        onMouseDown={iniciar} onMouseMove={dibujar} onMouseUp={terminar} onMouseLeave={terminar}
        onTouchStart={iniciar} onTouchMove={dibujar} onTouchEnd={terminar}
      />
    </div>
  )
})

CanvasDibujo.displayName = 'CanvasDibujo'
export default CanvasDibujo
