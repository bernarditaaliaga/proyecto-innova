import { Router, Response } from 'express'
import { db } from '../db'
import { verificarToken, soloProfesor, AuthRequest } from '../middleware/auth'

const router = Router()

// Obtener salas de la profesora (todas donde es jefe o materia)
router.get('/', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const resultado = await db.query(
      `SELECT s.*, ps.rol,
              COUNT(als.alumno_id) AS total_alumnos
       FROM salas s
       JOIN profesora_salas ps ON ps.sala_id = s.id AND ps.profesora_id = $1
       LEFT JOIN alumno_salas als ON als.sala_id = s.id
       GROUP BY s.id, ps.rol
       ORDER BY ps.rol = 'jefe' DESC, s.nombre`,
      [req.usuario!.id]
    )
    res.json(resultado.rows)
  } catch (e: unknown) {
    const err = e as { message?: string }
    console.error('[Salas] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Crear sala (quien crea es profesor jefe automáticamente)
router.post('/', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { nombre, codigo } = req.body
  if (!nombre || !codigo) {
    res.status(400).json({ error: 'Nombre y código requeridos' })
    return
  }
  const resultado = await db.query(
    'INSERT INTO salas (nombre, codigo, profesora_id, anio) VALUES ($1, $2, $3, EXTRACT(YEAR FROM CURRENT_DATE)) RETURNING *',
    [nombre, codigo, req.usuario!.id]
  )
  const sala = resultado.rows[0]

  // Insertar como profesor jefe
  await db.query(
    `INSERT INTO profesora_salas (profesora_id, sala_id, rol) VALUES ($1, $2, 'jefe') ON CONFLICT DO NOTHING`,
    [req.usuario!.id, sala.id]
  )

  res.status(201).json({ ...sala, rol: 'jefe' })
})

// Unirse a una sala con código (como profesor de materia)
router.post('/unirse', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { codigo } = req.body
  if (!codigo) {
    res.status(400).json({ error: 'Código de sala requerido' })
    return
  }

  const sala = await db.query('SELECT * FROM salas WHERE codigo = $1', [codigo])
  if (sala.rows.length === 0) {
    res.status(404).json({ error: 'No existe una sala con ese código' })
    return
  }

  const salaId = sala.rows[0].id

  // Verificar si ya está vinculada
  const yaExiste = await db.query(
    'SELECT rol FROM profesora_salas WHERE profesora_id = $1 AND sala_id = $2',
    [req.usuario!.id, salaId]
  )
  if (yaExiste.rows.length > 0) {
    res.status(400).json({ error: `Ya estás vinculada a esta sala como ${yaExiste.rows[0].rol}` })
    return
  }

  await db.query(
    `INSERT INTO profesora_salas (profesora_id, sala_id, rol) VALUES ($1, $2, 'materia')`,
    [req.usuario!.id, salaId]
  )

  res.json({ ok: true, sala: sala.rows[0], rol: 'materia' })
})

// Salir de una sala (solo si es profesor de materia, no jefe)
router.delete('/:id/salir', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const vinculo = await db.query(
    'SELECT rol FROM profesora_salas WHERE profesora_id = $1 AND sala_id = $2',
    [req.usuario!.id, req.params.id]
  )
  if (vinculo.rows.length === 0) {
    res.status(404).json({ error: 'No estás vinculada a esta sala' })
    return
  }
  if (vinculo.rows[0].rol === 'jefe') {
    res.status(400).json({ error: 'El profesor jefe no puede salirse de su sala' })
    return
  }

  await db.query(
    'DELETE FROM profesora_salas WHERE profesora_id = $1 AND sala_id = $2',
    [req.usuario!.id, req.params.id]
  )
  res.json({ ok: true })
})

// Ver profesores de una sala
router.get('/:id/profesoras', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const resultado = await db.query(
    `SELECT p.id, p.nombre, p.email, ps.rol
     FROM profesoras p
     JOIN profesora_salas ps ON ps.profesora_id = p.id
     WHERE ps.sala_id = $1
     ORDER BY ps.rol = 'jefe' DESC, p.nombre`,
    [req.params.id]
  )
  res.json(resultado.rows)
})

// Obtener alumnos de una sala (via alumno_salas)
router.get('/:id/alumnos', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const resultado = await db.query(
    `SELECT a.id, a.nombre, a.apellido, a.username, a.genero,
            a.nombre_padre, a.nombre_madre, a.email_apoderado, a.creado_en
     FROM alumnos a
     JOIN alumno_salas als ON als.alumno_id = a.id
     WHERE als.sala_id = $1
     ORDER BY a.apellido, a.nombre`,
    [req.params.id]
  )
  res.json(resultado.rows)
})

// Obtener mi rol en una sala
router.get('/:id/mi-rol', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const resultado = await db.query(
    'SELECT rol FROM profesora_salas WHERE profesora_id = $1 AND sala_id = $2',
    [req.usuario!.id, req.params.id]
  )
  res.json({ rol: resultado.rows[0]?.rol || null })
})

export default router
