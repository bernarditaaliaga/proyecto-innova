import { Server, Socket } from 'socket.io'
import { db } from '../db'
import { generarVariantesEjercicio, evaluarDibujoConIA } from '../routes/ia'

// Mapeo de socketId -> { sesionId, salaId, timer } para auto-finalizar
const profesorasActivas = new Map<string, { sesionId: number; salaId: number; timer?: ReturnType<typeof setTimeout> }>()

export function registrarEventosSesion(io: Server, socket: Socket) {

  // Cuando la profesora se desconecta, esperar 30s y finalizar sesión
  socket.on('disconnect', async () => {
    const datos = profesorasActivas.get(socket.id)
    if (!datos) return

    console.log(`[Socket] Profesora desconectada, esperando 30s antes de finalizar sesión ${datos.sesionId}`)
    datos.timer = setTimeout(async () => {
      try {
        // Verificar que la sesión no fue retomada por otro socket
        const sesion = await db.query(
          `SELECT estado FROM sesiones WHERE id = $1`,
          [datos.sesionId]
        )
        if (sesion.rows[0]?.estado && sesion.rows[0].estado !== 'finalizada') {
          console.log(`[Socket] Auto-finalizando sesión ${datos.sesionId} (profesora no reconectó)`)
          await db.query(
            `UPDATE sesiones SET estado = 'finalizada', finalizada_en = NOW() WHERE id = $1`,
            [datos.sesionId]
          )
          io.to(`sala:${datos.salaId}`).emit('sesion:finalizada')
        }
      } catch (e) {
        console.error('[Socket] Error auto-finalizando sesión:', e)
      }
      profesorasActivas.delete(socket.id)
    }, 30_000)
  })

  // Alumno se une a su sala
  socket.on('alumno:unirse', async (data: { salaId: number; alumnoId: number }) => {
    console.log(`[Socket] Alumno ${data.alumnoId} uniéndose a sala:${data.salaId}`)
    const room = `sala:${data.salaId}`
    socket.join(room)
    socket.join(`alumno:${data.alumnoId}`)

    // Verificar si hay sesión activa
    const sesion = await db.query(
      `SELECT s.*, e.tipo, e.contenido, e.titulo, e.puntos,
              m.nombre AS materia, pr.nombre AS profesora
       FROM sesiones s
       LEFT JOIN ejercicios e ON e.id = s.ejercicio_activo_id
       LEFT JOIN planificaciones p ON p.id = s.planificacion_id
       LEFT JOIN materias m ON m.id = p.materia_id
       LEFT JOIN profesoras pr ON pr.id = p.profesora_id
       WHERE s.planificacion_id IN (
         SELECT id FROM planificaciones WHERE sala_id = $1
       ) AND s.estado != 'finalizada'
         AND s.iniciada_en > NOW() - INTERVAL '4 hours'
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
          materia: row.materia || '',
          profesora: row.profesora || '',
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
        socket.emit('sesion:estado', {
          sesionId: row.id,
          materia: row.materia || '',
          profesora: row.profesora || ''
        })
      }
    } else {
      socket.emit('sesion:esperando')
    }
  })

  // Profesora reconecta a sala
  socket.on('profesora:reconectar', async (data: { salaId: number; sesionId: number }) => {
    console.log(`[Socket] Profesora reconecta a sala:${data.salaId}`)
    socket.join(`sala:${data.salaId}`)

    // Cancelar auto-finalización si estaba pendiente
    for (const [oldSocketId, datos] of profesorasActivas.entries()) {
      if (datos.sesionId === data.sesionId && datos.timer) {
        console.log(`[Socket] Cancelando auto-finalización de sesión ${data.sesionId} (profesora reconectó)`)
        clearTimeout(datos.timer)
        profesorasActivas.delete(oldSocketId)
      }
    }
    profesorasActivas.set(socket.id, { sesionId: data.sesionId, salaId: data.salaId })
  })

  // Profesora inicia sesión
  socket.on('profesora:iniciar_sesion', async (data: { planificacionId: number }) => {
    const resultado = await db.query(
      `INSERT INTO sesiones (planificacion_id, estado)
       VALUES ($1, 'esperando') RETURNING *`,
      [data.planificacionId]
    )
    const sesion = resultado.rows[0]

    // Obtener sala, materia y profesora
    const info = await db.query(
      `SELECT p.sala_id, m.nombre AS materia, pr.nombre AS profesora
       FROM planificaciones p
       JOIN materias m ON m.id = p.materia_id
       JOIN profesoras pr ON pr.id = p.profesora_id
       WHERE p.id = $1`,
      [data.planificacionId]
    )
    const salaId = info.rows[0]?.sala_id

    if (salaId) {
      console.log(`[Socket] Profesora inicia sesión en sala:${salaId}, sesionId:${sesion.id}`)
      socket.join(`sala:${salaId}`)
      const room = io.sockets.adapter.rooms.get(`sala:${salaId}`)
      console.log(`[Socket] Sockets en sala:${salaId}: ${room ? room.size : 0}`)
      io.to(`sala:${salaId}`).emit('sesion:iniciada', {
        sesionId: sesion.id,
        materia: info.rows[0]?.materia || '',
        profesora: info.rows[0]?.profesora || ''
      })
      socket.emit('sesion:creada', sesion)
      profesorasActivas.set(socket.id, { sesionId: sesion.id, salaId })
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
    evaluarConIA?: boolean
    instruccionDibujo?: string
  }) => {
    const ejercicio = await db.query('SELECT puntos, tipo, contenido AS ej_contenido FROM ejercicios WHERE id = $1', [data.ejercicioId])
    const puntosMax = ejercicio.rows[0]?.puntos || 0
    const ejTipo = ejercicio.rows[0]?.tipo
    let esCorrecta = data.esCorrecta
    let comentarioIA = ''

    // Evaluación IA para dibujos
    console.log(`[Socket] Respuesta tipo=${ejTipo}, evaluarConIA=${data.evaluarConIA}, tiene instruccion=${!!data.instruccionDibujo}`)
    if (ejTipo === 'dibujo' && data.evaluarConIA) {
      try {
        const contenidoData = data.contenido as { imagen?: string }
        const instruccion = data.instruccionDibujo || ejercicio.rows[0]?.ej_contenido?.instruccion || ''
        if (contenidoData?.imagen && instruccion) {
          const resultado = await evaluarDibujoConIA(instruccion, contenidoData.imagen)
          esCorrecta = resultado.correcto
          comentarioIA = resultado.comentario
        }
      } catch (e) {
        console.error('[Socket] Error evaluando dibujo con IA:', e)
      }
    }

    const puntosObtenidos = esCorrecta ? puntosMax : 0

    await db.query(
      `INSERT INTO respuestas (alumno_id, ejercicio_id, sesion_id, contenido, es_correcto, puntos_obtenidos, tiempo_segundos)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (alumno_id, ejercicio_id, sesion_id) DO NOTHING`,
      [data.alumnoId, data.ejercicioId, data.sesionId,
       JSON.stringify(data.contenido), esCorrecta, puntosObtenidos, data.tiempoSegundos]
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
        esCorrecta,
        puntos: puntosObtenidos
      })
    }

    socket.emit('respuesta:confirmada', { puntosObtenidos, comentarioIA: comentarioIA || '' })
  })

  // Profesora finaliza la sesión
  socket.on('profesora:finalizar_sesion', async (data: { sesionId: number; salaId: number }) => {
    await db.query(
      `UPDATE sesiones SET estado = 'finalizada', finalizada_en = NOW() WHERE id = $1`,
      [data.sesionId]
    )
    io.to(`sala:${data.salaId}`).emit('sesion:finalizada')
    // Limpiar tracking de profesora activa
    profesorasActivas.delete(socket.id)
  })
}
