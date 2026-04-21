import { Router, Response } from 'express'
import { Resend } from 'resend'
import { db } from '../db'
import { verificarToken, soloProfesor, AuthRequest } from '../middleware/auth'

const router = Router()

function fechaDesde(periodo: string): Date {
  const ahora = new Date()
  if (periodo === 'semana') {
    const d = new Date(ahora)
    d.setDate(d.getDate() - 7)
    return d
  }
  if (periodo === 'semestre') {
    const d = new Date(ahora)
    d.setMonth(d.getMonth() - 6)
    return d
  }
  // mes por defecto
  const d = new Date(ahora)
  d.setMonth(d.getMonth() - 1)
  return d
}

// Helper: obtener rol de la profesora en una sala
async function getRolEnSala(profesoraId: number, salaId: number): Promise<'jefe' | 'materia' | null> {
  const r = await db.query(
    'SELECT rol FROM profesora_salas WHERE profesora_id = $1 AND sala_id = $2',
    [profesoraId, salaId]
  )
  return r.rows[0]?.rol || null
}

// Helper: obtener materias que enseña una profesora en una sala (por sus planificaciones)
async function getMisMateriasEnSala(profesoraId: number, salaId: number): Promise<number[]> {
  const r = await db.query(
    `SELECT DISTINCT materia_id FROM planificaciones
     WHERE profesora_id = $1 AND sala_id = $2 AND materia_id IS NOT NULL`,
    [profesoraId, salaId]
  )
  return r.rows.map((row: { materia_id: number }) => row.materia_id)
}

// ─── Vista clase (con rol y filtrado) ────────────────────────────────────────
router.get('/clase/:salaId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { salaId } = req.params
  const desde = fechaDesde(String(req.query.periodo || 'mes'))
  const profesoraId = req.usuario!.id

  const rol = await getRolEnSala(profesoraId, Number(salaId))
  if (!rol) {
    res.status(403).json({ error: 'No tienes acceso a esta sala' })
    return
  }

  // Si es materia, solo mostrar sus materias
  const misMaterias = rol === 'materia' ? await getMisMateriasEnSala(profesoraId, Number(salaId)) : null

  // Datos por alumno y materia
  const datos = await db.query(
    `SELECT
       a.id AS alumno_id,
       a.nombre || ' ' || a.apellido AS alumno,
       a.genero,
       m.id AS materia_id,
       m.nombre AS materia,
       m.color AS materia_color,
       COUNT(r.id) AS total,
       SUM(CASE WHEN r.es_correcto THEN 1 ELSE 0 END) AS correctos,
       COALESCE(SUM(r.puntos_obtenidos), 0) AS puntos
     FROM alumnos a
     JOIN alumno_salas als ON als.alumno_id = a.id
     LEFT JOIN respuestas r ON r.alumno_id = a.id AND r.creado_en >= $2
     LEFT JOIN ejercicios e ON e.id = r.ejercicio_id
     LEFT JOIN planificaciones p ON p.id = e.planificacion_id AND p.sala_id = $1
     LEFT JOIN materias m ON m.id = p.materia_id
     WHERE als.sala_id = $1
     GROUP BY a.id, a.nombre, a.apellido, a.genero, m.id, m.nombre, m.color
     ORDER BY a.apellido, a.nombre`,
    [salaId, desde]
  )

  // Calcular percentiles por materia
  const porMateria: Record<number, { alumnoId: number; pct: number }[]> = {}
  for (const row of datos.rows) {
    if (!row.materia_id) continue
    if (misMaterias && !misMaterias.includes(row.materia_id)) continue
    const pct = row.total > 0 ? Math.round((row.correctos / row.total) * 100) : 0
    if (!porMateria[row.materia_id]) porMateria[row.materia_id] = []
    porMateria[row.materia_id].push({ alumnoId: row.alumno_id, pct })
  }

  const percentiles: Record<string, number> = {}
  for (const [materiaId, lista] of Object.entries(porMateria)) {
    const sorted = [...lista].sort((a, b) => a.pct - b.pct)
    for (let i = 0; i < sorted.length; i++) {
      const key = `${sorted[i].alumnoId}_${materiaId}`
      percentiles[key] = Math.round((i / Math.max(sorted.length - 1, 1)) * 100)
    }
  }

  // Estructurar respuesta
  const alumnos: Record<number, { id: number; nombre: string; genero: string | null; materias: unknown[]; puntosTotales: number }> = {}
  for (const row of datos.rows) {
    if (!alumnos[row.alumno_id]) {
      alumnos[row.alumno_id] = { id: row.alumno_id, nombre: row.alumno, genero: row.genero, materias: [], puntosTotales: 0 }
    }
    if (row.materia_id) {
      if (misMaterias && !misMaterias.includes(row.materia_id)) continue
      const pct = row.total > 0 ? Math.round((row.correctos / row.total) * 100) : null
      const key = `${row.alumno_id}_${row.materia_id}`
      alumnos[row.alumno_id].materias.push({
        id: row.materia_id,
        nombre: row.materia,
        color: row.materia_color,
        total: Number(row.total),
        correctos: Number(row.correctos),
        puntos: Number(row.puntos),
        porcentaje: pct,
        percentil: percentiles[key] ?? null
      })
      alumnos[row.alumno_id].puntosTotales += Number(row.puntos)
    }
  }

  res.json({ rol, alumnos: Object.values(alumnos) })
})

