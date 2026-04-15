import { Server, Socket } from 'socket.io'
import { db } from '../db'
import { generarVariantesEjercicio } from '../routes/ia'

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
      socket.join(`sala:${salaId}`) // profesora se une a la sala para recibir respuestas
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

    // Obtener todos los alumnos de la sala
    const alumnos = await db.query(
      'SELECT alumno_id AS id FROM alumno_salas WHERE sala_id = $1',
      [data.salaId]
    )

    const ej = ejercicio.rows[0]
    const variantesPorAlumno = new Map<number, Record<string, unknown>>()

    // Generar variantes con IA si está activado
    if (ej.generar_variantes && alumnos.rows.length > 0) {
      const CANT = 5
      const tipos = ['matematica_desarrollo', 'seleccion_multiple', 'completar_texto']
      if (tipos.includes(ej.tipo)) {
        try {
          const variantes = await generarVariantesEjercicio(ej.tipo, ej.contenido, CANT)
          if (variantes.length > 0) {
            for (let i = 0; i < alumnos.rows.length; i++) {
              const alumnoId = alumnos.rows[i].id
              const variante = variantes[i % variantes.length]
              variantesPorAlumno.set(alumnoId, variante)
              await db.query(
                `INSERT INTO variantes_ejercicio (alumno_id, ejercicio_id, contenido)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (alumno_id, ejercicio_id) DO UPDATE SET contenido = EXCLUDED.contenido`,
                [alumnoId, data.ejercicioId, JSON.stringify(variante)]
              )
            }
          }
        } catch (e) {
          console.error('Error generando variantes IA:', e)
        }
      }
    }

    // Enviar a cada alumno su versión (variante o base)
    for (const alumno of alumnos.rows) {
      const variante = variantesPorAlumno.get(alumno.id)
      const contenido = variante || ej.contenido

      io.to(`alumno:${alumno.id}`).emit('ejercicio:nuevo', {
        id: ej.id,
        titulo: ej.titulo,
        tipo: ej.tipo,
        puntos: ej.puntos,
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

    // Obtener nombre del alumno y sala para notificar a la profesora
    const alumno = await db.query(
      `SELECT a.nombre, a.apellido, als.sala_id
       FROM alumnos a
       LEFT JOIN alumno_salas als ON als.alumno_id = a.id
       WHERE a.id = $1
       LIMIT 1`,
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
