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

// Editar planificación
router.put('/:id', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { titulo, salaId, materiaId, fecha, temaIds } = req.body

  // Verificar que existe y pertenece a la profesora
  const existe = await db.query('SELECT id FROM planificaciones WHERE id = $1 AND profesora_id = $2', [req.params.id, req.usuario!.id])
  if (existe.rows.length === 0) {
    res.status(404).json({ error: 'Planificación no encontrada' })
    return
  }

  await db.query(
    `UPDATE planificaciones SET titulo = COALESCE($1, titulo), sala_id = COALESCE($2, sala_id),
     materia_id = COALESCE($3, materia_id), fecha = $4
     WHERE id = $5 AND profesora_id = $6`,
    [titulo, salaId, materiaId, fecha || null, req.params.id, req.usuario!.id]
  )

  // Actualizar temas si se proporcionan
  if (temaIds !== undefined) {
    await db.query('DELETE FROM planificacion_temas WHERE planificacion_id = $1', [req.params.id])
    if (temaIds && temaIds.length > 0) {
      for (const temaId of temaIds) {
        await db.query(
          'INSERT INTO planificacion_temas (planificacion_id, tema_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, temaId]
        )
      }
    }
  }

  res.json({ ok: true })
})

// Agregar ejercicio a planificación
router.post('/:id/ejercicios', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { titulo, tipo, contenido, puntos, temaId, orden } = req.body

  if (!titulo || !tipo || !contenido) {
    res.status(400).json({ error: 'Faltan campos obligatorios' })
    return
  }

  if (!temaId) {
    res.status(400).json({ error: 'Debes seleccionar un tema' })
    return
  }

  const resultado = await db.query(
    `INSERT INTO ejercicios (planificacion_id, tema_id, titulo, tipo, contenido, puntos, orden)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.params.id, temaId, titulo, tipo, JSON.stringify(contenido), puntos || 10, orden || 0]
  )
  res.status(201).json(resultado.rows[0])
})

// Eliminar ejercicio
router.delete('/:id/ejercicios/:ejercicioId', verificarToken, soloProfesor, async (_req: AuthRequest, res: Response): Promise<void> => {
  await db.query('DELETE FROM ejercicios WHERE id = $1', [_req.params.ejercicioId])
  res.json({ ok: true })
})

// Editar puntos de una respuesta (evaluación manual)
router.put('/respuestas/:respuestaId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { puntosObtenidos, esCorreecto } = req.body
  await db.query(
    `UPDATE respuestas SET puntos_obtenidos = $1, es_correcto = $2 WHERE id = $3`,
    [puntosObtenidos, esCorreecto ?? (puntosObtenidos > 0), req.params.respuestaId]
  )
  res.json({ ok: true })
})

// Obtener respuestas de un ejercicio en una sesión (para revisión)
router.get('/:id/ejercicios/:ejercicioId/respuestas', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const resultado = await db.query(
    `SELECT r.id, r.alumno_id, a.nombre || ' ' || a.apellido AS alumno,
            r.contenido, r.es_correcto, r.puntos_obtenidos, r.tiempo_segundos,
            e.puntos AS puntos_max, e.tipo, e.contenido AS ejercicio_contenido
     FROM respuestas r
     JOIN alumnos a ON a.id = r.alumno_id
     JOIN ejercicios e ON e.id = r.ejercicio_id
     WHERE r.ejercicio_id = $1
     ORDER BY a.apellido, a.nombre`,
    [req.params.ejercicioId]
  )
  res.json(resultado.rows)
})

export default router
