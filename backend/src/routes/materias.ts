import { Router, Response } from 'express'
import { db } from '../db'
import { verificarToken, AuthRequest } from '../middleware/auth'

const router = Router()

// Obtener todas las materias con sus temas
router.get('/', verificarToken, async (_req: AuthRequest, res: Response): Promise<void> => {
  const materias = await db.query('SELECT * FROM materias ORDER BY nombre')
  const temas = await db.query('SELECT * FROM temas ORDER BY nombre')

  const resultado = materias.rows.map(m => ({
    ...m,
    temas: temas.rows.filter(t => t.materia_id === m.id)
  }))

  res.json(resultado)
})

export default router
