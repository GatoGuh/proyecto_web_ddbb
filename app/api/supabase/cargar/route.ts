import { validarRegistroCarga } from "@/lib/etl/limpiar"
import { claveRegistro, type RegistroValido } from "@/lib/etl/tipos"
import {
  accesoPermitido,
  clienteSupabase,
  describirError,
  ErrorConfiguracion,
  leerJsonLimitado,
  TABLA,
  TAMANO_LOTE,
} from "@/lib/supabase/servidor"

// ~130 bytes por registro × 500 registros, con margen.
const MAX_BYTES = 256 * 1024

export async function POST(request: Request) {
  const bloqueo = accesoPermitido()
  if (bloqueo) return bloqueo

  const cuerpo = await leerJsonLimitado(request, MAX_BYTES)
  if (!cuerpo.ok) return cuerpo.respuesta
  const datos = cuerpo.datos as { registros?: unknown; simularFallo?: unknown }

  // Fallo provocado para practicar la recuperación de lotes. Solo en desarrollo
  // y solo si la interfaz lo solicita expresamente; no toca la base de datos.
  if (datos.simularFallo === true && process.env.NODE_ENV === "development") {
    return Response.json(
      { error: "Fallo simulado a petición del usuario (modo práctica)." },
      { status: 503 }
    )
  }

  if (!Array.isArray(datos.registros)) {
    return Response.json(
      { error: "Falta el array «registros»." },
      { status: 400 }
    )
  }
  if (datos.registros.length === 0 || datos.registros.length > TAMANO_LOTE) {
    return Response.json(
      { error: `Cada lote debe tener entre 1 y ${TAMANO_LOTE} registros.` },
      { status: 400 }
    )
  }

  const registros: RegistroValido[] = []
  const claves = new Set<string>()
  for (const [i, entrada] of datos.registros.entries()) {
    const resultado = validarRegistroCarga(entrada)
    if (!resultado.ok) {
      return Response.json(
        { error: `Registro ${i + 1} no válido: ${resultado.error}.` },
        { status: 422 }
      )
    }
    const clave = claveRegistro(resultado.registro)
    // Postgres no admite que un mismo upsert afecte dos veces a la misma fila.
    if (claves.has(clave)) {
      return Response.json(
        { error: `Registro ${i + 1} duplicado dentro del lote (${clave}).` },
        { status: 422 }
      )
    }
    claves.add(clave)
    registros.push(resultado.registro)
  }

  try {
    const { error, count, status } = await clienteSupabase()
      .from(TABLA)
      .upsert(registros, { onConflict: "ciudad,fecha_hora", count: "exact" })
    if (error) {
      return Response.json({ error: describirError(error) }, { status: 502 })
    }
    // Supabase confirma el número de filas afectadas, pero no distingue cuántas
    // fueron inserciones y cuántas actualizaciones.
    return Response.json({
      enviados: registros.length,
      filasAfectadas: count,
      estadoHttp: status,
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
