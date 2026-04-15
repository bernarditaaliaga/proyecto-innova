import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { verificarToken, soloProfesor, AuthRequest } from '../middleware/auth'

const router = Router()

// Buscar alumnos por nombre o username (para añadir a sala)
router.get('/buscar', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { q } = req.query
  if (!q || String(q).length < 2) {
    res.json([])
    return
  }
  const resultado = await db.query(
    `SELECT id, nombre, apellido, username FROM alumnos
     WHERE nombre ILIKE $1 OR apellido ILIKE $1 OR username ILIKE $1
     ORDER BY apellido, nombre LIMIT 10`,
    [`%${q}%`]
  )
  res.json(resultado.rows)
})

// Crear alumno nuevo (sin sala, se añade luego)
router.post('/', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { nombre, apellido, username, password, emailApoderado, salaId } = req.body

  if (!nombre || !apellido || !username || !password) {
    res.status(400).json({ error: 'Faltan campos obligatorios' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const resultado = await db.query(
    `INSERT INTO alumnos (nombre, apellido, username, password_hash, email_apoderado)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, apellido, username, email_apoderado`,
    [nombre, apellido, username, passwordHash, emailApoderado || null]
  )
  const alumno = resultado.rows[0]

  // Si se especificó sala, añadirlo directamente
  if (salaId) {
    await db.query(
      'INSERT INTO alumno_salas (alumno_id, sala_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [alumno.id, salaId]
    )
  }

  res.status(201).json(alumno)
})

// Añadir alumno existente a una sala
router.post('/:alumnoId/salas/:salaId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { alumnoId, salaId } = req.params

  // Verificar que la sala pertenece a esta profesora
  const sala = await db.query(
    'SELECT id FROM salas WHERE id = $1 AND profesora_id = $2',
    [salaId, req.usuario!.id]
  )
  if (sala.rows.length === 0) {
    res.status(403).json({ error: 'Sala no encontrada' })
    return
  }

  await db.query(
    'INSERT INTO alumno_salas (alumno_id, sala_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [alumnoId, salaId]
  )
  res.json({ ok: true })
})

// Quitar alumno de una sala
router.delete('/:alumnoId/salas/:salaId', verificarToken, soloProfesor, async (_req: AuthRequest, res: Response): Promise<void> => {
  await db.query(
    'DELETE FROM alumno_salas WHERE alumno_id = $1 AND sala_id = $2',
    [_req.params.alumnoId, _req.params.salaId]
  )
  res.json({ ok: true })
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

export default router
