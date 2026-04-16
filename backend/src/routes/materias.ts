import { Router, Response } from 'express'
import { db } from '../db'
import { verificarToken, soloProfesor, AuthRequest } from '../middleware/auth'

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

// Obtener materias asignadas a una sala (con profesora que la enseña)
router.get('/sala/:salaId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const resultado = await db.query(
    `SELECT m.*, sm.profesora_id, p.nombre AS profesora_nombre,
            json_agg(json_build_object('id', t.id, 'nombre', t.nombre) ORDER BY t.nombre)
              FILTER (WHERE t.id IS NOT NULL) AS temas
     FROM sala_materias sm
     JOIN materias m ON m.id = sm.materia_id
     LEFT JOIN profesoras p ON p.id = sm.profesora_id
     LEFT JOIN temas t ON t.materia_id = m.id
     WHERE sm.sala_id = $1
     GROUP BY m.id, sm.profesora_id, p.nombre
     ORDER BY m.nombre`,
    [req.params.salaId]
  )
  res.json(resultado.rows)
})

// Agregar materia a una sala (se asigna a la profesora que la agrega)
router.post('/sala/:salaId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { materiaId } = req.body
  const { salaId } = req.params
  if (!materiaId) { res.status(400).json({ error: 'materiaId requerido' }); return }

  // Verificar que la profesora tiene acceso a la sala
  const acceso = await db.query(
    'SELECT rol FROM profesora_salas WHERE profesora_id = $1 AND sala_id = $2',
    [req.usuario!.id, salaId]
  )
  if (acceso.rows.length === 0) {
    res.status(403).json({ error: 'No tienes acceso a esta sala' })
    return
  }

  await db.query(
    `INSERT INTO sala_materias (sala_id, materia_id, profesora_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (sala_id, materia_id) DO UPDATE SET profesora_id = EXCLUDED.profesora_id`,
    [salaId, materiaId, req.usuario!.id]
  )

  // Si no está en profesora_salas, agregarla como materia
  await db.query(
    `INSERT INTO profesora_salas (profesora_id, sala_id, rol)
     VALUES ($1, $2, 'materia')
     ON CONFLICT (profesora_id, sala_id) DO NOTHING`,
    [req.usuario!.id, salaId]
  )

  res.json({ ok: true })
})

// Quitar materia de una sala
router.delete('/sala/:salaId/:materiaId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  await db.query(
    'DELETE FROM sala_materias WHERE sala_id = $1 AND materia_id = $2',
    [req.params.salaId, req.params.materiaId]
  )
  res.json({ ok: true })
})

// Crear materia nueva
router.post('/', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { nombre, color, icono } = req.body
  if (!nombre?.trim()) { res.status(400).json({ error: 'Nombre requerido' }); return }

  const resultado = await db.query(
    'INSERT INTO materias (nombre, color, icono) VALUES ($1, $2, $3) RETURNING *',
    [nombre.trim(), color || '#4A90D9', icono || 'book']
  )
  const materia = resultado.rows[0]

  // Agregar tema "Otros" por defecto
  await db.query(
    'INSERT INTO temas (nombre, materia_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    ['Otros', materia.id]
  )

  res.status(201).json(materia)
})

// Crear tema dentro de una materia
router.post('/:id/temas', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { nombre } = req.body
  if (!nombre?.trim()) { res.status(400).json({ error: 'Nombre requerido' }); return }

  const resultado = await db.query(
    'INSERT INTO temas (nombre, materia_id) VALUES ($1, $2) RETURNING *',
    [nombre.trim(), req.params.id]
  )
  res.status(201).json(resultado.rows[0])
})

// Eliminar tema
router.delete('/temas/:id', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  // No permitir eliminar el tema "Otros"
  const tema = await db.query('SELECT nombre FROM temas WHERE id = $1', [req.params.id])
  if (tema.rows[0]?.nombre === 'Otros') {
    res.status(400).json({ error: 'No se puede eliminar el tema "Otros"' })
    return
  }
  await db.query('DELETE FROM temas WHERE id = $1', [req.params.id])
  res.json({ ok: true })
})

export default router
