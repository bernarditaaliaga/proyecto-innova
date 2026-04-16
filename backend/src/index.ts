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

// Diagnóstico temporal — verificar token
app.get('/api/debug/token', (req, res) => {
  const header = req.headers.authorization
  if (!header) { res.json({ error: 'No token' }); return }
  try {
    const jwt = require('jsonwebtoken')
    const payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET)
    res.json({ payload })
  } catch (e: unknown) {
    const err = e as { message?: string }
    res.json({ error: 'Token inválido', message: err.message })
  }
})

// Diagnóstico temporal — ver estado de la BD
app.get('/api/debug/db', async (_req, res) => {
  try {
    const profesoras = await db.query('SELECT id, nombre, email FROM profesoras')
    const salas = await db.query('SELECT id, nombre, codigo, profesora_id FROM salas')
    const alumnos = await db.query('SELECT id, nombre, apellido, username FROM alumnos')
    const alumnoSalas = await db.query('SELECT * FROM alumno_salas')
    const materias = await db.query('SELECT id, nombre FROM materias')
    const tables = await db.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`)
    res.json({
      tables: tables.rows.map(r => r.tablename),
      profesoras: profesoras.rows,
      salas: salas.rows,
      alumnos: alumnos.rows,
      alumno_salas: alumnoSalas.rows,
      materias: materias.rows
    })
  } catch (e: unknown) {
    const err = e as { message?: string }
    res.status(500).json({ error: err.message })
  }
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

    // Tabla profesora_salas (profesor jefe vs profesor de materia)
    await db.query(`
      CREATE TABLE IF NOT EXISTS profesora_salas (
        id SERIAL PRIMARY KEY,
        profesora_id INTEGER REFERENCES profesoras(id) ON DELETE CASCADE,
        sala_id INTEGER REFERENCES salas(id) ON DELETE CASCADE,
        rol VARCHAR(20) NOT NULL DEFAULT 'materia',
        creado_en TIMESTAMP DEFAULT NOW(),
        UNIQUE(profesora_id, sala_id)
      )
    `)
    // Solo 1 jefe por sala
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_un_jefe_por_sala
      ON profesora_salas (sala_id) WHERE rol = 'jefe'
    `)

    // Agregar campo anio a salas si no existe
    await db.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='salas' AND column_name='anio') THEN
          ALTER TABLE salas ADD COLUMN anio INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);
        END IF;
      END $$
    `)

    // Agregar campos de perfil a alumnos si no existen
    await db.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alumnos' AND column_name='genero') THEN
          ALTER TABLE alumnos ADD COLUMN genero VARCHAR(1) CHECK (genero IN ('M', 'F'));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alumnos' AND column_name='nombre_padre') THEN
          ALTER TABLE alumnos ADD COLUMN nombre_padre VARCHAR(100);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alumnos' AND column_name='nombre_madre') THEN
          ALTER TABLE alumnos ADD COLUMN nombre_madre VARCHAR(100);
        END IF;
      END $$
    `)

    // Migrar: si hay salas con profesora_id que no están en profesora_salas, insertarlas como jefe
    await db.query(`
      INSERT INTO profesora_salas (profesora_id, sala_id, rol)
      SELECT profesora_id, id, 'jefe' FROM salas
      WHERE profesora_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM profesora_salas ps
          WHERE ps.sala_id = salas.id AND ps.rol = 'jefe'
        )
      ON CONFLICT DO NOTHING
    `)

    console.log('Tablas verificadas (alumno_salas, profesora_salas, campos perfil)')

    // Agregar UNIQUE a materias.nombre si no existe
    await db.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'materias_nombre_key') THEN
          ALTER TABLE materias ADD CONSTRAINT materias_nombre_key UNIQUE (nombre);
        END IF;
      END $$
    `).catch(() => {
      // Si falla por duplicados, limpiar primero
      console.log('[DB] Limpiando materias duplicadas...')
    })

    // Limpiar materias duplicadas (quedarse solo con el ID más bajo por nombre)
    await db.query(`
      DELETE FROM materias WHERE id NOT IN (
        SELECT MIN(id) FROM materias GROUP BY nombre
      )
    `)

    // Asegurar materias base
    await db.query(`
      INSERT INTO materias (nombre, color, icono) VALUES
        ('Matemáticas', '#E74C3C', 'calculator'),
        ('Lenguaje',    '#3498DB', 'book-open'),
        ('Ciencias',    '#2ECC71', 'flask')
      ON CONFLICT (nombre) DO NOTHING
    `)

    // Limpiar sesiones huérfanas
    const r = await db.query(`UPDATE sesiones SET estado = 'finalizada', finalizada_en = NOW() WHERE estado != 'finalizada'`)
    console.log(`Sesiones huérfanas cerradas: ${r.rowCount}`)

    // Log estado de la BD
    const counts = await Promise.all([
      db.query('SELECT COUNT(*) FROM profesoras'),
      db.query('SELECT COUNT(*) FROM salas'),
      db.query('SELECT COUNT(*) FROM alumnos'),
      db.query('SELECT COUNT(*) FROM alumno_salas'),
      db.query('SELECT COUNT(*) FROM materias'),
    ])
    console.log(`[DB] profesoras: ${counts[0].rows[0].count}, salas: ${counts[1].rows[0].count}, alumnos: ${counts[2].rows[0].count}, alumno_salas: ${counts[3].rows[0].count}, materias: ${counts[4].rows[0].count}`)
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
