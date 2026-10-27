import { describe, expect, it } from "vitest"
import {
  crearLotes,
  procesarLotes,
  verificarEnDestino,
  type Enviar,
} from "../lib/etl/carga"
import {
  FILTROS_INICIALES,
  prepararConjunto,
  type Filtros,
} from "../lib/etl/filtrar"
import { limpiarRegistros, validarRegistroCarga } from "../lib/etl/limpiar"
import {
  construirUrlArchivo,
  validarConfiguracion,
} from "../lib/etl/open-meteo"
import { CIUDADES } from "../lib/etl/ciudades"
import { claveRegistro, type RegistroValido } from "../lib/etl/tipos"
import {
  interpretarHoraUtc,
  transformarRespuesta,
} from "../lib/etl/transformar"
import {
  respuestaConProblemas,
  respuestaLongitudesIncoherentes,
  respuestaUnDia,
} from "./fixtures"

function pipeline(ciudad: string, json: unknown) {
  const t = transformarRespuesta({ ciudad, json })
  return { t, l: limpiarRegistros(t.registros) }
}

/** Genera n registros válidos sintéticos para probar filtros y lotes. */
function sinteticos(n: number): RegistroValido[] {
  return Array.from({ length: n }, (_, i) => ({
    ciudad: CIUDADES[i % 5].nombre,
    fecha_hora: new Date(
      Date.UTC(2026, 8, 1) + Math.floor(i / 5) * 3_600_000
    ).toISOString(),
    temperatura_c: (i * 7) % 35,
    humedad_pct: (i * 13) % 100,
    precipitacion_mm: i % 4 === 0 ? (i % 9) / 10 : 0,
  }))
}

describe("1-2. Extracción de un día y transformación de arrays", () => {
  it("la URL pide UTC, °C, mm y las tres variables", () => {
    const url = new URL(
      construirUrlArchivo(CIUDADES[0], "2026-09-01", "2026-09-01")
    )
    expect(url.searchParams.get("timezone")).toBe("GMT")
    expect(url.searchParams.get("temperature_unit")).toBe("celsius")
    expect(url.searchParams.get("precipitation_unit")).toBe("mm")
    expect(url.searchParams.get("hourly")).toBe(
      "temperature_2m,relative_humidity_2m,precipitation"
    )
  })

  it("una ciudad y un día producen 24 registros horarios en UTC", () => {
    const { t, l } = pipeline("Barcelona", respuestaUnDia)
    expect(t.registros).toHaveLength(24)
    expect(l.validos).toHaveLength(24)
    expect(l.validos[0].fecha_hora).toBe("2026-09-01T00:00:00.000Z")
    expect(l.validos[23].fecha_hora).toBe("2026-09-01T23:00:00.000Z")
    // La posición i de cada array va a la misma fila.
    expect(l.validos[13]).toEqual({
      ciudad: "Barcelona",
      fecha_hora: "2026-09-01T13:00:00.000Z",
      temperatura_c: 29.0,
      humedad_pct: 58,
      precipitacion_mm: 0,
    })
  })

  it("la hora se interpreta como UTC con independencia de la zona del equipo", () => {
    expect(interpretarHoraUtc("2026-03-29T02:00")).toBe(
      "2026-03-29T02:00:00.000Z"
    )
    expect(interpretarHoraUtc("2026-02-30T00:00")).toBeNull()
    expect(interpretarHoraUtc(null)).toBeNull()
  })

  it("rechaza respuestas que no están en UTC o con error de la API", () => {
    expect(
      transformarRespuesta({
        ciudad: "Madrid",
        json: { ...respuestaUnDia, utc_offset_seconds: 7200 },
      }).erroresEstructurales
    ).toHaveLength(1)
    expect(
      transformarRespuesta({
        ciudad: "Madrid",
        json: { error: true, reason: "x" },
      }).erroresEstructurales[0].mensaje
    ).toContain("x")
  })
})

