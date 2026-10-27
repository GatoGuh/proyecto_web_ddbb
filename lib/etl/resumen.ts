import type { RegistroValido } from "./tipos"

export type ResumenCiudad = {
  ciudad: string
  registros: number
  tempMedia: number
  tempMin: number
  tempMax: number
  humedadMedia: number
  lluviaTotal: number
  horasConLluvia: number
}

/** Estadísticas por ciudad a partir de registros ya validados. */
export function resumirPorCiudad(
  registros: readonly RegistroValido[]
): Map<string, ResumenCiudad> {
  const acumulado = new Map<
    string,
    ResumenCiudad & { sumaTemp: number; sumaHumedad: number }
  >()
  for (const r of registros) {
    const a = acumulado.get(r.ciudad) ?? {
      ciudad: r.ciudad,
      registros: 0,
      tempMedia: 0,
      tempMin: Infinity,
      tempMax: -Infinity,
      humedadMedia: 0,
      lluviaTotal: 0,
      horasConLluvia: 0,
      sumaTemp: 0,
      sumaHumedad: 0,
    }
    a.registros++
    a.sumaTemp += r.temperatura_c
    a.sumaHumedad += r.humedad_pct
    a.tempMin = Math.min(a.tempMin, r.temperatura_c)
    a.tempMax = Math.max(a.tempMax, r.temperatura_c)
    a.lluviaTotal += r.precipitacion_mm
    if (r.precipitacion_mm > 0) a.horasConLluvia++
    acumulado.set(r.ciudad, a)
  }
  const resultado = new Map<string, ResumenCiudad>()
  for (const [ciudad, { sumaTemp, sumaHumedad, ...a }] of acumulado) {
    resultado.set(ciudad, {
      ...a,
      tempMedia: sumaTemp / a.registros,
      humedadMedia: sumaHumedad / a.registros,
      // Evita errores de coma flotante al sumar décimas (0,1 + 0,2…).
      lluviaTotal: Math.round(a.lluviaTotal * 100) / 100,
    })
  }
  return resultado
}

export type PuntoDiario = { fecha: string } & Record<string, number | string>

/**
 * Temperatura media de cada día (UTC) por ciudad, ordenada por fecha.
 * Cada punto: { fecha: "2026-09-01", Barcelona: 24.1, Madrid: 22.7, … }.
 */
export function mediaDiariaTemperatura(
  registros: readonly RegistroValido[]
): PuntoDiario[] {
  const sumas = new Map<string, Map<string, { suma: number; n: number }>>()
  for (const r of registros) {
    const dia = r.fecha_hora.slice(0, 10)
    const porCiudad = sumas.get(dia) ?? new Map()
    const s = porCiudad.get(r.ciudad) ?? { suma: 0, n: 0 }
    s.suma += r.temperatura_c
    s.n++
    porCiudad.set(r.ciudad, s)
    sumas.set(dia, porCiudad)
  }
  return [...sumas.keys()].sort().map((fecha) => {
    const punto: PuntoDiario = { fecha }
    for (const [ciudad, { suma, n }] of sumas.get(fecha)!) {
      punto[ciudad] = Math.round((suma / n) * 10) / 10
    }
    return punto
  })
}
