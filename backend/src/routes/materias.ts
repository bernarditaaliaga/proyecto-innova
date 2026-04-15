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

// Crear materia
router.post('/', verificarToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const { nombre, color, icono } = req.body
  if (!nombre?.trim()) { res.status(400).json({ error: 'Nombre requerido' }); return }

  const resultado = await db.query(
    'INSERT INTO materias (nombre, color, icono) VALUES ($1, $2, $3) RETURNING *',
    [nombre.trim(), color || '#4A90D9', icono || '📚']
  )
  res.status(201).json(resultado.rows[0])
})

// Eliminar materia
router.delete('/:id', verificarToken, async (req: AuthRequest, res: Response): Promise<void> => {
  await db.query('DELETE FROM materias WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

// Crear tema dentro de una materia
router.post('/:id/temas', verificarToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const { nombre } = req.body
  if (!nombre?.trim()) { res.status(400).json({ error: 'Nombre requerido' }); return }

  const resultado = await db.query(
    'INSERT INTO temas (nombre, materia_id) VALUES ($1, $2) RETURNING *',
    [nombre.trim(), req.params.id]
  )
  res.status(201).json(resultado.rows[0])
})

// Eliminar tema
router.delete('/temas/:id', verificarToken, async (req: AuthRequest, res: Response): Promise<void> => {
  await db.query('DELETE FROM temas WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

export default router
