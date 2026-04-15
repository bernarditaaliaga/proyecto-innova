import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db } from '../db'

const router = Router()

// Login profesora
router.post('/profesora', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(400).json({ error: 'Email y contraseña requeridos' })
    return
  }

  const resultado = await db.query(
    'SELECT id, nombre, email, password_hash FROM profesoras WHERE email = $1',
    [email]
  )
  const profesora = resultado.rows[0]

  if (!profesora || !(await bcrypt.compare(password, profesora.password_hash))) {
    res.status(401).json({ error: 'Email o contraseña incorrectos' })
    return
  }

  const token = jwt.sign(
    { id: profesora.id, rol: 'profesora' },
    process.env.JWT_SECRET!,
    { expiresIn: '12h' }
  )

  res.json({
    token,
    usuario: { id: profesora.id, nombre: profesora.nombre, email: profesora.email, rol: 'profesora' }
  })
})

// Login alumno
router.post('/alumno', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body
  if (!username || !password) {
    res.status(400).json({ error: 'Usuario y contraseña requeridos' })
    return
  }

  const resultado = await db.query(
    `SELECT a.id, a.nombre, a.apellido, a.username, a.password_hash, a.sala_id, s.nombre AS sala
     FROM alumnos a
     LEFT JOIN salas s ON s.id = a.sala_id
     WHERE a.username = $1`,
    [username]
  )
  const alumno = resultado.rows[0]

  if (!alumno || !(await bcrypt.compare(password, alumno.password_hash))) {
    res.status(401).json({ error: 'Usuario o contraseña incorrectos' })
    return
  }

  const token = jwt.sign(
    { id: alumno.id, rol: 'alumno', salaId: alumno.sala_id },
    process.env.JWT_SECRET!,
    { expiresIn: '12h' }
  )

  res.json({
    token,
    usuario: {
      id: alumno.id,
      nombre: alumno.nombre,
      apellido: alumno.apellido,
      username: alumno.username,
      salaId: alumno.sala_id,
      sala: alumno.sala,
      rol: 'alumno'
    }
  })
})

export default router
