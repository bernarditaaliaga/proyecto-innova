import { Router, Response } from 'express'
import { db } from '../db'
import { verificarToken, soloProfesor, AuthRequest } from '../middleware/auth'

const router = Router()

// Obtener planificaciones de la profesora
router.get('/', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const resultado = await db.query(
    `SELECT p.*, s.nombre AS sala, m.nombre AS materia, m.color AS materia_color,
            COUNT(e.id) AS total_ejercicios
     FROM planificaciones p
     JOIN salas s ON s.id = p.sala_id
     JOIN materias m ON m.id = p.materia_id
     LEFT JOIN ejercicios e ON e.planificacion_id = p.id
     WHERE p.profesora_id = $1
     GROUP BY p.id, s.nombre, m.nombre, m.color
     ORDER BY p.fecha DESC, p.creado_en DESC`,
    [req.usuario!.id]
  )
  res.json(resultado.rows)
})

// Obtener planificación con ejercicios y temas
router.get('/:id', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const plan = await db.query(
    `SELECT p.*, s.nombre AS sala, s.id AS sala_id, m.nombre AS materia, m.id AS materia_id
     FROM planificaciones p
     JOIN salas s ON s.id = p.sala_id
     JOIN materias m ON m.id = p.materia_id
     WHERE p.id = $1 AND p.profesora_id = $2`,
    [req.params.id, req.usuario!.id]
  )
  if (plan.rows.length === 0) {
    res.status(404).json({ error: 'Planificación no encontrada' })
    return
  }

  const ejercicios = await db.query(
    `SELECT e.*, t.nombre AS tema
     FROM ejercicios e
     LEFT JOIN temas t ON t.id = e.tema_id
     WHERE e.planificacion_id = $1
     ORDER BY e.orden`,
    [req.params.id]
  )

  const temas = await db.query(
    `SELECT t.* FROM temas t
     JOIN planificacion_temas pt ON pt.tema_id = t.id
     WHERE pt.planificacion_id = $1`,
    [req.params.id]
  )

  res.json({ ...plan.rows[0], ejercicios: ejercicios.rows, temas: temas.rows })
})

// Crear planificación con temas
router.post('/', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { titulo, salaId, materiaId, fecha, temaIds } = req.body
  if (!titulo || !salaId || !materiaId) {
    res.status(400).json({ error: 'Faltan campos obligatorios' })
    return
  }

  const resultado = await db.query(
    `INSERT INTO planificaciones (titulo, profesora_id, sala_id, materia_id, fecha)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [titulo, req.usuario!.id, salaId, materiaId, fecha || null]
  )
  const plan = resultado.rows[0]

  // Guardar temas de la planificación
  if (temaIds && temaIds.length > 0) {
    for (const temaId of temaIds) {
      await db.query(
        'INSERT INTO planificacion_temas (planificacion_id, tema_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [plan.id, temaId]
      )
    }
  }

  res.status(201).json(plan)
})

// Agregar ejercicio a planificación
router.post('/:id/ejercicios', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { titulo, tipo, contenido, puntos, temaId, orden } = req.body

  if (!titulo || !tipo || !contenido) {
    res.status(400).json({ error: 'Faltan campos obligatorios' })
    return
  }

  const resultado = await db.query(
    `INSERT INTO ejercicios (planificacion_id, tema_id, titulo, tipo, contenido, puntos, orden)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.params.id, temaId || null, titulo, tipo, JSON.stringify(contenido), puntos || 10, orden || 0]
  )
  res.status(201).json(resultado.rows[0])
})

// Eliminar ejercicio
router.delete('/:id/ejercicios/:ejercicioId', verificarToken, soloProfesor, async (_req: AuthRequest, res: Response): Promise<void> => {
  await db.query('DELETE FROM ejercicios WHERE id = $1', [_req.params.ejercicioId])
  res.json({ ok: true })
})

export default router
