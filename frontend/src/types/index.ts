export interface Usuario {
  id: number
  nombre: string
  apellido?: string
  email?: string
  username?: string
  rol: 'profesora' | 'alumno'
  salaId?: number
  sala?: string
}

export interface Sala {
  id: number
  nombre: string
  codigo: string
  total_alumnos: number
  rol?: 'jefe' | 'materia'
  anio?: number
}

export interface Alumno {
  id: number
  nombre: string
  apellido: string
  username: string
  email_apoderado?: string
  sala_id?: number
  genero?: 'M' | 'F'
  nombre_padre?: string
  nombre_madre?: string
  creado_en?: string
}

export interface Materia {
  id: number
  nombre: string
  color: string
  icono: string
  temas: Tema[]
}

export interface Tema {
  id: number
  nombre: string
  materia_id: number
}

export interface Planificacion {
  id: number
  titulo: string
  sala: string
  sala_id: number
  materia: string
  materia_id: number
  materia_color: string
  fecha: string
  total_ejercicios: number
  ejercicios?: Ejercicio[]
  temas?: Tema[]
}

export interface Ejercicio {
  id: number
  titulo: string
  tipo: 'seleccion_multiple' | 'matematica_desarrollo' | 'completar_texto' | 'dibujo' | 'video_youtube' | 'mostrar_imagen'
  contenido: ContenidoEjercicio
  puntos: number
  tema?: string
  tema_id?: number
  generar_variantes: boolean
  orden: number
}

export interface ContenidoEjercicio {
  pregunta?: string
  opciones?: { texto: string; correcta: boolean }[]
  texto_con_blancos?: string
  tokens?: { texto: string; esBlanco: boolean }[]
  enunciado?: string
  respuesta_correcta?: string | number
  respuestas_alternativas?: string[]
  url_video?: string
  url_imagen?: string
  instruccion?: string
}

export interface Sesion {
  id: number
  planificacion_id: number
  ejercicio_activo_id: number | null
  estado: 'esperando' | 'ejercicio_activo' | 'revisando' | 'finalizada'
}
