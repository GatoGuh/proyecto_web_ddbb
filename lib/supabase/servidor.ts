import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export { TAMANO_LOTE } from "@/lib/etl/carga"

export const TABLA = "mediciones_meteorologicas"

// La clave secreta (sb_secret_…) omite RLS: solo puede usarse en el servidor.
// Se acepta también el nombre que ya existía en .env.local de este proyecto.
function leerConfiguracion() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const clave =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.NEXT_SECRET_SUPABASE_SERVICE_KEY
  return { url, clave }
}

export function supabaseConfigurado() {
  const { url, clave } = leerConfiguracion()
  return Boolean(url && clave)
}

let cliente: SupabaseClient | null = null

export function clienteSupabase(): SupabaseClient {
  const { url, clave } = leerConfiguracion()
  if (!url || !clave) {
    throw new ErrorConfiguracion(
      "Faltan SUPABASE_URL y/o SUPABASE_SECRET_KEY en el entorno del servidor."
    )
  }
  cliente ??= createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cliente
}

export class ErrorConfiguracion extends Error {}

/**
 * El proyecto no tiene autenticación. Los endpoints que usan la clave secreta
 * quedan habilitados en desarrollo local y bloqueados en producción salvo que
 * se active explícitamente ETL_PERMITIR_EN_PRODUCCION=true (después de añadir
 * autenticación).
 */
export function accesoPermitido(): Response | null {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ETL_PERMITIR_EN_PRODUCCION !== "true"
  ) {
    return Response.json(
      {
        error:
          "Endpoint deshabilitado en producción: añade autenticación antes de publicar la aplicación.",
      },
      { status: 403 }
    )
  }
  return null
}

/** Mensaje de error de Supabase sin datos sensibles. */
export function describirError(error: {
  message?: string
  code?: string
  hint?: string | null
}) {
  const partes = [error.message ?? "Error desconocido"]
  if (error.code) partes.push(`(código ${error.code})`)
  if (error.code === "PGRST205") {
    partes.push(
      "— la tabla no existe: aplica la migración de supabase/migrations."
    )
  }
  if (error.code === "42501") {
    partes.push("— faltan permisos (GRANT) para service_role en la tabla.")
  }
  return partes.join(" ")
}

/** Lee el cuerpo JSON rechazando peticiones mayores que `maxBytes`. */
export async function leerJsonLimitado(
  request: Request,
  maxBytes: number
): Promise<{ ok: true; datos: unknown } | { ok: false; respuesta: Response }> {
  const declarado = Number(request.headers.get("content-length") ?? "0")
  if (declarado > maxBytes) {
    return {
      ok: false,
      respuesta: Response.json(
        { error: `La petición supera el máximo de ${maxBytes} bytes.` },
        { status: 413 }
      ),
    }
  }
  const texto = await request.text()
  if (new TextEncoder().encode(texto).length > maxBytes) {
    return {
      ok: false,
      respuesta: Response.json(
        { error: `La petición supera el máximo de ${maxBytes} bytes.` },
        { status: 413 }
      ),
    }
  }
  try {
    return { ok: true, datos: JSON.parse(texto) }
  } catch {
    return {
      ok: false,
      respuesta: Response.json({ error: "JSON no válido." }, { status: 400 }),
    }
  }
}
