// Pruebas de integración con servicios reales: Open-Meteo y los endpoints de
// la aplicación (que a su vez usan Supabase). Requieren `npm run dev` en
// marcha y se ejecutan con:  ETL_URL_BASE=http://localhost:3000 npm run test:integracion
import { beforeAll, describe, expect, it } from "vitest"
import {
  crearLotes,
  procesarLotes,
  verificarEnDestino,
  type Comprobar,
  type Enviar,
} from "../lib/etl/carga"
import { FILTROS_INICIALES, prepararConjunto } from "../lib/etl/filtrar"
import { extraerCiudad } from "../lib/etl/extraer"
import { limpiarRegistros } from "../lib/etl/limpiar"
import { claveRegistro, type RegistroValido } from "../lib/etl/tipos"
import { transformarRespuestas } from "../lib/etl/transformar"
import { NOMBRES_CIUDADES } from "../lib/etl/ciudades"

const BASE = process.env.ETL_URL_BASE ?? ""

const post = (ruta: string, cuerpo: unknown) =>
  fetch(`${BASE}${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  })

const enviar: Enviar = async (registros, { simularFallo }) => {
  const r = await post("/api/supabase/cargar", { registros, simularFallo })
  const c = await r.json()
  return r.ok
    ? { ok: true, filasAfectadas: c.filasAfectadas }
    : { ok: false, error: c.error }
}
const comprobar: Comprobar = async (claves) => {
  const r = await post("/api/supabase/verificar", { claves })
  const c = await r.json()
  return r.ok ? { ok: true, faltan: c.faltan } : { ok: false, error: c.error }
}
async function totalEnDestino(ciudad: string, desde: string, hasta: string) {
  const r = await fetch(
    `${BASE}/api/supabase/registros?ciudad=${ciudad}&desde=${desde}&hasta=${hasta}&tamano=1`
  )
  return (await r.json()).total as number
}

describe.runIf(BASE)("Integración real", () => {
  let septiembre: RegistroValido[] = []
  let tablaDisponible = false

  beforeAll(async () => {
    const estado = await (await fetch(`${BASE}/api/supabase/estado`)).json()
    tablaDisponible = estado.tablaDisponible
    console.log("Estado de Supabase:", estado.mensaje)
  })

  it("1. Barcelona, 1 día: 24 registros horarios en UTC", async () => {
    const r = await extraerCiudad("Barcelona", "2026-09-01", "2026-09-01")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const t = transformarRespuestas([{ ciudad: "Barcelona", json: r.json }])
    const l = limpiarRegistros(t.registros)
    expect(t.registros).toHaveLength(24)
    expect(l.validos).toHaveLength(24)
    expect(l.validos[0].fecha_hora).toBe("2026-09-01T00:00:00.000Z")
    expect(l.validos[23].fecha_hora).toBe("2026-09-01T23:00:00.000Z")
  })

  it("Extracción real de septiembre de 2026 para las 5 ciudades", async () => {
    const respuestas = []
    for (const ciudad of NOMBRES_CIUDADES) {
      const r = await extraerCiudad(ciudad, "2026-09-01", "2026-09-30")
      expect(r.ok, `${ciudad}: ${!r.ok && r.error}`).toBe(true)
      if (r.ok) respuestas.push({ ciudad, json: r.json })
    }
    const t = transformarRespuestas(respuestas)
    const l = limpiarRegistros(t.registros)
    console.log(
      `Septiembre real: ${t.registros.length} extraídos, ${l.validos.length} válidos, ${l.rechazados.length} rechazados`
    )
    expect(t.registros).toHaveLength(5 * 30 * 24)
    expect(t.erroresEstructurales).toHaveLength(0)
    septiembre = l.validos
  }, 60_000)

  it("Rango reciente: los nulos reales se rechazan, no se convierten en 0", async () => {
    const r = await extraerCiudad("Madrid", "2026-10-20", "2026-10-26")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const t = transformarRespuestas([{ ciudad: "Madrid", json: r.json }])
    const l = limpiarRegistros(t.registros)
    const nulos = t.registros.filter(
      (x) =>
        x.temperatura_c === null ||
        x.humedad_pct === null ||
        x.precipitacion_mm === null
    )
    console.log(
      `Madrid 20–26 oct: ${nulos.length} filas con algún null de ${t.registros.length}`
    )
    expect(l.rechazados.length).toBe(nulos.length)
    const clavesNulas = new Set(nulos.map((x) => `${x.ciudad}|${x.fecha_hora}`))
    expect(l.validos.some((v) => clavesNulas.has(claveRegistro(v)))).toBe(false)
  })

  describe("Validación del servidor (no escribe en la base de datos)", () => {
    const valido = {
      ciudad: "Madrid",
      fecha_hora: "2026-09-01T00:00:00.000Z",
      temperatura_c: 20,
      humedad_pct: 50,
      precipitacion_mm: 0,
    }
    it("rechaza registros no válidos (422)", async () => {
      const r = await post("/api/supabase/cargar", {
        registros: [{ ...valido, humedad_pct: null }],
      })
      expect(r.status).toBe(422)
    })
    it("rechaza duplicados dentro de un lote (422)", async () => {
      const r = await post("/api/supabase/cargar", {
        registros: [valido, valido],
      })
      expect(r.status).toBe(422)
    })
    it("rechaza lotes de más de 500 (400)", async () => {
      const registros = Array.from({ length: 501 }, (_, i) => ({
        ...valido,
        fecha_hora: new Date(
          Date.UTC(2026, 8, 1) + i * 3_600_000
        ).toISOString(),
      }))
      const r = await post("/api/supabase/cargar", { registros })
      expect(r.status).toBe(400)
    })
    it("rechaza peticiones demasiado grandes (413)", async () => {
      const r = await post("/api/supabase/cargar", "x".repeat(300 * 1024))
      expect(r.status).toBe(413)
    })
    it("el fallo simulado devuelve 503 sin tocar la base de datos", async () => {
      const r = await post("/api/supabase/cargar", {
        registros: [valido],
        simularFallo: true,
      })
      expect(r.status).toBe(503)
    })
  })

  describe("Carga en Supabase", () => {
    it("7-9. carga, segunda carga sin duplicados y fallo parcial", async (ctx) => {
      if (!tablaDisponible) {
        console.log(
          "OMITIDA: la tabla no existe en Supabase; aplica la migración."
        )
        ctx.skip()
      }
      // Conjunto: Barcelona y Madrid, ordenado por temperatura descendente.
      const { coinciden } = prepararConjunto(
        septiembre,
        { ...FILTROS_INICIALES, ciudades: ["Barcelona", "Madrid"] },
        { campo: "temperatura_c", direccion: "desc" },
        new Set()
      )
      const seleccion = new Set(coinciden.map(claveRegistro))
      const { aCargar } = prepararConjunto(
        septiembre,
        { ...FILTROS_INICIALES, ciudades: ["Barcelona", "Madrid"] },
        { campo: "temperatura_c", direccion: "desc" },
        seleccion
      )
      expect(aCargar).toHaveLength(1440)

      // Primera carga con fallo simulado en el lote 2.
      const enviados: RegistroValido[] = []
      const espia: Enviar = async (r, o) => {
        if (!o.simularFallo) enviados.push(...r)
        return enviar(r, o)
      }
      let lotes = crearLotes(aCargar)
      lotes = await procesarLotes(
        lotes,
        lotes.map((l) => l.numero),
        espia,
        () => {},
        2
      )
      expect(lotes.map((l) => l.estado)).toEqual([
        "completado",
        "error",
        "completado",
      ])
      lotes = await procesarLotes(lotes, [2], espia, () => {})
      expect(lotes.every((l) => l.estado === "completado")).toBe(true)

      // Lo enviado son exactamente las filas de la vista previa (lote 2 tras el reintento).
      const porClave = (a: RegistroValido[]) => a.map(claveRegistro).sort()
      expect(porClave(enviados)).toEqual(porClave(aCargar))

      const v = await verificarEnDestino(aCargar, comprobar)
      expect(v.ok && v.faltan).toEqual([])

      const antes = await totalEnDestino(
        "Barcelona",
        "2026-09-01T00:00",
        "2026-09-30T23:00"
      )
      expect(antes).toBe(720)

      // Segunda carga idéntica: upsert, sin duplicados.
      const segunda = await procesarLotes(
        crearLotes(aCargar),
        [1, 2, 3],
        enviar,
        () => {}
      )
      expect(segunda.every((l) => l.estado === "completado")).toBe(true)
      const despues = await totalEnDestino(
        "Barcelona",
        "2026-09-01T00:00",
        "2026-09-30T23:00"
      )
      expect(despues).toBe(720)
    }, 120_000)
  })
})
