import { Server, Socket } from 'socket.io'
import { db } from '../db'

export function registrarEventosSesion(io: Server, socket: Socket) {

  // Alumno se une a su sala
  socket.on('alumno:unirse', async (data: { salaId: number; alumnoId: number }) => {
    const room = `sala:${data.salaId}`
    socket.join(room)
    socket.join(`alumno:${data.alumnoId}`)

    // Verificar si hay sesión activa
    const sesion = await db.query(
      `SELECT s.*, e.tipo, e.contenido, e.titulo, e.puntos
       FROM sesiones s
       LEFT JOIN ejercicios e ON e.id = s.ejercicio_activo_id
       WHERE s.planificacion_id IN (
         SELECT id FROM planificaciones WHERE sala_id = $1
       ) AND s.estado != 'finalizada'
       ORDER BY s.iniciada_en DESC LIMIT 1`,
      [data.salaId]
    )

    if (sesion.rows.length > 0) {
      const row = sesion.rows[0]

      if (row.ejercicio_activo_id && row.tipo) {
        // Buscar variante personalizada del alumno
        const variante = await db.query(
          'SELECT contenido FROM variantes_ejercicio WHERE ejercicio_id = $1 AND alumno_id = $2',
          [row.ejercicio_activo_id, data.alumnoId]
        )
        // Verificar si ya respondió
        const yaRespondio = await db.query(
          'SELECT puntos_obtenidos FROM respuestas WHERE alumno_id = $1 AND ejercicio_id = $2 AND sesion_id = $3',
          [data.alumnoId, row.ejercicio_activo_id, row.id]
        )

        socket.emit('sesion:estado', {
          sesionId: row.id,
          ejercicio: {
            id: row.ejercicio_activo_id,
            titulo: row.titulo,
            tipo: row.tipo,
            puntos: row.puntos,
            contenido: variante.rows[0]?.contenido || row.contenido
          },
          yaRespondio: yaRespondio.rows.length > 0,
          puntosYaObtenidos: yaRespondio.rows[0]?.puntos_obtenidos ?? 0
        })
      } else {
        socket.emit('sesion:estado', { sesionId: row.id })
      }
    } else {
      socket.emit('sesion:esperando')
    }
  })

  // Profesora inicia sesión
  socket.on('profesora:iniciar_sesion', async (data: { planificacionId: number }) => {
    const resultado = await db.query(
      `INSERT INTO sesiones (planificacion_id, estado)
       VALUES ($1, 'esperando') RETURNING *`,
      [data.planificacionId]
    )
    const sesion = resultado.rows[0]

    // Obtener la sala de esta planificación
    const plan = await db.query('SELECT sala_id FROM planificaciones WHERE id = $1', [data.planificacionId])
    const salaId = plan.rows[0]?.sala_id

    if (salaId) {
      io.to(`sala:${salaId}`).emit('sesion:iniciada', { sesionId: sesion.id })
      socket.emit('sesion:creada', sesion)
    }
  })

  // Profesora lanza un ejercicio a todos
  socket.on('profesora:lanzar_ejercicio', async (data: {
    sesionId: number
    ejercicioId: number
    salaId: number
  }) => {
    const ejercicio = await db.query(
      'SELECT * FROM ejercicios WHERE id = $1',
      [data.ejercicioId]
    )

    if (ejercicio.rows.length === 0) return

    await db.query(
      `UPDATE sesiones SET ejercicio_activo_id = $1, estado = 'ejercicio_activo'
       WHERE id = $2`,
      [data.ejercicioId, data.sesionId]
    )

    // Obtener variantes de cada alumno (si las hay)
    const variantes = await db.query(
      'SELECT alumno_id, contenido FROM variantes_ejercicio WHERE ejercicio_id = $1',
      [data.ejercicioId]
    )
    const variantesPorAlumno = new Map(variantes.rows.map(v => [v.alumno_id, v.contenido]))

    // Obtener todos los alumnos de la sala
    const alumnos = await db.query(
      'SELECT alumno_id AS id FROM alumno_salas WHERE sala_id = $1',
      [data.salaId]
    )

    // Enviar a cada alumno su versión (variante o base)
    for (const alumno of alumnos.rows) {
      const variante = variantesPorAlumno.get(alumno.id)
      const contenido = variante || ejercicio.rows[0].contenido

      io.to(`alumno:${alumno.id}`).emit('ejercicio:nuevo', {
        id: ejercicio.rows[0].id,
        titulo: ejercicio.rows[0].titulo,
        tipo: ejercicio.rows[0].tipo,
        puntos: ejercicio.rows[0].puntos,
        contenido
      })
    }
  })

  // Profesora cierra el ejercicio activo
  socket.on('profesora:cerrar_ejercicio', async (data: { sesionId: number; salaId: number }) => {
    await db.query(
      `UPDATE sesiones SET ejercicio_activo_id = NULL, estado = 'esperando' WHERE id = $1`,
      [data.sesionId]
    )
    io.to(`sala:${data.salaId}`).emit('ejercicio:cerrado')
  })

  // Alumno responde un ejercicio
  socket.on('alumno:responder', async (data: {
    alumnoId: number
    ejercicioId: number
    sesionId: number
    contenido: unknown
    esCorrecta: boolean
    tiempoSegundos: number
  }) => {
    const ejercicio = await db.query('SELECT puntos FROM ejercicios WHERE id = $1', [data.ejercicioId])
    const puntosMax = ejercicio.rows[0]?.puntos || 0
    const puntosObtenidos = data.esCorrecta ? puntosMax : 0

    await db.query(
      `INSERT INTO respuestas (alumno_id, ejercicio_id, sesion_id, contenido, es_correcto, puntos_obtenidos, tiempo_segundos)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (alumno_id, ejercicio_id, sesion_id) DO NOTHING`,
      [data.alumnoId, data.ejercicioId, data.sesionId,
       JSON.stringify(data.contenido), data.esCorrecta, puntosObtenidos, data.tiempoSegundos]
    )

    // Obtener nombre del alumno para notificar a la profesora
    const alumno = await db.query(
      'SELECT nombre, apellido, sala_id FROM alumnos WHERE id = $1',
      [data.alumnoId]
    )
    const a = alumno.rows[0]
    if (a) {
      io.to(`sala:${a.sala_id}`).emit('respuesta:alumno', {
        alumnoId: data.alumnoId,
        nombre: `${a.nombre} ${a.apellido}`,
        respondio: true,
        esCorrecta: data.esCorrecta,
        puntos: puntosObtenidos
      })
    }

    socket.emit('respuesta:confirmada', { puntosObtenidos })
  })

  // Profesora finaliza la sesión
  socket.on('profesora:finalizar_sesion', async (data: { sesionId: number; salaId: number }) => {
    await db.query(
      `UPDATE sesiones SET estado = 'finalizada', finalizada_en = NOW() WHERE id = $1`,
      [data.sesionId]
    )
    io.to(`sala:${data.salaId}`).emit('sesion:finalizada')
  })
}
