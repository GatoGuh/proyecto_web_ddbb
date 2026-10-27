import type { NextRequest } from "next/server"

import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import {
  accesoPermitido,
  clienteSupabase,
  describirError,
  ErrorConfiguracion,
  TABLA,
} from "@/lib/supabase/servidor"

const CAMPOS_ORDEN = new Set([
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
  "importado_en",
])
const MAX_TAMANO_PAGINA = 100

function fechaUtc(valor: string | null): string | null | undefined {
  if (!valor) return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(valor)
  if (!m) return null
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

/** Lectura paginada de lo que realmente está persistido en Supabase. */
export async function GET(request: NextRequest) {
  const bloqueo = accesoPermitido()
  if (bloqueo) return bloqueo

  const p = request.nextUrl.searchParams
  const pagina = Math.max(1, Math.floor(Number(p.get("pagina") ?? "1")) || 1)
  const tamano = Math.min(
    MAX_TAMANO_PAGINA,
    Math.max(1, Math.floor(Number(p.get("tamano") ?? "25")) || 25)
  )
  const ciudad = p.get("ciudad")
  const campo = p.get("orden") ?? "fecha_hora"
  const ascendente = p.get("direccion") !== "desc"
  const desde = fechaUtc(p.get("desde"))
  const hasta = fechaUtc(p.get("hasta"))

  if (ciudad && !NOMBRES_CIUDADES.includes(ciudad)) {
    return Response.json({ error: "Ciudad desconocida." }, { status: 400 })
  }
  if (!CAMPOS_ORDEN.has(campo)) {
    return Response.json(
      { error: "Campo de orden no permitido." },
      { status: 400 }
    )
  }
  if (desde === null || hasta === null) {
    return Response.json({ error: "Fecha no válida." }, { status: 400 })
  }

  try {
    let consulta = clienteSupabase()
      .from(TABLA)
      .select(
        "id, ciudad, fecha_hora, temperatura_c, humedad_pct, precipitacion_mm, importado_en",
        { count: "exact" }
      )
    if (ciudad) consulta = consulta.eq("ciudad", ciudad)
    if (desde) consulta = consulta.gte("fecha_hora", desde)
    if (hasta) consulta = consulta.lte("fecha_hora", hasta)

    // Sin ORDER BY la base de datos no garantiza ningún orden: se fija siempre
    // un orden explícito con desempate por la clave única.
    consulta = consulta.order(campo, { ascending: ascendente })
    if (campo !== "ciudad") consulta = consulta.order("ciudad")
    if (campo !== "fecha_hora") consulta = consulta.order("fecha_hora")

    const inicio = (pagina - 1) * tamano
    const { data, error, count } = await consulta.range(
      inicio,
      inicio + tamano - 1
    )
    if (error) {
      return Response.json({ error: describirError(error) }, { status: 502 })
    }
    return Response.json({ filas: data, total: count ?? 0, pagina, tamano })
  } catch (e) {
    if (e instanceof ErrorConfiguracion) {
      return Response.json({ error: e.message }, { status: 500 })
    }
    return Response.json(
      { error: "No se pudo contactar con Supabase." },
      { status: 502 }
    )
  }
}
