import { dividirEnLotes } from "./filtrar"
import { claveRegistro, type RegistroValido } from "./tipos"

export const TAMANO_LOTE = 500

export type EstadoLote = "pendiente" | "en_curso" | "completado" | "error"

export type Lote = {
  numero: number
  registros: RegistroValido[]
  estado: EstadoLote
  intentos: number
  error?: string
  /** Filas afectadas según Supabase (inserciones + actualizaciones, sin distinguir). */
  filasAfectadas?: number | null
  duracionMs?: number
}

export type RespuestaEnvio =
  { ok: true; filasAfectadas: number | null } | { ok: false; error: string }

export type Enviar = (
  registros: RegistroValido[],
  opciones: { simularFallo: boolean }
) => Promise<RespuestaEnvio>

/** Congela una copia del conjunto y su orden, y la divide en lotes. */
export function crearLotes(
  registros: readonly RegistroValido[],
  tamano = TAMANO_LOTE
): Lote[] {
  const copia = registros.map((r) => ({ ...r }))
  return dividirEnLotes(copia, tamano).map((grupo, i) => ({
    numero: i + 1,
    registros: grupo,
    estado: "pendiente",
    intentos: 0,
  }))
}

/**
 * Envía en secuencia los lotes indicados. Un fallo no detiene los siguientes
 * ni altera los lotes ya completados; quedan marcados para reintentar.
 */
export async function procesarLotes(
  lotes: Lote[],
  numeros: number[],
  enviar: Enviar,
  alActualizar: (lote: Lote) => void,
  simularFalloEn?: number
): Promise<Lote[]> {
  const resultado = lotes.map((l) => ({ ...l }))
  for (const numero of numeros) {
    const i = resultado.findIndex((l) => l.numero === numero)
    if (i === -1) continue
    const enCurso: Lote = {
      ...resultado[i],
      estado: "en_curso",
      error: undefined,
      intentos: resultado[i].intentos + 1,
    }
    resultado[i] = enCurso
    alActualizar(enCurso)
    const t0 = performance.now()
    let respuesta: RespuestaEnvio
    try {
      respuesta = await enviar(enCurso.registros, {
        simularFallo: simularFalloEn === numero,
      })
    } catch (e) {
      respuesta = {
        ok: false,
        error: e instanceof Error ? e.message : "Error de red",
      }
    }
    const final: Lote = respuesta.ok
      ? {
          ...enCurso,
          estado: "completado",
          filasAfectadas: respuesta.filasAfectadas,
          duracionMs: performance.now() - t0,
        }
      : {
          ...enCurso,
          estado: "error",
          error: respuesta.error,
          duracionMs: performance.now() - t0,
        }
    resultado[i] = final
    alActualizar(final)
  }
  return resultado
}

export type Comprobar = (
  claves: { ciudad: string; fecha_hora: string }[]
) => Promise<{ ok: true; faltan: string[] } | { ok: false; error: string }>

/** Consulta por lotes qué claves enviadas existen realmente en destino. */
export async function verificarEnDestino(
  registros: RegistroValido[],
  comprobar: Comprobar,
  tamano = TAMANO_LOTE
): Promise<
  | { ok: true; comprobadas: number; confirmadas: string[]; faltan: string[] }
  | { ok: false; error: string }
> {
  const faltan: string[] = []
  for (const grupo of dividirEnLotes(registros, tamano)) {
    const r = await comprobar(
      grupo.map((x) => ({ ciudad: x.ciudad, fecha_hora: x.fecha_hora }))
    )
    if (!r.ok) return r
    faltan.push(...r.faltan)
  }
  const ausentes = new Set(faltan)
  return {
    ok: true,
    comprobadas: registros.length,
    confirmadas: registros.map(claveRegistro).filter((c) => !ausentes.has(c)),
    faltan,
  }
}

async function leerError(respuesta: Response) {
  try {
    const cuerpo = (await respuesta.json()) as { error?: string }
    return cuerpo.error ?? `HTTP ${respuesta.status}`
  } catch {
    return `HTTP ${respuesta.status}`
  }
}

export const enviarHttp: Enviar = async (registros, { simularFallo }) => {
  const respuesta = await fetch("/api/supabase/cargar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registros, simularFallo }),
  })
  if (!respuesta.ok) return { ok: false, error: await leerError(respuesta) }
  const cuerpo = (await respuesta.json()) as { filasAfectadas: number | null }
  return { ok: true, filasAfectadas: cuerpo.filasAfectadas }
}

export const comprobarHttp: Comprobar = async (claves) => {
  const respuesta = await fetch("/api/supabase/verificar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ claves }),
  })
  if (!respuesta.ok) return { ok: false, error: await leerError(respuesta) }
  const cuerpo = (await respuesta.json()) as { faltan: string[] }
  return { ok: true, faltan: cuerpo.faltan }
}