// ─── Resumen por materia (promedios de la clase) ─────────────────────────────
router.get('/resumen-materias/:salaId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { salaId } = req.params
  const desde = fechaDesde(String(req.query.periodo || 'mes'))
  const profesoraId = req.usuario!.id

  const rol = await getRolEnSala(profesoraId, Number(salaId))
  if (!rol) { res.status(403).json({ error: 'Sin acceso' }); return }

  const misMaterias = rol === 'materia' ? await getMisMateriasEnSala(profesoraId, Number(salaId)) : null

  const resultado = await db.query(
    `SELECT
       m.id AS materia_id, m.nombre AS materia, m.color,
       COUNT(DISTINCT a.id) AS total_alumnos,
       COUNT(r.id) AS total_ejercicios,
       SUM(CASE WHEN r.es_correcto THEN 1 ELSE 0 END) AS correctos,
       COALESCE(SUM(r.puntos_obtenidos), 0) AS puntos,
       ROUND(AVG(r.tiempo_segundos)) AS tiempo_promedio
     FROM respuestas r
     JOIN alumnos a ON a.id = r.alumno_id
     JOIN alumno_salas als ON als.alumno_id = a.id AND als.sala_id = $1
     JOIN ejercicios e ON e.id = r.ejercicio_id
     JOIN planificaciones p ON p.id = e.planificacion_id AND p.sala_id = $1
     JOIN materias m ON m.id = p.materia_id
     WHERE r.creado_en >= $2
     GROUP BY m.id, m.nombre, m.color
     ORDER BY m.nombre`,
    [salaId, desde]
  )

  let materias = resultado.rows.map((r: { materia_id: number; materia: string; color: string; total_alumnos: string; total_ejercicios: string; correctos: string; puntos: string; tiempo_promedio: string }) => ({
    id: r.materia_id,
    nombre: r.materia,
    color: r.color,
    totalAlumnos: Number(r.total_alumnos),
    totalEjercicios: Number(r.total_ejercicios),
    correctos: Number(r.correctos),
    puntos: Number(r.puntos),
    porcentaje: Number(r.total_ejercicios) > 0
      ? Math.round((Number(r.correctos) / Number(r.total_ejercicios)) * 100)
      : 0,
    tiempoPromedio: r.tiempo_promedio ? Number(r.tiempo_promedio) : null
  }))

  if (misMaterias) {
    materias = materias.filter((m: { id: number }) => misMaterias.includes(m.id))
  }

  res.json({ rol, materias })
})

