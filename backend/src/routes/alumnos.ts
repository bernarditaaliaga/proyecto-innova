import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { verificarToken, soloProfesor, AuthRequest } from '../middleware/auth'

const router = Router()

// Helper: verificar si la profesora es jefe de alguna sala del alumno
async function esJefeDelAlumno(profesoraId: number, alumnoId: number): Promise<boolean> {
  const r = await db.query(
    `SELECT 1 FROM profesora_salas ps
     JOIN alumno_salas als ON als.sala_id = ps.sala_id
     WHERE ps.profesora_id = $1 AND als.alumno_id = $2 AND ps.rol = 'jefe'
     LIMIT 1`,
    [profesoraId, alumnoId]
  )
  return r.rows.length > 0
}

// Helper: verificar si la profesora es jefe de una sala
async function esJefeDeSala(profesoraId: number, salaId: number): Promise<boolean> {
  const r = await db.query(
    `SELECT 1 FROM profesora_salas WHERE profesora_id = $1 AND sala_id = $2 AND rol = 'jefe' LIMIT 1`,
    [profesoraId, salaId]
  )
  return r.rows.length > 0
}

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

// Crear alumno nuevo (solo profesor jefe de la sala)
router.post('/', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { nombre, apellido, username, password, emailApoderado, salaId, genero, nombrePadre, nombreMadre } = req.body

  if (!nombre || !apellido || !username || !password) {
    res.status(400).json({ error: 'Faltan campos obligatorios' })
    return
  }

  // Si se especifica sala, verificar que es jefe
  if (salaId) {
    const jefe = await esJefeDeSala(req.usuario!.id, salaId)
    if (!jefe) {
      res.status(403).json({ error: 'Solo el profesor jefe puede crear alumnos en esta sala' })
      return
    }
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const resultado = await db.query(
    `INSERT INTO alumnos (nombre, apellido, username, password_hash, email_apoderado, genero, nombre_padre, nombre_madre)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, nombre, apellido, username, email_apoderado, genero, nombre_padre, nombre_madre`,
    [nombre, apellido, username, passwordHash, emailApoderado || null, genero || null, nombrePadre || null, nombreMadre || null]
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

// Añadir alumno existente a una sala (solo jefe)
router.post('/:alumnoId/salas/:salaId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { alumnoId, salaId } = req.params

  const jefe = await esJefeDeSala(req.usuario!.id, Number(salaId))
  if (!jefe) {
    res.status(403).json({ error: 'Solo el profesor jefe puede añadir alumnos' })
    return
  }

  await db.query(
    'INSERT INTO alumno_salas (alumno_id, sala_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [alumnoId, salaId]
  )
  res.json({ ok: true })
})

// Quitar alumno de una sala (solo jefe)
router.delete('/:alumnoId/salas/:salaId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const jefe = await esJefeDeSala(req.usuario!.id, Number(req.params.salaId))
  if (!jefe) {
    res.status(403).json({ error: 'Solo el profesor jefe puede quitar alumnos' })
    return
  }

  await db.query(
    'DELETE FROM alumno_salas WHERE alumno_id = $1 AND sala_id = $2',
    [req.params.alumnoId, req.params.salaId]
  )
  res.json({ ok: true })
})

// Obtener perfil completo de un alumno
router.get('/:id', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const resultado = await db.query(
    `SELECT a.id, a.nombre, a.apellido, a.username, a.genero,
            a.nombre_padre, a.nombre_madre, a.email_apoderado, a.creado_en
     FROM alumnos a WHERE a.id = $1`,
    [req.params.id]
  )
  if (resultado.rows.length === 0) {
    res.status(404).json({ error: 'Alumno no encontrado' })
    return
  }
  res.json(resultado.rows[0])
})

// Editar perfil de alumno (solo profesor jefe)
router.put('/:id', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const alumnoId = Number(req.params.id)

  // Verificar que es jefe de alguna sala del alumno
  const jefe = await esJefeDelAlumno(req.usuario!.id, alumnoId)
  if (!jefe) {
    res.status(403).json({ error: 'Solo el profesor jefe puede editar perfiles' })
    return
  }

  const { nombre, apellido, emailApoderado, genero, nombrePadre, nombreMadre, password } = req.body

  let query = `UPDATE alumnos SET nombre = $1, apellido = $2, email_apoderado = $3, genero = $4, nombre_padre = $5, nombre_madre = $6`
  const params: (string | number | null)[] = [nombre, apellido, emailApoderado || null, genero || null, nombrePadre || null, nombreMadre || null]

  if (password) {
    const hash = await bcrypt.hash(password, 10)
    query += `, password_hash = $${params.length + 1}`
    params.push(hash)
  }

  query += ` WHERE id = $${params.length + 1} RETURNING id, nombre, apellido, username, email_apoderado, genero, nombre_padre, nombre_madre`
  params.push(alumnoId)

  const resultado = await db.query(query, params)
  res.json(resultado.rows[0])
})

export default router
