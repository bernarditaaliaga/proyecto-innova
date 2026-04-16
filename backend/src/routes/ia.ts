import { Router, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { verificarToken, soloProfesor, AuthRequest } from '../middleware/auth'

const router = Router()

const apiKey = process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  console.error('[IA] ⚠️ ANTHROPIC_API_KEY no está configurada!')
} else {
  console.log(`[IA] API key configurada (${apiKey.slice(0, 10)}...${apiKey.slice(-4)})`)
}
const anthropic = new Anthropic({ apiKey: apiKey || '' })

export async function generarVariantesEjercicio(
  tipo: string,
  contenido: Record<string, unknown>,
  cantidad: number
): Promise<Record<string, unknown>[]> {
  let prompt = ''

  if (tipo === 'matematica_desarrollo') {
    prompt = `Genera exactamente ${cantidad} variantes del siguiente ejercicio matemático para niños de 8-12 años.
Cada variante debe ser del mismo tipo y dificultad, con números distintos.
Ejercicio: "${contenido.enunciado}"
Respuesta correcta: "${contenido.respuesta_correcta}"
Responde SOLO con JSON válido:
{"variantes": [{"enunciado": "...", "respuesta_correcta": "..."}, ...]}`
  }

  else if (tipo === 'seleccion_multiple') {
    const opcionesTexto = ((contenido.opciones || []) as {texto: string; correcta: boolean}[])
      .map((o, i) => `${String.fromCharCode(65 + i)}. ${o.texto}${o.correcta ? ' (correcta)' : ''}`)
      .join('\n')
    prompt = `Genera exactamente ${cantidad} variantes de esta pregunta de selección múltiple para niños de 8-12 años.
Mantén el mismo concepto pero con redacción o ejemplos distintos. La respuesta correcta debe seguir siendo equivalente.
Pregunta: "${contenido.pregunta}"
Opciones:\n${opcionesTexto}
Responde SOLO con JSON válido:
{"variantes": [{"pregunta": "...", "opciones": [{"texto": "...", "correcta": true}, {"texto": "...", "correcta": false}, ...]}, ...]}`
  }

  else if (tipo === 'completar_texto') {
    const tokens = (contenido.tokens || []) as {texto: string; esBlanco: boolean}[]
    const textoConBlancos = tokens.map(t => t.esBlanco ? `[${t.texto}]` : t.texto).join('')
    const respuestas = tokens.filter(t => t.esBlanco).map(t => t.texto)
    prompt = `Genera exactamente ${cantidad} variantes de este ejercicio de completar texto para niños de 8-12 años.
Mantén el mismo concepto pero con oraciones distintas. Usa exactamente ${respuestas.length} blanco(s).
Texto original (palabras entre [] van en los blancos): "${textoConBlancos}"
Responde SOLO con JSON válido:
{"variantes": [{"tokens": [{"texto": "...", "esBlanco": false}, {"texto": "palabra", "esBlanco": true}, ...]}, ...]}`
  }

  if (!prompt) return []

  try {
    console.log(`[IA] Generando ${cantidad} variantes para tipo: ${tipo}`)
    console.log(`[IA] Usando API key: ${apiKey ? `${apiKey.slice(0, 10)}...` : 'NO CONFIGURADA'}`)
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    })
    console.log(`[IA] Respuesta recibida, tokens usados: ${message.usage?.output_tokens}`)

    const texto = message.content[0].type === 'text' ? message.content[0].text : ''
    const match = texto.match(/\{[\s\S]*\}/)
    if (!match) {
      console.error('[IA] No se encontró JSON en respuesta:', texto.slice(0, 200))
      return []
    }

    const data = JSON.parse(match[0])
    console.log(`[IA] Generadas ${(data.variantes || []).length} variantes`)
    return (data.variantes || []) as Record<string, unknown>[]
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string; error?: { type?: string; message?: string } }
    console.error('[IA] Error generando variantes:')
    console.error('[IA]   Status:', err.status)
    console.error('[IA]   Message:', err.message)
    console.error('[IA]   Error type:', err.error?.type)
    console.error('[IA]   Error detail:', err.error?.message)
    return []
  }
}

// Endpoint para previsualizar variantes desde el editor de plan
router.post('/variantes', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { tipo, contenido, cantidad = 5 } = req.body
  if (!tipo || !contenido) { res.status(400).json({ error: 'tipo y contenido requeridos' }); return }

  const variantes = await generarVariantesEjercicio(tipo, contenido, cantidad)
  if (variantes.length === 0) { res.status(500).json({ error: 'Error al generar variantes' }); return }

  res.json({ variantes })
})

export default router
