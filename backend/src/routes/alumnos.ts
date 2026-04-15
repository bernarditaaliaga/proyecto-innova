import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { verificarToken, soloProfesor, AuthRequest } from '../middleware/auth'

const router = Router()

// Crear alumno
router.post('/', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { nombre, apellido, username, password, salaId, emailApoderado } = req.body

  if (!nombre || !apellido || !username || !password || !salaId) {
    res.status(400).json({ error: 'Faltan campos obligatorios' })
    return
  }

  // Verificar que la sala pertenece a esta profesora
  const sala = await db.query(
    'SELECT id FROM salas WHERE id = $1 AND profesora_id = $2',
    [salaId, req.usuario!.id]
  )
  if (sala.rows.length === 0) {
    res.status(403).json({ error: 'Sala no encontrada' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const resultado = await db.query(
    `INSERT INTO alumnos (nombre, apellido, username, password_hash, sala_id, email_apoderado)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, nombre, apellido, username, sala_id, email_apoderado, creado_en`,
    [nombre, apellido, username, passwordHash, salaId, emailApoderado || null]
  )
  res.status(201).json(resultado.rows[0])
})

// Editar alumno
router.put('/:id', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { nombre, apellido, emailApoderado, password } = req.body

  let query = `UPDATE alumnos SET nombre = $1, apellido = $2, email_apoderado = $3`
  const params: (string | number | null)[] = [nombre, apellido, emailApoderado || null]

  if (password) {
    const hash = await bcrypt.hash(password, 10)
    query += `, password_hash = $${params.length + 1}`
    params.push(hash)
  }

  query += ` WHERE id = $${params.length + 1} RETURNING id, nombre, apellido, username, email_apoderado`
  params.push(Number(req.params.id))

  const resultado = await db.query(query, params)
  res.json(resultado.rows[0])
})

// Eliminar alumno
router.delete('/:id', verificarToken, soloProfesor, async (_req: AuthRequest, res: Response): Promise<void> => {
  await db.query('DELETE FROM alumnos WHERE id = $1', [_req.params.id])
  res.json({ ok: true })
})

export default router
