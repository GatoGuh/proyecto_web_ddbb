import { describe, expect, it } from "vitest"
import { colorCiudad } from "../lib/etl/ciudades"
import { mediaDiariaTemperatura, resumirPorCiudad } from "../lib/etl/resumen"
import type { RegistroValido } from "../lib/etl/tipos"

const r = (
  ciudad: string,
  fecha_hora: string,
  temperatura_c: number,
  precipitacion_mm = 0
): RegistroValido => ({
  ciudad,
  fecha_hora,
  temperatura_c,
  humedad_pct: 50,
  precipitacion_mm,
})

describe("Resúmenes para el mapa y los gráficos", () => {
  const datos = [
    r("Madrid", "2026-09-01T00:00:00.000Z", 10, 0.1),
    r("Madrid", "2026-09-01T12:00:00.000Z", 20, 0.2),
    r("Madrid", "2026-09-02T00:00:00.000Z", 30),
    r("Bilbao", "2026-09-01T00:00:00.000Z", 15, 1),
  ]

  it("calcula media, extremos y lluvia por ciudad sin errores de coma flotante", () => {
    const m = resumirPorCiudad(datos).get("Madrid")!
    expect(m.registros).toBe(3)
    expect(m.tempMedia).toBe(20)
    expect([m.tempMin, m.tempMax]).toEqual([10, 30])
    expect(m.lluviaTotal).toBe(0.3)
    expect(m.horasConLluvia).toBe(2)
  })

  it("agrupa la temperatura media por día UTC y ciudad, ordenada por fecha", () => {
    expect(mediaDiariaTemperatura(datos)).toEqual([
      { fecha: "2026-09-01", Madrid: 15, Bilbao: 15 },
      { fecha: "2026-09-02", Madrid: 30 },
    ])
  })

  it("el color sigue a la ciudad, no a su posición", () => {
    expect(colorCiudad("Barcelona")).toBe("var(--serie-1)")
    expect(colorCiudad("Valencia")).toBe("var(--serie-5)")
  })
})