// ─── Detalle materia: ranking de alumnos en una materia ──────────────────────
router.get('/materia/:materiaId/sala/:salaId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { materiaId, salaId } = req.params
  const desde = fechaDesde(String(req.query.periodo || 'mes'))

  const resultado = await db.query(
    `SELECT
       a.id AS alumno_id,
       a.nombre || ' ' || a.apellido AS alumno,
       a.genero,
       COALESCE(t.nombre, 'Sin tema') AS tema,
       t.id AS tema_id,
       COUNT(r.id) AS total,
       SUM(CASE WHEN r.es_correcto THEN 1 ELSE 0 END) AS correctos,
       COALESCE(SUM(r.puntos_obtenidos), 0) AS puntos
     FROM alumnos a
     JOIN alumno_salas als ON als.alumno_id = a.id AND als.sala_id = $1
     LEFT JOIN respuestas r ON r.alumno_id = a.id AND r.creado_en >= $3
     LEFT JOIN ejercicios e ON e.id = r.ejercicio_id
     LEFT JOIN planificaciones p ON p.id = e.planificacion_id AND p.sala_id = $1 AND p.materia_id = $2
     LEFT JOIN temas t ON t.id = e.tema_id
     WHERE (p.materia_id = $2 OR p.id IS NULL)
     GROUP BY a.id, a.nombre, a.apellido, a.genero, t.id, t.nombre
     ORDER BY a.apellido, a.nombre, t.nombre`,
    [salaId, materiaId, desde]
  )

  // Agrupar por alumno
  const alumnos: Record<number, {
    id: number; nombre: string; genero: string | null
    total: number; correctos: number; puntos: number; porcentaje: number
    temas: { nombre: string; total: number; correctos: number; porcentaje: number }[]
  }> = {}

  for (const row of resultado.rows) {
    if (!alumnos[row.alumno_id]) {
      alumnos[row.alumno_id] = {
        id: row.alumno_id, nombre: row.alumno, genero: row.genero,
        total: 0, correctos: 0, puntos: 0, porcentaje: 0, temas: []
      }
    }
    const t = Number(row.total)
    const c = Number(row.correctos)
    if (t > 0 && row.tema) {
      alumnos[row.alumno_id].total += t
      alumnos[row.alumno_id].correctos += c
      alumnos[row.alumno_id].puntos += Number(row.puntos)
      alumnos[row.alumno_id].temas.push({
        nombre: row.tema,
        total: t,
        correctos: c,
        porcentaje: Math.round((c / t) * 100)
      })
    }
  }

  // Calcular porcentaje general
  for (const al of Object.values(alumnos)) {
    al.porcentaje = al.total > 0 ? Math.round((al.correctos / al.total) * 100) : 0
  }

  // Ordenar por porcentaje desc
  const lista = Object.values(alumnos).sort((a, b) => b.porcentaje - a.porcentaje)

  res.json(lista)
})

