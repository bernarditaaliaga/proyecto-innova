-- =============================================
-- APREND IA — Esquema completo de base de datos
-- =============================================

-- Profesoras
CREATE TABLE IF NOT EXISTS profesoras (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Salas (un curso = una sala)
CREATE TABLE IF NOT EXISTS salas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,        -- ej: "3ro A"
  codigo VARCHAR(20) UNIQUE NOT NULL,  -- ej: "3A-2024"
  profesora_id INTEGER REFERENCES profesoras(id) ON DELETE SET NULL,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Alumnos
CREATE TABLE IF NOT EXISTS alumnos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  sala_id INTEGER REFERENCES salas(id) ON DELETE SET NULL,
  email_apoderado VARCHAR(100),
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Relación muchos-a-muchos: alumnos en salas
CREATE TABLE IF NOT EXISTS alumno_salas (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  sala_id INTEGER REFERENCES salas(id) ON DELETE CASCADE,
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE(alumno_id, sala_id)
);

-- Materias (globales, no por sala)
CREATE TABLE IF NOT EXISTS materias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(7) DEFAULT '#4A90D9',  -- color para UI
  icono VARCHAR(50) DEFAULT 'book'
);

-- Temas dentro de cada materia (ej: "Fracciones" en Matemáticas)
CREATE TABLE IF NOT EXISTS temas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  materia_id INTEGER REFERENCES materias(id) ON DELETE CASCADE
);

-- Planificaciones de clase (la profesora prepara antes)
CREATE TABLE IF NOT EXISTS planificaciones (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  profesora_id INTEGER REFERENCES profesoras(id) ON DELETE CASCADE,
  sala_id INTEGER REFERENCES salas(id) ON DELETE CASCADE,
  materia_id INTEGER REFERENCES materias(id),
  fecha DATE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Ejercicios dentro de una planificación
CREATE TABLE IF NOT EXISTS ejercicios (
  id SERIAL PRIMARY KEY,
  planificacion_id INTEGER REFERENCES planificaciones(id) ON DELETE CASCADE,
  tema_id INTEGER REFERENCES temas(id) ON DELETE SET NULL,
  titulo VARCHAR(200) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  -- tipos: seleccion_multiple | completar_texto | dibujo | video_youtube | mostrar_imagen
  contenido JSONB NOT NULL,            -- estructura según tipo
  puntos INTEGER DEFAULT 10,
  orden INTEGER DEFAULT 0,             -- orden dentro de la planificación
  generar_variantes BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Variantes generadas por IA para cada alumno
CREATE TABLE IF NOT EXISTS variantes_ejercicio (
  id SERIAL PRIMARY KEY,
  ejercicio_id INTEGER REFERENCES ejercicios(id) ON DELETE CASCADE,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  contenido JSONB NOT NULL,            -- versión personalizada del ejercicio
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE(ejercicio_id, alumno_id)
);

-- Sesiones en vivo (cuando la profesora inicia una clase)
CREATE TABLE IF NOT EXISTS sesiones (
  id SERIAL PRIMARY KEY,
  planificacion_id INTEGER REFERENCES planificaciones(id) ON DELETE CASCADE,
  ejercicio_activo_id INTEGER REFERENCES ejercicios(id) ON DELETE SET NULL,
  estado VARCHAR(20) DEFAULT 'esperando',
  -- estados: esperando | ejercicio_activo | revisando | finalizada
  iniciada_en TIMESTAMP DEFAULT NOW(),
  finalizada_en TIMESTAMP
);

-- Respuestas de los alumnos
CREATE TABLE IF NOT EXISTS respuestas (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  ejercicio_id INTEGER REFERENCES ejercicios(id) ON DELETE CASCADE,
  sesion_id INTEGER REFERENCES sesiones(id) ON DELETE CASCADE,
  variante_id INTEGER REFERENCES variantes_ejercicio(id) ON DELETE SET NULL,
  contenido JSONB,                     -- lo que respondió el alumno
  es_correcto BOOLEAN,
  puntos_obtenidos INTEGER DEFAULT 0,
  tiempo_segundos INTEGER,
  creado_en TIMESTAMP DEFAULT NOW(),
  UNIQUE(alumno_id, ejercicio_id, sesion_id)
);

-- =============================================
-- DATOS INICIALES
-- =============================================

INSERT INTO materias (nombre, color, icono) VALUES
  ('Matemáticas', '#E74C3C', 'calculator'),
  ('Lenguaje',    '#3498DB', 'book-open'),
  ('Ciencias',    '#2ECC71', 'flask')
ON CONFLICT DO NOTHING;

INSERT INTO temas (nombre, materia_id) VALUES
  ('Suma y resta',        1),
  ('Multiplicación',      1),
  ('División',            1),
  ('Fracciones',          1),
  ('Geometría',           1),
  ('Comprensión lectora', 2),
  ('Ortografía',          2),
  ('Redacción',           2),
  ('Gramática',           2),
  ('Seres vivos',         3),
  ('Sistema solar',       3),
  ('Materia y energía',   3)
ON CONFLICT DO NOTHING;

-- =============================================
-- VISTAS DE MÉTRICAS
-- =============================================

CREATE OR REPLACE VIEW rendimiento_alumno AS
SELECT
  a.id AS alumno_id,
  a.nombre || ' ' || a.apellido AS alumno,
  a.sala_id,
  m.id AS materia_id,
  m.nombre AS materia,
  t.nombre AS tema,
  COUNT(r.id) AS total_ejercicios,
  SUM(CASE WHEN r.es_correcto THEN 1 ELSE 0 END) AS correctos,
  SUM(r.puntos_obtenidos) AS puntos_obtenidos,
  SUM(e.puntos) AS puntos_posibles,
  ROUND(
    100.0 * SUM(r.puntos_obtenidos) / NULLIF(SUM(e.puntos), 0), 1
  ) AS porcentaje,
  AVG(r.tiempo_segundos) AS tiempo_promedio
FROM alumnos a
JOIN respuestas r ON r.alumno_id = a.id
JOIN ejercicios e ON e.id = r.ejercicio_id
JOIN planificaciones p ON p.id = e.planificacion_id
JOIN materias m ON m.id = p.materia_id
LEFT JOIN temas t ON t.id = e.tema_id
GROUP BY a.id, a.nombre, a.apellido, a.sala_id, m.id, m.nombre, t.nombre;
