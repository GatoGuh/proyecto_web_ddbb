/** Respuesta JSON original de Open-Meteo para una ciudad, sin modificar. */
export type RespuestaCiudad = {
  ciudad: string
  json: unknown
}

/**
 * Fila resultante de "desenrollar" los arrays paralelos. Las mediciones se
 * conservan tal como llegaron (unknown): la limpieza decide si son válidas.
 */
export type RegistroTransformado = {
  /** Identificador de la fila dentro de la extracción: ciudad#índice. */
  id: string
  ciudad: string
  indice: number
  fecha_hora_original: unknown
  /** ISO 8601 en UTC, o null si no se pudo interpretar. */
  fecha_hora: string | null
  temperatura_c: unknown
  humedad_pct: unknown
  precipitacion_mm: unknown
  /** Incidencias detectadas al transformar (p. ej., arrays de distinta longitud). */
  avisos: string[]
}

/** Registro normalizado y válido: es lo que se puede subir a Supabase. */
export type RegistroValido = {
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}

export type RegistroRechazado = {
  registro: RegistroTransformado
  motivos: string[]
}

export type ResultadoTransformacion = {
  registros: RegistroTransformado[]
  /** Errores que impiden procesar la respuesta completa de una ciudad. */
  erroresEstructurales: { ciudad: string; mensaje: string }[]
  avisos: { ciudad: string; mensaje: string }[]
}

export type ResultadoLimpieza = {
  validos: RegistroValido[]
  rechazados: RegistroRechazado[]
}

export function claveRegistro(r: { ciudad: string; fecha_hora: string }) {
  return `${r.ciudad}|${r.fecha_hora}`
}
