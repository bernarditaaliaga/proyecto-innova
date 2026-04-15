-- =============================================
-- ESQUEMA BASE DE DATOS - App Aula
-- =============================================

-- Tabla de profesoras
CREATE TABLE IF NOT EXISTS profesoras (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Tabla de salas (una profesora puede tener varias salas)
CREATE TABLE IF NOT EXISTS salas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,         -- ej: "3ro A"
  codigo VARCHAR(10) UNIQUE NOT NULL,   -- ej: "3A2024"
  profesora_id INTEGER REFERENCES profesoras(id),
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Tabla de alumnos
CREATE TABLE IF NOT EXISTS alumnos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  sala_id INTEGER REFERENCES salas(id),
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Tabla de materias
CREATE TABLE IF NOT EXISTS materias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,         -- ej: "Matemáticas", "Lenguaje"
  sala_id INTEGER REFERENCES salas(id)
);

-- Tabla de ejercicios creados por la profesora
CREATE TABLE IF NOT EXISTS ejercicios (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  tipo VARCHAR(50) NOT NULL,            -- 'seleccion_multiple' | 'completar_texto' | 'dibujo' | 'mostrar_imagen' | 'mostrar_video'
  contenido JSONB NOT NULL,             -- estructura flexible según el tipo
  materia_id INTEGER REFERENCES materias(id),
  profesora_id INTEGER REFERENCES profesoras(id),
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Tabla de respuestas de los alumnos
CREATE TABLE IF NOT EXISTS respuestas (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id),
  ejercicio_id INTEGER REFERENCES ejercicios(id),
  contenido JSONB,                      -- la respuesta del alumno
  es_correcto BOOLEAN,
  tiempo_segundos INTEGER,              -- cuánto tardó en responder
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Vista de rendimiento por alumno y materia (calculada)
CREATE OR REPLACE VIEW rendimiento_alumno AS
SELECT
  a.id AS alumno_id,
  a.nombre || ' ' || a.apellido AS alumno,
  m.nombre AS materia,
  COUNT(r.id) AS total_ejercicios,
  SUM(CASE WHEN r.es_correcto THEN 1 ELSE 0 END) AS correctos,
  ROUND(
    100.0 * SUM(CASE WHEN r.es_correcto THEN 1 ELSE 0 END) / NULLIF(COUNT(r.id), 0), 1
  ) AS porcentaje_correcto,
  AVG(r.tiempo_segundos) AS tiempo_promedio_segundos
FROM alumnos a
JOIN respuestas r ON r.alumno_id = a.id
JOIN ejercicios e ON e.id = r.ejercicio_id
JOIN materias m ON m.id = e.materia_id
GROUP BY a.id, a.nombre, a.apellido, m.nombre;