describe("3-4. Nulos, rangos y duplicados (fixture controlado)", () => {
  const { l } = pipeline("Sevilla", respuestaConProblemas)
  const motivosDe = (indice: number) =>
    l.rechazados.find((r) => r.registro.indice === indice)?.motivos.join(" | ")

  it("null y cadena vacía se rechazan, nunca se convierten en 0", () => {
    expect(motivosDe(1)).toContain("Temperatura: valor nulo")
    expect(motivosDe(2)).toContain("Humedad: cadena vacía")
    expect(
      l.validos.some((r) => r.fecha_hora === "2026-09-02T01:00:00.000Z")
    ).toBe(false)
  })

  it("valida rangos y tipos sin descartar temperaturas extremas", () => {
    expect(motivosDe(4)).toContain("Humedad: 101 es mayor que 100")
    expect(motivosDe(5)).toContain("Precipitación: -0.1 es menor que 0")
    expect(motivosDe(7)).toContain("Fecha y hora no válida")
    expect(motivosDe(8)).toContain("tipo no numérico")
    expect(l.validos.find((r) => r.temperatura_c === 55.3)).toBeDefined()
  })

  it("elimina duplicados conservando la primera aparición", () => {
    expect(motivosDe(9)).toContain("Duplicado")
    expect(motivosDe(9)).toContain("posición 0")
    const fila0 = l.validos.filter(
      (r) => r.fecha_hora === "2026-09-02T00:00:00.000Z"
    )
    expect(fila0).toHaveLength(1)
    expect(fila0[0].temperatura_c).toBe(20)
    // Solo sobreviven las posiciones 0, 3 y 6.
    expect(l.validos.map((r) => r.fecha_hora.slice(11, 13))).toEqual([
      "00",
      "03",
      "06",
    ])
  })

  it("cada fila acaba en válidos o en rechazados, sin pérdidas", () => {
    expect(l.validos.length + l.rechazados.length).toBe(10)
  })

  it("detecta arrays de longitud incoherente", () => {
    const { t, l: l2 } = pipeline("Bilbao", respuestaLongitudesIncoherentes)
    expect(t.avisos[0].mensaje).toContain("Longitudes incoherentes")
    expect(l2.validos).toHaveLength(2)
    expect(l2.rechazados[0].motivos.join()).toContain("Humedad: valor ausente")
  })
})

describe("5-6. Filtros, ordenación y selección entre páginas", () => {
  const validos = sinteticos(300)
  const filtros: Filtros = {
    ...FILTROS_INICIALES,
    ciudades: ["Madrid", "Bilbao"],
    tempMin: "10",
  }

  it("filtra y ordena el conjunto completo antes de paginar", () => {
    const { coinciden } = prepararConjunto(
      validos,
      filtros,
      { campo: "temperatura_c", direccion: "desc" },
      new Set()
    )
    expect(
      coinciden.every((r) => ["Madrid", "Bilbao"].includes(r.ciudad))
    ).toBe(true)
    expect(coinciden.every((r) => r.temperatura_c >= 10)).toBe(true)
    // La primera "página" contiene el máximo GLOBAL, no el de una página previa.
    const maximo = Math.max(...coinciden.map((r) => r.temperatura_c))
    expect(coinciden.slice(0, 25)[0].temperatura_c).toBe(maximo)
    for (let i = 1; i < coinciden.length; i++) {
      expect(coinciden[i - 1].temperatura_c).toBeGreaterThanOrEqual(
        coinciden[i].temperatura_c
      )
    }
  })

  it("«solo con lluvia» exige precipitación > 0", () => {
    const { coinciden } = prepararConjunto(
      validos,
      { ...FILTROS_INICIALES, soloLluvia: true },
      { campo: "fecha_hora", direccion: "asc" },
      new Set()
    )
    expect(coinciden.length).toBeGreaterThan(0)
    expect(coinciden.every((r) => r.precipitacion_mm > 0)).toBe(true)
  })

  it("ninguna ciudad marcada no equivale a todas", () => {
    const { coinciden } = prepararConjunto(
      validos,
      { ...FILTROS_INICIALES, ciudades: [] },
      { campo: "fecha_hora", direccion: "asc" },
      new Set()
    )
    expect(coinciden).toHaveLength(0)
  })

  it("seleccionar todas las que cumplen incluye filas de otras páginas", () => {
    const orden = { campo: "fecha_hora", direccion: "asc" } as const
    const { coinciden } = prepararConjunto(validos, filtros, orden, new Set())
    const seleccion = new Set(coinciden.map(claveRegistro))
    const { aCargar } = prepararConjunto(validos, filtros, orden, seleccion)
    expect(coinciden.length).toBeGreaterThan(25)
    expect(aCargar).toEqual(coinciden)
  })

  it("cambiar filtros no auto-selecciona y cuenta las seleccionadas fuera de filtros", () => {
    const orden = { campo: "fecha_hora", direccion: "asc" } as const
    const { coinciden } = prepararConjunto(validos, filtros, orden, new Set())
    const seleccion = new Set(coinciden.map(claveRegistro))
    // Se restringe más: solo Madrid.
    const r = prepararConjunto(
      validos,
      { ...filtros, ciudades: ["Madrid"] },
      orden,
      seleccion
    )
    expect(r.aCargar.every((x) => x.ciudad === "Madrid")).toBe(true)
    expect(r.seleccionFueraDeFiltros).toBe(coinciden.length - r.aCargar.length)
    // Se relaja: aparecen filas nuevas que NO quedan seleccionadas.
    const r2 = prepararConjunto(validos, FILTROS_INICIALES, orden, seleccion)
    expect(r2.coinciden.length).toBe(300)
    expect(r2.aCargar.length).toBe(coinciden.length)
  })

  it("informa de filtros no válidos", () => {
    const r = prepararConjunto(
      validos,
      { ...FILTROS_INICIALES, humMin: "abc", tempMin: "30", tempMax: "10" },
      { campo: "fecha_hora", direccion: "asc" },
      new Set()
    )
    expect(r.errores).toHaveLength(2)
  })
})

