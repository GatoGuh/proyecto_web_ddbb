import { claveRegistro, type RegistroValido } from "./tipos"

export type Filtros = {
  /** Ciudades incluidas; null significa todas (sin filtro). */
  ciudades: string[] | null
  /** "AAAA-MM-DDTHH:MM" interpretado como UTC; vacío = sin límite. */
  desde: string
  hasta: string
  tempMin: string
  tempMax: string
  humMin: string
  humMax: string
  precMin: string
  precMax: string
  /** Precipitación estrictamente mayor que 0. */
  soloLluvia: boolean
}

export const FILTROS_INICIALES: Filtros = {
  ciudades: null,
  desde: "",
  hasta: "",
  tempMin: "",
  tempMax: "",
  humMin: "",
  humMax: "",
  precMin: "",
  precMax: "",
  soloLluvia: false,
}

export type CampoOrden =
  "ciudad" | "fecha_hora" | "temperatura_c" | "humedad_pct" | "precipitacion_mm"

export type Orden = { campo: CampoOrden; direccion: "asc" | "desc" }

export const ORDEN_INICIAL: Orden = { campo: "fecha_hora", direccion: "asc" }

type Limite = number | undefined

function leerNumero(
  texto: string,
  etiqueta: string,
  errores: string[]
): Limite {
  const t = texto.trim().replace(",", ".")
  if (t === "") return undefined
  const n = Number(t)
  if (!Number.isFinite(n)) {
    errores.push(`${etiqueta} no es un número válido.`)
    return undefined
  }
  return n
}

function leerFechaHora(
  texto: string,
  etiqueta: string,
  errores: string[]
): string | undefined {
  if (texto === "") return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(texto)
  const ms = m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : Number.NaN
  if (!Number.isFinite(ms)) {
    errores.push(`${etiqueta} no es una fecha y hora válida.`)
    return undefined
  }
  return new Date(ms).toISOString()
}

export type FiltrosInterpretados = {
  errores: string[]
  cumple: (r: RegistroValido) => boolean
}

export function interpretarFiltros(f: Filtros): FiltrosInterpretados {
  const errores: string[] = []
  const desde = leerFechaHora(f.desde, "«Desde»", errores)
  const hasta = leerFechaHora(f.hasta, "«Hasta»", errores)
  const tMin = leerNumero(f.tempMin, "Temperatura mínima", errores)
  const tMax = leerNumero(f.tempMax, "Temperatura máxima", errores)
  const hMin = leerNumero(f.humMin, "Humedad mínima", errores)
  const hMax = leerNumero(f.humMax, "Humedad máxima", errores)
  const pMin = leerNumero(f.precMin, "Precipitación mínima", errores)
  const pMax = leerNumero(f.precMax, "Precipitación máxima", errores)

  const rango = (a: Limite | string, b: Limite | string, nombre: string) => {
    if (a !== undefined && b !== undefined && a > b) {
      errores.push(`${nombre}: el mínimo es mayor que el máximo.`)
    }
  }
  rango(desde, hasta, "Intervalo de fechas")
  rango(tMin, tMax, "Temperatura")
  rango(hMin, hMax, "Humedad")
  rango(pMin, pMax, "Precipitación")

  const ciudades = f.ciudades === null ? null : new Set(f.ciudades)
  const dentro = (v: number, min: Limite, max: Limite) =>
    (min === undefined || v >= min) && (max === undefined || v <= max)

  return {
    errores,
    cumple: (r) =>
      (ciudades === null || ciudades.has(r.ciudad)) &&
      (desde === undefined || r.fecha_hora >= desde) &&
      (hasta === undefined || r.fecha_hora <= hasta) &&
      dentro(r.temperatura_c, tMin, tMax) &&
      dentro(r.humedad_pct, hMin, hMax) &&
      dentro(r.precipitacion_mm, pMin, pMax) &&
      (!f.soloLluvia || r.precipitacion_mm > 0),
  }
}

const colador = new Intl.Collator("es")

function comparar(a: RegistroValido, b: RegistroValido, campo: CampoOrden) {
  if (campo === "ciudad") return colador.compare(a.ciudad, b.ciudad)
  if (campo === "fecha_hora") {
    // ISO 8601 en UTC con formato fijo: el orden lexicográfico es cronológico.
    return a.fecha_hora < b.fecha_hora
      ? -1
      : a.fecha_hora > b.fecha_hora
        ? 1
        : 0
  }
  return a[campo] - b[campo]
}

/** Devuelve una copia ordenada. Desempata por ciudad y fecha para ser determinista. */
export function ordenarRegistros(
  registros: RegistroValido[],
  orden: Orden
): RegistroValido[] {
  const signo = orden.direccion === "asc" ? 1 : -1
  return [...registros].sort(
    (a, b) =>
      signo * comparar(a, b, orden.campo) ||
      comparar(a, b, "ciudad") ||
      comparar(a, b, "fecha_hora")
  )
}

/**
 * Orden de operaciones del pipeline:
 * válidos → filtros → ordenación → (paginación solo para mostrar) y selección.
 */
export function prepararConjunto(
  validos: RegistroValido[],
  filtros: Filtros,
  orden: Orden,
  seleccion: ReadonlySet<string>
) {
  const { cumple, errores } = interpretarFiltros(filtros)
  const coinciden = ordenarRegistros(validos.filter(cumple), orden)
  const clavesCoinciden = new Set(coinciden.map(claveRegistro))
  const aCargar = coinciden.filter((r) => seleccion.has(claveRegistro(r)))
  let seleccionFueraDeFiltros = 0
  for (const clave of seleccion) {
    if (!clavesCoinciden.has(clave)) seleccionFueraDeFiltros++
  }
  return { errores, coinciden, aCargar, seleccionFueraDeFiltros }
}

export function dividirEnLotes<T>(elementos: T[], tamano: number): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < elementos.length; i += tamano) {
    lotes.push(elementos.slice(i, i + tamano))
  }
  return lotes
}
