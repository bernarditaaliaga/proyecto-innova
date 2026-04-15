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

// ─── Vista clase ────────────────────────────────────────────────────────────
router.get('/clase/:salaId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { salaId } = req.params
  const desde = fechaDesde(String(req.query.periodo || 'mes'))

  // Datos por alumno y materia
  const datos = await db.query(
    `SELECT
       a.id AS alumno_id,
       a.nombre || ' ' || a.apellido AS alumno,
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
     LEFT JOIN planificaciones p ON p.id = e.planificacion_id
     LEFT JOIN materias m ON m.id = p.materia_id
     WHERE als.sala_id = $1
     GROUP BY a.id, a.nombre, a.apellido, m.id, m.nombre, m.color
     ORDER BY a.apellido, a.nombre`,
    [salaId, desde]
  )

  // Calcular percentiles por materia
  // Agrupar % por materia para calcular rankings
  const porMateria: Record<number, { alumnoId: number; pct: number }[]> = {}
  for (const row of datos.rows) {
    if (!row.materia_id) continue
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
  const alumnos: Record<number, { id: number; nombre: string; materias: unknown[]; puntosTotales: number }> = {}
  for (const row of datos.rows) {
    if (!alumnos[row.alumno_id]) {
      alumnos[row.alumno_id] = { id: row.alumno_id, nombre: row.alumno, materias: [], puntosTotales: 0 }
    }
    if (row.materia_id) {
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

  res.json(Object.values(alumnos))
})

// ─── Perfil individual ───────────────────────────────────────────────────────
router.get('/alumno/:alumnoId', verificarToken, soloProfesor, async (req: AuthRequest, res: Response): Promise<void> => {
  const { alumnoId } = req.params
  const { salaId, periodo } = req.query
  const desde = fechaDesde(String(periodo || 'mes'))

  // Info del alumno
  const alumnoRes = await db.query(
    'SELECT id, nombre, apellido, email_apoderado FROM alumnos WHERE id = $1',
    [alumnoId]
  )
  if (alumnoRes.rows.length === 0) { res.status(404).json({ error: 'Alumno no encontrado' }); return }
  const alumno = alumnoRes.rows[0]

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
     GROUP BY m.id, m.nombre, m.color, t.nombre
     ORDER BY m.nombre, t.nombre`,
    [alumnoId, desde]
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
       LEFT JOIN planificaciones p ON p.id = e.planificacion_id
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
    puntosTotales: Number(puntosRes.rows[0].total),
    temas: temas.rows,
    errores: errores.rows,
    percentiles
  })
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
        <h2 style="color:#6C5CE7">🎓 AprendIA — Reporte mensual</h2>
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
