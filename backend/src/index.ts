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
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true
  }
})

app.use(cors({ origin: true, credentials: true }))
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

// Inicialización de BD al arrancar
import { db } from './db'

async function initDB() {
  try {
    // Asegurar que la tabla alumno_salas existe
    await db.query(`
      CREATE TABLE IF NOT EXISTS alumno_salas (
        id SERIAL PRIMARY KEY,
        alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
        sala_id INTEGER REFERENCES salas(id) ON DELETE CASCADE,
        creado_en TIMESTAMP DEFAULT NOW(),
        UNIQUE(alumno_id, sala_id)
      )
    `)
    console.log('Tabla alumno_salas verificada')

    // Asegurar materias base
    await db.query(`
      INSERT INTO materias (nombre, color, icono) VALUES
        ('Matemáticas', '#E74C3C', 'calculator'),
        ('Lenguaje',    '#3498DB', 'book-open'),
        ('Ciencias',    '#2ECC71', 'flask')
      ON CONFLICT DO NOTHING
    `)

    // Limpiar sesiones huérfanas
    const r = await db.query(`UPDATE sesiones SET estado = 'finalizada', finalizada_en = NOW() WHERE estado != 'finalizada'`)
    console.log(`Sesiones huérfanas cerradas: ${r.rowCount}`)
  } catch (e) {
    console.error('Error en initDB:', e)
  }
}
initDB()


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
