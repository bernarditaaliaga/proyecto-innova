import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'

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

// Ruta de prueba
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', mensaje: 'Servidor funcionando' })
})

// Socket.io — sincronización en tiempo real
io.on('connection', (socket) => {
  console.log(`Cliente conectado: ${socket.id}`)

  // El alumno se une a su sala
  socket.on('unirse_sala', (idSala: string) => {
    socket.join(idSala)
    console.log(`Socket ${socket.id} se unió a sala: ${idSala}`)
  })

  // La profesora envía un comando a toda la sala
  socket.on('comando_profesora', (data: { idSala: string; comando: unknown }) => {
    io.to(data.idSala).emit('comando', data.comando)
    console.log(`Comando enviado a sala ${data.idSala}:`, data.comando)
  })

  socket.on('disconnect', () => {
    console.log(`Cliente desconectado: ${socket.id}`)
  })
})

const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})
