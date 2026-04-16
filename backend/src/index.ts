import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'

import authRoutes from './routes/auth'
import salasRoutes from './routes/salas'
import alumnosRoutes from './routes/alumnos'
import materiasRoutes from './routes/materias'
import planificacionesRoutes from './routes/planificaciones'
import iaRoutes from './routes/ia'
import metricasRoutes from './routes/metricas'
import { registrarEventosSesion } from './sockets/sesion'

dotenv.config()

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
})

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())

// Rutas
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', app: 'AprendIA' })
})

app.use('/api/auth', authRoutes)
app.use('/api/salas', salasRoutes)
app.use('/api/alumnos', alumnosRoutes)
app.use('/api/materias', materiasRoutes)
app.use('/api/planificaciones', planificacionesRoutes)
app.use('/api/ia', iaRoutes)
app.use('/api/metricas', metricasRoutes)

// Limpiar sesiones huérfanas al iniciar el servidor
import { db } from './db'
db.query(`UPDATE sesiones SET estado = 'finalizada', finalizada_en = NOW() WHERE estado != 'finalizada'`)
  .then(r => console.log(`Sesiones huérfanas cerradas: ${r.rowCount}`))
  .catch(() => {})

// Endpoint temporal para resetear la BD (quitar después de usar)
app.post('/api/admin/reset', async (req, res) => {
  if (req.headers['x-reset-key'] !== 'reset-aprendia-2026') {
    res.status(403).json({ error: 'No autorizado' }); return
  }
  await db.query(`
    TRUNCATE respuestas, variantes_ejercicio, sesiones, ejercicios,
             planificaciones, alumno_salas, alumnos, temas, materias, salas, profesoras
    CASCADE
  `)
  // Re-insertar materias base
  await db.query(`
    INSERT INTO materias (nombre, color, icono) VALUES
    ('Matemáticas', '#6C5CE7', '🔢'),
    ('Lenguaje', '#00B894', '✏️'),
    ('Ciencias', '#FDCB6E', '🔬')
  `)
  res.json({ ok: true, mensaje: 'BD reseteada con materias base' })
})

// Socket.io
io.on('connection', (socket) => {
  console.log(`Conectado: ${socket.id}`)
  registrarEventosSesion(io, socket)
  socket.on('disconnect', () => console.log(`Desconectado: ${socket.id}`))
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`AprendIA backend corriendo en http://localhost:${PORT}`)
})
