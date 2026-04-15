import { Router, Response } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { verificarToken, soloProfesor, AuthRequest } from '../middleware/auth'

const router = Router()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Generar variantes de un ejercicio de matemáticas
router.post('/variantes', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { enunciado, respuestaCorrecta, cantidad = 5 } = req.body

  if (!enunciado) {
    res.status(400).json({ error: 'Enunciado requerido' })
    return
  }

  const prompt = `Eres un asistente educativo para niños de 3ro a 6to básico (8-12 años).
Genera exactamente ${cantidad} variantes del siguiente ejercicio matemático.
Cada variante debe:
- Ser del mismo tipo y dificultad que el original
- Usar números diferentes pero razonables para la edad
- Tener una respuesta correcta clara

Ejercicio original: "${enunciado}"
Respuesta correcta del original: "${respuestaCorrecta}"

Responde ÚNICAMENTE con un JSON válido en este formato exacto, sin texto adicional:
{
  "variantes": [
    {"enunciado": "...", "respuesta_correcta": "..."},
    {"enunciado": "...", "respuesta_correcta": "..."},
    {"enunciado": "...", "respuesta_correcta": "..."},
    {"enunciado": "...", "respuesta_correcta": "..."},
    {"enunciado": "...", "respuesta_correcta": "..."}
  ]
}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  })

  const texto = message.content[0].type === 'text' ? message.content[0].text : ''

  // Extraer JSON de la respuesta
  const match = texto.match(/\{[\s\S]*\}/)
  if (!match) {
    res.status(500).json({ error: 'Error al generar variantes' })
    return
  }

  const data = JSON.parse(match[0])
  res.json(data)
})

export default router