describe("7-9. Lotes, coincidencia con la vista previa y fallo parcial", () => {
  const aCargar = sinteticos(1234)

  it("lo enviado coincide exactamente con la vista previa, en orden", async () => {
    const enviados: RegistroValido[] = []
    const enviar: Enviar = async (registros) => {
      enviados.push(...registros)
      return { ok: true, filasAfectadas: registros.length }
    }
    const lotes = crearLotes(aCargar)
    expect(lotes.map((l) => l.registros.length)).toEqual([500, 500, 234])
    await procesarLotes(lotes, [1, 2, 3], enviar, () => {})
    expect(enviados).toEqual(aCargar)
  })

  it("la copia congelada no cambia si cambia el conjunto original", () => {
    const original = sinteticos(10)
    const lotes = crearLotes(original)
    original.reverse()
    original[0].temperatura_c = -999
    expect(lotes[0].registros[0]).toEqual(sinteticos(10)[0])
  })

  it("un lote fallido conserva los anteriores y solo él se reintenta", async () => {
    const llamadas: number[] = []
    const enviar: Enviar = async (registros, { simularFallo }) => {
      llamadas.push(registros.length)
      return simularFallo
        ? { ok: false, error: "Fallo simulado" }
        : { ok: true, filasAfectadas: registros.length }
    }
    let lotes = crearLotes(aCargar)
    lotes = await procesarLotes(lotes, [1, 2, 3], enviar, () => {}, 2)
    expect(lotes.map((l) => l.estado)).toEqual([
      "completado",
      "error",
      "completado",
    ])
    expect(lotes[1].error).toBe("Fallo simulado")

    const fallidos = lotes
      .filter((l) => l.estado === "error")
      .map((l) => l.numero)
    lotes = await procesarLotes(lotes, fallidos, enviar, () => {})
    expect(lotes.map((l) => l.estado)).toEqual([
      "completado",
      "completado",
      "completado",
    ])
    expect(lotes[1].intentos).toBe(2)
    expect(lotes[0].intentos).toBe(1)
    expect(llamadas).toEqual([500, 500, 234, 500])
  })

  it("la verificación consulta por lotes e informa de las claves ausentes", async () => {
    const tamanos: number[] = []
    const ausente = claveRegistro(aCargar[700])
    const v = await verificarEnDestino(aCargar, async (claves) => {
      tamanos.push(claves.length)
      return {
        ok: true,
        faltan: claves.map(claveRegistro).filter((c) => c === ausente),
      }
    })
    expect(tamanos).toEqual([500, 500, 234])
    expect(v.ok && v.faltan).toEqual([ausente])
    expect(v.ok && v.confirmadas.length).toBe(1233)
  })
})

describe("Validación en servidor y configuración", () => {
  const valido = {
    ciudad: "Madrid",
    fecha_hora: "2026-09-01T00:00:00.000Z",
    temperatura_c: 20,
    humedad_pct: 50,
    precipitacion_mm: 0,
  }

  it("acepta registros correctos y rechaza los manipulados", () => {
    expect(validarRegistroCarga(valido).ok).toBe(true)
    expect(validarRegistroCarga({ ...valido, temperatura_c: null }).ok).toBe(
      false
    )
    expect(validarRegistroCarga({ ...valido, humedad_pct: 120 }).ok).toBe(false)
    expect(validarRegistroCarga({ ...valido, ciudad: "Lisboa" }).ok).toBe(false)
    expect(
      validarRegistroCarga({ ...valido, fecha_hora: "2026-09-01 00:00" }).ok
    ).toBe(false)
    expect(validarRegistroCarga({ ...valido, id: 3 }).ok).toBe(false)
  })

  it("limita la extracción a 31 días y exige ciudades y fechas válidas", () => {
    const hoy = new Date("2026-10-26T12:00:00Z")
    expect(
      validarConfiguracion(["Madrid"], "2026-09-01", "2026-09-30", hoy)
    ).toEqual([])
    expect(
      validarConfiguracion(["Madrid"], "2026-08-01", "2026-09-01", hoy)[0]
    ).toContain("32 días")
    expect(
      validarConfiguracion([], "2026-09-01", "2026-09-01", hoy)
    ).toHaveLength(1)
    expect(
      validarConfiguracion(["Madrid"], "2026-09-02", "2026-09-01", hoy)
    ).toHaveLength(1)
    expect(
      validarConfiguracion(["Madrid"], "2026-10-27", "2026-10-27", hoy)
    ).toHaveLength(1)
  })
})
