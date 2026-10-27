import type {
  RegistroTransformado,
  RespuestaCiudad,
  ResultadoTransformacion,
} from "./tipos"

const CAMPOS = [
  { origen: "temperature_2m", destino: "temperatura_c" },
  { origen: "relative_humidity_2m", destino: "humedad_pct" },
  { origen: "precipitation", destino: "precipitacion_mm" },
] as const

const FORMATO_HORA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?Z?$/

/**
 * Interpreta "2026-09-01T13:00" como UTC de forma explícita. No se usa
 * `new Date(texto)` porque, sin sufijo de zona, el navegador lo leería en la
 * hora local del equipo.
 */
export function interpretarHoraUtc(valor: unknown): string | null {
  if (typeof valor !== "string") return null
  const m = FORMATO_HORA.exec(valor)
  if (!m) return null
  const [anio, mes, dia, hora, minuto, segundo] = [
    Number(m[1]),
    Number(m[2]),
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] ?? 0),
  ]
  const ms = Date.UTC(anio, mes - 1, dia, hora, minuto, segundo)
  const d = new Date(ms)
  if (
    d.getUTCFullYear() !== anio ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia ||
    d.getUTCHours() !== hora ||
    d.getUTCMinutes() !== minuto ||
    d.getUTCSeconds() !== segundo
  ) {
    return null
  }
  return d.toISOString()
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * Convierte los arrays paralelos de `hourly` en un registro por ciudad y hora.
 * No valida las mediciones: solo las coloca en su fila.
 */
export function transformarRespuesta(
  respuesta: RespuestaCiudad
): ResultadoTransformacion {
  const { ciudad, json } = respuesta
  const resultado: ResultadoTransformacion = {
    registros: [],
    erroresEstructurales: [],
    avisos: [],
  }
  const error = (mensaje: string) => {
    resultado.erroresEstructurales.push({ ciudad, mensaje })
    return resultado
  }

  if (!esObjeto(json)) return error("La respuesta no es un objeto JSON.")
  if (json.error === true) {
    return error(`La API devolvió un error: ${String(json.reason ?? "")}`)
  }
  if (json.utc_offset_seconds !== 0) {
    return error(
      `Se esperaba utc_offset_seconds = 0 (UTC) y se recibió ${String(json.utc_offset_seconds)}.`
    )
  }
  const hourly = json.hourly
  if (!esObjeto(hourly)) return error("Falta el bloque «hourly».")
  if (!Array.isArray(hourly.time)) {
    return error("Falta el array «hourly.time».")
  }

  const tiempos = hourly.time
  const series = CAMPOS.map((campo) => {
    const valores = hourly[campo.origen]
    return {
      ...campo,
      valores: Array.isArray(valores) ? valores : null,
    }
  })

  for (const s of series) {
    if (s.valores === null) {
      resultado.avisos.push({
        ciudad,
        mensaje: `Falta el array «${s.origen}»; sus valores se tratarán como ausentes.`,
      })
    } else if (s.valores.length !== tiempos.length) {
      resultado.avisos.push({
        ciudad,
        mensaje: `Longitudes incoherentes: «time» tiene ${tiempos.length} elementos y «${s.origen}» tiene ${s.valores.length}.`,
      })
    }
  }

  // Se recorre la longitud máxima para no perder filas silenciosamente: las
  // posiciones sin valor quedan como ausentes y la limpieza las rechaza.
  const longitud = Math.max(
    tiempos.length,
    ...series.map((s) => s.valores?.length ?? 0)
  )

  for (let i = 0; i < longitud; i++) {
    const avisos: string[] = []
    if (i >= tiempos.length)
      avisos.push("Sin elemento en «time» (array más corto).")
    const fila: RegistroTransformado = {
      id: `${ciudad}#${i}`,
      ciudad,
      indice: i,
      fecha_hora_original: tiempos[i],
      fecha_hora: interpretarHoraUtc(tiempos[i]),
      temperatura_c: undefined,
      humedad_pct: undefined,
      precipitacion_mm: undefined,
      avisos,
    }
    for (const s of series) {
      if (s.valores !== null && i >= s.valores.length) {
        avisos.push(`Sin elemento en «${s.origen}» (array más corto).`)
      }
      fila[s.destino] = s.valores?.[i]
    }
    resultado.registros.push(fila)
  }

  return resultado
}

export function transformarRespuestas(
  respuestas: RespuestaCiudad[]
): ResultadoTransformacion {
  const total: ResultadoTransformacion = {
    registros: [],
    erroresEstructurales: [],
    avisos: [],
  }
  for (const r of respuestas) {
    const parcial = transformarRespuesta(r)
    total.registros.push(...parcial.registros)
    total.erroresEstructurales.push(...parcial.erroresEstructurales)
    total.avisos.push(...parcial.avisos)
  }
  return total
}