// ─── Perfil individual ───────────────────────────────────────────────────────
router.get('/alumno/:alumnoId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { alumnoId } = req.params
  const { salaId, periodo } = req.query
  const desde = fechaDesde(String(periodo || 'mes'))

  // Info del alumno
  const alumnoRes = await db.query(
    'SELECT id, nombre, apellido, email_apoderado, genero, nombre_padre, nombre_madre FROM alumnos WHERE id = $1',
    [alumnoId]
  )
  if (alumnoRes.rows.length === 0) { res.status(404).json({ error: 'Alumno no encontrado' }); return }
  const alumno = alumnoRes.rows[0]

  // Rol de la profesora
  let rol: string | null = null
  if (salaId) {
    rol = await getRolEnSala(req.usuario!.id, Number(salaId))
  }

  // Rendimiento por tema y materia
  const temas = await db.query(
    `SELECT
       m.id AS materia_id, m.nombre AS materia, m.color,
       COALESCE(t.nombre, 'Sin tema') AS tema,
       COUNT(r.id) AS total,
       SUM(CASE WHEN r.es_correcto THEN 1 ELSE 0 END) AS correctos,
       COALESCE(SUM(r.puntos_obtenidos), 0) AS puntos
     FROM respuestas r
     JOIN ejercicios e ON e.id = r.ejercicio_id
     JOIN planificaciones p ON p.id = e.planificacion_id
     JOIN materias m ON m.id = p.materia_id
     LEFT JOIN temas t ON t.id = e.tema_id
     WHERE r.alumno_id = $1 AND r.creado_en >= $2
       ${salaId ? 'AND p.sala_id = $3' : ''}
     GROUP BY m.id, m.nombre, m.color, t.nombre
     ORDER BY m.nombre, t.nombre`,
    salaId ? [alumnoId, desde, salaId] : [alumnoId, desde]
  )

  // Ejercicios incorrectos
  const errores = await db.query(
    `SELECT e.titulo, e.tipo, m.nombre AS materia, COALESCE(t.nombre, 'Sin tema') AS tema,
            r.creado_en
     FROM respuestas r
     JOIN ejercicios e ON e.id = r.ejercicio_id
     JOIN planificaciones p ON p.id = e.planificacion_id
     JOIN materias m ON m.id = p.materia_id
     LEFT JOIN temas t ON t.id = e.tema_id
     WHERE r.alumno_id = $1 AND r.es_correcto = false AND r.creado_en >= $2
     ORDER BY r.creado_en DESC LIMIT 30`,
    [alumnoId, desde]
  )

  // Historial reciente (últimas 20 respuestas)
  const historial = await db.query(
    `SELECT e.titulo, m.nombre AS materia, m.color,
            r.es_correcto, r.puntos_obtenidos, r.tiempo_segundos, r.creado_en
     FROM respuestas r
     JOIN ejercicios e ON e.id = r.ejercicio_id
     JOIN planificaciones p ON p.id = e.planificacion_id
     JOIN materias m ON m.id = p.materia_id
     WHERE r.alumno_id = $1 AND r.creado_en >= $2
       ${salaId ? 'AND p.sala_id = $3' : ''}
     ORDER BY r.creado_en DESC LIMIT 20`,
    salaId ? [alumnoId, desde, salaId] : [alumnoId, desde]
  )

  // Percentil en cada materia vs la sala
  let percentiles: Record<number, number> = {}
  if (salaId) {
    const compañeros = await db.query(
      `SELECT a.id AS alumno_id, m.id AS materia_id,
              COUNT(r.id) AS total,
              SUM(CASE WHEN r.es_correcto THEN 1 ELSE 0 END) AS correctos
       FROM alumnos a
       JOIN alumno_salas als ON als.alumno_id = a.id
       LEFT JOIN respuestas r ON r.alumno_id = a.id AND r.creado_en >= $2
       LEFT JOIN ejercicios e ON e.id = r.ejercicio_id
       LEFT JOIN planificaciones p ON p.id = e.planificacion_id AND p.sala_id = $1
       LEFT JOIN materias m ON m.id = p.materia_id
       WHERE als.sala_id = $1 AND m.id IS NOT NULL
       GROUP BY a.id, m.id`,
      [salaId, desde]
    )

    const porMateria: Record<number, { alumnoId: number; pct: number }[]> = {}
    for (const row of compañeros.rows) {
      const pct = row.total > 0 ? Math.round((row.correctos / row.total) * 100) : 0
      if (!porMateria[row.materia_id]) porMateria[row.materia_id] = []
      porMateria[row.materia_id].push({ alumnoId: row.alumno_id, pct })
    }

    for (const [matId, lista] of Object.entries(porMateria)) {
      const sorted = [...lista].sort((a, b) => a.pct - b.pct)
      const idx = sorted.findIndex(x => x.alumnoId === Number(alumnoId))
      if (idx >= 0) percentiles[Number(matId)] = Math.round((idx / Math.max(sorted.length - 1, 1)) * 100)
    }
  }

  // Puntos totales
  const puntosRes = await db.query(
    `SELECT COALESCE(SUM(puntos_obtenidos), 0) AS total
     FROM respuestas WHERE alumno_id = $1 AND creado_en >= $2`,
    [alumnoId, desde]
  )

  res.json({
    alumno,
    rol,
    puntosTotales: Number(puntosRes.rows[0].total),
    temas: temas.rows,
    errores: errores.rows,
    historial: historial.rows,
    percentiles
  })
})

// ─── Asistencia de una sesión (vista en vivo) ────────────────────────────────
router.get('/asistencia/sesion/:sesionId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const resultado = await db.query(
    `SELECT a.id AS alumno_id, a.nombre || ' ' || a.apellido AS alumno,
            asi.presente, asi.marcado_en
     FROM asistencia asi
     JOIN alumnos a ON a.id = asi.alumno_id
     WHERE asi.sesion_id = $1
     ORDER BY a.apellido, a.nombre`,
    [req.params.sesionId]
  )
  res.json(resultado.rows)
})

