import type { Ciudad } from "./ciudades"

export const OPEN_METEO_ARCHIVE_URL =
  "https://archive-api.open-meteo.com/v1/archive"

export const VARIABLES_HORARIAS = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
] as const

export const MAX_DIAS_EXTRACCION = 31

const MS_DIA = 24 * 60 * 60 * 1000

/** Fecha "AAAA-MM-DD" → milisegundos UTC a medianoche, o null si no existe. */
export function parsearFechaDia(valor: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
  if (!m) return null
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const ms = Date.UTC(anio, mes - 1, dia)
  const d = new Date(ms)
  // Rechaza fechas imposibles como 2026-02-30, que Date.UTC desplazaría.
  if (
    d.getUTCFullYear() !== anio ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia
  ) {
    return null
  }
  return ms
}

export function diasInclusivos(inicio: string, fin: string): number | null {
  const a = parsearFechaDia(inicio)
  const b = parsearFechaDia(fin)
  if (a === null || b === null) return null
  return Math.round((b - a) / MS_DIA) + 1
}

export type ErroresConfiguracion = string[]

export function validarConfiguracion(
  ciudades: string[],
  inicio: string,
  fin: string,
  hoy: Date = new Date()
): ErroresConfiguracion {
  const errores: string[] = []
  if (ciudades.length === 0) errores.push("Selecciona al menos una ciudad.")
  const a = parsearFechaDia(inicio)
  const b = parsearFechaDia(fin)
  if (a === null) errores.push("La fecha inicial no es válida.")
  if (b === null) errores.push("La fecha final no es válida.")
  if (a !== null && b !== null) {
    if (a > b) {
      errores.push("La fecha inicial debe ser anterior o igual a la final.")
    } else {
      const dias = Math.round((b - a) / MS_DIA) + 1
      if (dias > MAX_DIAS_EXTRACCION) {
        errores.push(
          `El periodo tiene ${dias} días; el máximo por extracción es ${MAX_DIAS_EXTRACCION}.`
        )
      }
    }
    const hoyUtc = Date.UTC(
      hoy.getUTCFullYear(),
      hoy.getUTCMonth(),
      hoy.getUTCDate()
    )
    if (b > hoyUtc) errores.push("La fecha final no puede estar en el futuro.")
    if (a < Date.UTC(1940, 0, 1)) {
      errores.push("El archivo histórico empieza el 1 de enero de 1940.")
    }
  }
  return errores
}

export function construirUrlArchivo(
  ciudad: Ciudad,
  inicio: string,
  fin: string
): string {
  const params = new URLSearchParams({
    latitude: String(ciudad.latitud),
    longitude: String(ciudad.longitud),
    start_date: inicio,
    end_date: fin,
    hourly: VARIABLES_HORARIAS.join(","),
    timezone: "GMT",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
  })
  return `${OPEN_METEO_ARCHIVE_URL}?${params.toString()}`
}
