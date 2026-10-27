import { buscarCiudad } from "./ciudades"
import { construirUrlArchivo } from "./open-meteo"

export type ResultadoExtraccion =
  | { ok: true; url: string; json: unknown; duracionMs: number }
  | { ok: false; url: string; error: string; duracionMs: number }

/** Una petición por ciudad, para poder reintentar cada una por separado. */
export async function extraerCiudad(
  nombre: string,
  inicio: string,
  fin: string,
  fetchFn: typeof fetch = fetch
): Promise<ResultadoExtraccion> {
  const ciudad = buscarCiudad(nombre)
  const t0 = performance.now()
  if (!ciudad) {
    return { ok: false, url: "", error: "Ciudad desconocida.", duracionMs: 0 }
  }
  const url = construirUrlArchivo(ciudad, inicio, fin)
  const fallo = (error: string) =>
    ({ ok: false, url, error, duracionMs: performance.now() - t0 }) as const
  try {
    const respuesta = await fetchFn(url)
    let json: unknown
    try {
      json = await respuesta.json()
    } catch {
      return fallo(`Respuesta no JSON (HTTP ${respuesta.status}).`)
    }
    if (!respuesta.ok) {
      const motivo =
        typeof json === "object" && json !== null && "reason" in json
          ? String((json as { reason: unknown }).reason)
          : ""
      return fallo(`HTTP ${respuesta.status}${motivo ? `: ${motivo}` : ""}`)
    }
    return { ok: true, url, json, duracionMs: performance.now() - t0 }
  } catch (e) {
    return fallo(
      `No se pudo conectar con Open-Meteo${e instanceof Error ? ` (${e.message})` : ""}.`
    )
  }
}
