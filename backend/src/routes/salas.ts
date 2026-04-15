import { Router, Response } from 'express'
import { db } from '../db'
import { verificarToken, soloProfesor, AuthRequest } from '../middleware/auth'

const router = Router()

// Obtener salas de la profesora
router.get('/', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const resultado = await db.query(
    `SELECT s.*, COUNT(a.id) AS total_alumnos
     FROM salas s
     LEFT JOIN alumnos a ON a.sala_id = s.id
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

// Obtener alumnos de una sala
router.get('/:id/alumnos', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const resultado = await db.query(
    `SELECT id, nombre, apellido, username, email_apoderado, creado_en
     FROM alumnos WHERE sala_id = $1 ORDER BY apellido, nombre`,
    [req.params.id]
  )
  res.json(resultado.rows)
})

export default router
