import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { dividirEnLotes } from "@/lib/etl/filtrar"
import { claveRegistro } from "@/lib/etl/tipos"
import {
  accesoPermitido,
  clienteSupabase,
  describirError,
  ErrorConfiguracion,
  leerJsonLimitado,
  TABLA,
  TAMANO_LOTE,
} from "@/lib/supabase/servidor"

const MAX_BYTES = 128 * 1024
// Limita la longitud de la URL de cada consulta `in (...)`.
const FECHAS_POR_CONSULTA = 100

type Clave = { ciudad: string; fecha_hora: string }

function esClave(v: unknown): v is Clave {
  if (typeof v !== "object" || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.ciudad === "string" &&
    NOMBRES_CIUDADES.includes(o.ciudad) &&
    typeof o.fecha_hora === "string" &&
    !Number.isNaN(Date.parse(o.fecha_hora))
  )
}

/** Comprueba qué claves (ciudad, fecha_hora) existen realmente en la tabla. */
export async function POST(request: Request) {
  const bloqueo = accesoPermitido()
  if (bloqueo) return bloqueo

  const cuerpo = await leerJsonLimitado(request, MAX_BYTES)
  if (!cuerpo.ok) return cuerpo.respuesta
  const { claves } = cuerpo.datos as { claves?: unknown }
  if (
    !Array.isArray(claves) ||
    claves.length === 0 ||
    claves.length > TAMANO_LOTE ||
    !claves.every(esClave)
  ) {
    return Response.json(
      { error: `Se esperan entre 1 y ${TAMANO_LOTE} claves válidas.` },
      { status: 400 }
    )
  }

  const porCiudad = new Map<string, string[]>()
  for (const c of claves) {
    const lista = porCiudad.get(c.ciudad) ?? []
    lista.push(new Date(c.fecha_hora).toISOString())
    porCiudad.set(c.ciudad, lista)
  }

  try {
    const encontradas = new Set<string>()
    for (const [ciudad, fechas] of porCiudad) {
      for (const grupo of dividirEnLotes(fechas, FECHAS_POR_CONSULTA)) {
        const { data, error } = await clienteSupabase()
          .from(TABLA)
          .select("ciudad, fecha_hora")
          .eq("ciudad", ciudad)
          .in("fecha_hora", grupo)
        if (error) {
          return Response.json(
            { error: describirError(error) },
            { status: 502 }
          )
        }
        for (const fila of data) {
          encontradas.add(
            claveRegistro({
              ciudad: fila.ciudad,
              // Postgres devuelve "…+00:00"; se normaliza a ISO con «Z».
              fecha_hora: new Date(fila.fecha_hora).toISOString(),
            })
          )
        }
      }
    }
    const solicitadas = claves.map((c) =>
      claveRegistro({
        ciudad: c.ciudad,
        fecha_hora: new Date(c.fecha_hora).toISOString(),
      })
    )
    return Response.json({
      comprobadas: solicitadas.length,
      faltan: solicitadas.filter((c) => !encontradas.has(c)),
    })
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
