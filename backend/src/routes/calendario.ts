import { Router, Response } from 'express'
import { db } from '../db'
import { verificarToken, soloProfesor, AuthRequest } from '../middleware/auth'

const router = Router()

// Get all planificaciones for calendar view (with dates)
router.get('/', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const resultado = await db.query(
    `SELECT p.id, p.titulo, p.fecha, s.nombre AS sala, m.nombre AS materia, m.color AS materia_color,
            COUNT(e.id) AS total_ejercicios
     FROM planificaciones p
     JOIN salas s ON s.id = p.sala_id
     JOIN materias m ON m.id = p.materia_id
     LEFT JOIN ejercicios e ON e.planificacion_id = p.id
     WHERE p.profesora_id = $1 AND p.fecha IS NOT NULL
     GROUP BY p.id, s.nombre, m.nombre, m.color
     ORDER BY p.fecha`,
    [req.usuario!.id]
  )
  res.json(resultado.rows)
})

// Update date of a planificacion
router.put('/:id/fecha', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { fecha } = req.body
  await db.query(
    'UPDATE planificaciones SET fecha = $1 WHERE id = $2 AND profesora_id = $3',
    [fecha || null, req.params.id, req.usuario!.id]
  )
  res.json({ ok: true })
})

// Delete a planificacion
router.delete('/:id', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  await db.query(
    'DELETE FROM planificaciones WHERE id = $1 AND profesora_id = $2',
    [req.params.id, req.usuario!.id]
  )
  res.json({ ok: true })
})

export default router
