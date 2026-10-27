import { NOMBRES_CIUDADES } from "./ciudades"
import {
  claveRegistro,
  type RegistroRechazado,
  type RegistroTransformado,
  type RegistroValido,
  type ResultadoLimpieza,
} from "./tipos"

type Regla = { minimo?: number; maximo?: number }

const ETIQUETAS = {
  temperatura_c: "Temperatura",
  humedad_pct: "Humedad",
  precipitacion_mm: "Precipitación",
} as const

// Sin umbrales para la temperatura: un valor extremo puede ser real.
const REGLAS: Record<keyof typeof ETIQUETAS, Regla> = {
  temperatura_c: {},
  humedad_pct: { minimo: 0, maximo: 100 },
  precipitacion_mm: { minimo: 0 },
}

/**
 * Devuelve el motivo de rechazo de una medición o null si es válida.
 * Importante: null, "" o undefined NO se convierten en 0; se rechazan.
 */
export function motivoMedicion(
  campo: keyof typeof ETIQUETAS,
  valor: unknown
): string | null {
  const etiqueta = ETIQUETAS[campo]
  if (valor === undefined) return `${etiqueta}: valor ausente`
  if (valor === null) return `${etiqueta}: valor nulo`
  if (valor === "") return `${etiqueta}: cadena vacía`
  if (typeof valor !== "number") {
    return `${etiqueta}: tipo no numérico (${typeof valor})`
  }
  if (!Number.isFinite(valor)) return `${etiqueta}: número no finito`
  const regla = REGLAS[campo]
  if (regla.minimo !== undefined && valor < regla.minimo) {
    return `${etiqueta}: ${valor} es menor que ${regla.minimo}`
  }
  if (regla.maximo !== undefined && valor > regla.maximo) {
    return `${etiqueta}: ${valor} es mayor que ${regla.maximo}`
  }
  return null
}

function motivosRegistro(r: RegistroTransformado): string[] {
  const motivos: string[] = []
  if (typeof r.ciudad !== "string" || r.ciudad.trim() === "") {
    motivos.push("Sin ciudad")
  }
  if (r.fecha_hora === null) {
    motivos.push(
      `Fecha y hora no válida (${JSON.stringify(r.fecha_hora_original) ?? "ausente"})`
    )
  }
  for (const campo of Object.keys(ETIQUETAS) as (keyof typeof ETIQUETAS)[]) {
    const motivo = motivoMedicion(campo, r[campo])
    if (motivo) motivos.push(motivo)
  }
  return motivos
}

/**
 * Valida cada fila y elimina duplicados por (ciudad, fecha_hora).
 * Criterio de duplicados: se conserva la PRIMERA aparición válida, en el
 * orden de extracción (ciudad y posición en el array); las siguientes se
 * rechazan indicando qué fila se conservó.
 */
export function limpiarRegistros(
  registros: RegistroTransformado[]
): ResultadoLimpieza {
  const validos: RegistroValido[] = []
  const rechazados: RegistroRechazado[] = []
  const vistos = new Map<string, RegistroTransformado>()

  for (const r of registros) {
    const motivos = motivosRegistro(r)
    if (motivos.length > 0) {
      rechazados.push({ registro: r, motivos: [...motivos, ...r.avisos] })
      continue
    }
    const valido: RegistroValido = {
      ciudad: r.ciudad,
      fecha_hora: r.fecha_hora as string,
      temperatura_c: r.temperatura_c as number,
      humedad_pct: r.humedad_pct as number,
      precipitacion_mm: r.precipitacion_mm as number,
    }
    const clave = claveRegistro(valido)
    const previo = vistos.get(clave)
    if (previo) {
      rechazados.push({
        registro: r,
        motivos: [
          `Duplicado de ciudad y fecha_hora: se conserva la primera aparición (posición ${previo.indice})`,
        ],
      })
      continue
    }
    vistos.set(clave, r)
    validos.push(valido)
  }

  return { validos, rechazados }
}

const FORMATO_ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/**
 * Validación independiente que aplica el servidor a cada registro recibido.
 * No confía en que el navegador haya limpiado los datos.
 */
export function validarRegistroCarga(
  entrada: unknown
): { ok: true; registro: RegistroValido } | { ok: false; error: string } {
  if (typeof entrada !== "object" || entrada === null) {
    return { ok: false, error: "no es un objeto" }
  }
  const o = entrada as Record<string, unknown>
  const permitidas = new Set([
    "ciudad",
    "fecha_hora",
    "temperatura_c",
    "humedad_pct",
    "precipitacion_mm",
  ])
  const extra = Object.keys(o).filter((k) => !permitidas.has(k))
  if (extra.length)
    return { ok: false, error: `campos no permitidos: ${extra.join(", ")}` }
  if (typeof o.ciudad !== "string" || !NOMBRES_CIUDADES.includes(o.ciudad)) {
    return { ok: false, error: "ciudad desconocida" }
  }
  if (
    typeof o.fecha_hora !== "string" ||
    !FORMATO_ISO_UTC.test(o.fecha_hora) ||
    new Date(o.fecha_hora).toISOString() !== o.fecha_hora
  ) {
    return { ok: false, error: "fecha_hora no es un ISO 8601 UTC válido" }
  }
  for (const campo of Object.keys(ETIQUETAS) as (keyof typeof ETIQUETAS)[]) {
    const motivo = motivoMedicion(campo, o[campo])
    if (motivo) return { ok: false, error: motivo }
  }
  return {
    ok: true,
    registro: {
      ciudad: o.ciudad,
      fecha_hora: o.fecha_hora,
      temperatura_c: o.temperatura_c as number,
      humedad_pct: o.humedad_pct as number,
      precipitacion_mm: o.precipitacion_mm as number,
    },
  }
}
