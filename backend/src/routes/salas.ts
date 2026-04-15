import { Router, Response } from 'express'
import { db } from '../db'
import { verificarToken, soloProfesor, AuthRequest } from '../middleware/auth'

const router = Router()

// Obtener salas de la profesora
router.get('/', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const resultado = await db.query(
    `SELECT s.*, COUNT(als.alumno_id) AS total_alumnos
     FROM salas s
     LEFT JOIN alumno_salas als ON als.sala_id = s.id
     WHERE s.profesora_id = $1
     GROUP BY s.id
     ORDER BY s.nombre`,
    [req.usuario!.id]
  )
  res.json(resultado.rows)
})

// Crear sala
router.post('/', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { nombre, codigo } = req.body
  if (!nombre || !codigo) {
    res.status(400).json({ error: 'Nombre y código requeridos' })
    return
  }
  const resultado = await db.query(
    'INSERT INTO salas (nombre, codigo, profesora_id) VALUES ($1, $2, $3) RETURNING *',
    [nombre, codigo, req.usuario!.id]
  )
  res.status(201).json(resultado.rows[0])
})

// Obtener alumnos de una sala (via alumno_salas)
router.get('/:id/alumnos', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const resultado = await db.query(
    `SELECT a.id, a.nombre, a.apellido, a.username, a.email_apoderado, a.creado_en
     FROM alumnos a
     JOIN alumno_salas als ON als.alumno_id = a.id
     WHERE als.sala_id = $1
     ORDER BY a.apellido, a.nombre`,
    [req.params.id]
  )
  res.json(resultado.rows)
})

export default router