// ─── Asistencia de una sala ──────────────────────────────────────────────────
router.get('/asistencia/:salaId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { salaId } = req.params
  const desde = fechaDesde(String(req.query.periodo || 'mes'))

  const resultado = await db.query(
    `SELECT
       a.id AS alumno_id,
       a.nombre || ' ' || a.apellido AS alumno,
       COUNT(asi.id) AS total_clases,
       SUM(CASE WHEN asi.presente THEN 1 ELSE 0 END) AS clases_presentes
     FROM alumnos a
     JOIN alumno_salas als ON als.alumno_id = a.id AND als.sala_id = $1
     LEFT JOIN asistencia asi ON asi.alumno_id = a.id
     LEFT JOIN sesiones s ON s.id = asi.sesion_id AND s.iniciada_en >= $2
     LEFT JOIN planificaciones p ON p.id = s.planificacion_id AND p.sala_id = $1
     WHERE (p.sala_id = $1 OR asi.id IS NULL)
     GROUP BY a.id, a.nombre, a.apellido
     ORDER BY a.apellido, a.nombre`,
    [salaId, desde]
  )

  res.json(resultado.rows.map((r: any) => ({
    alumnoId: r.alumno_id,
    alumno: r.alumno,
    totalClases: Number(r.total_clases),
    clasesPresentes: Number(r.clases_presentes),
    porcentaje: Number(r.total_clases) > 0
      ? Math.round((Number(r.clases_presentes) / Number(r.total_clases)) * 100)
      : 0
  })))
})

// ─── Enviar reporte por email a apoderados ──────────────────────────────────
router.post('/reporte/:salaId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!process.env.RESEND_API_KEY) {
    res.status(500).json({ error: 'Email no configurado' })
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const desde = fechaDesde('mes')

  const alumnos = await db.query(
    `SELECT a.id, a.nombre, a.apellido, a.email_apoderado
     FROM alumnos a
     JOIN alumno_salas als ON als.alumno_id = a.id
     WHERE als.sala_id = $1 AND a.email_apoderado IS NOT NULL`,
    [req.params.salaId]
  )

  let enviados = 0
  for (const alumno of alumnos.rows) {
    const stats = await db.query(
      `SELECT m.nombre AS materia,
              COUNT(r.id) AS total,
              SUM(CASE WHEN r.es_correcto THEN 1 ELSE 0 END) AS correctos,
              COALESCE(SUM(r.puntos_obtenidos), 0) AS puntos
       FROM respuestas r
       JOIN ejercicios e ON e.id = r.ejercicio_id
       JOIN planificaciones p ON p.id = e.planificacion_id
       JOIN materias m ON m.id = p.materia_id
       WHERE r.alumno_id = $1 AND r.creado_en >= $2
       GROUP BY m.nombre`,
      [alumno.id, desde]
    )

    const filasTabla = stats.rows.map((s: { materia: string; total: number; correctos: number; puntos: number }) => {
      const pct = s.total > 0 ? Math.round((s.correctos / s.total) * 100) : 0
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${s.materia}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${pct}%</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${s.puntos} pts</td>
      </tr>`
    }).join('')

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="color:#6C5CE7">AprendIA — Reporte mensual</h2>
        <p>Estimado/a apoderado/a,</p>
        <p>Aquí está el resumen del mes de <strong>${alumno.nombre} ${alumno.apellido}</strong>:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead>
            <tr style="background:#f8f7ff">
              <th style="padding:8px 12px;text-align:left;color:#6C5CE7">Materia</th>
              <th style="padding:8px 12px;color:#6C5CE7">% Acierto</th>
              <th style="padding:8px 12px;color:#6C5CE7">Puntos</th>
            </tr>
          </thead>
          <tbody>${filasTabla || '<tr><td colspan="3" style="padding:12px;color:#999;text-align:center">Sin actividad este mes</td></tr>'}</tbody>
        </table>
        <p style="color:#999;font-size:12px">Este reporte fue generado automáticamente por AprendIA.</p>
      </div>`

    await resend.emails.send({
      from: 'AprendIA <reportes@aprendia.cl>',
      to: alumno.email_apoderado,
      subject: `Reporte mensual de ${alumno.nombre} ${alumno.apellido} — AprendIA`,
      html
    })
    enviados++
  }

  res.json({ ok: true, enviados })
})

export default router
