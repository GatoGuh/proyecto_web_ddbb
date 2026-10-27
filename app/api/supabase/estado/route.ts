import {
  accesoPermitido,
  clienteSupabase,
  describirError,
  supabaseConfigurado,
  TABLA,
} from "@/lib/supabase/servidor"

/** Indica si hay credenciales en el servidor y si la tabla es accesible. */
export async function GET() {
  const bloqueo = accesoPermitido()
  if (bloqueo) return bloqueo

  if (!supabaseConfigurado()) {
    return Response.json({
      configurado: false,
      tablaDisponible: false,
      mensaje:
        "Faltan las variables SUPABASE_URL y SUPABASE_SECRET_KEY en el servidor.",
    })
  }
  try {
    // GET y no HEAD: una respuesta HEAD no trae cuerpo y el error
    // (p. ej., tabla inexistente) no llegaría a detectarse.
    const { error } = await clienteSupabase().from(TABLA).select("id").limit(1)
    return Response.json({
      configurado: true,
      tablaDisponible: !error,
      mensaje: error ? describirError(error) : "Conexión correcta.",
    })
  } catch {
    return Response.json({
      configurado: true,
      tablaDisponible: false,
      mensaje: "No se pudo contactar con Supabase.",
    })
  }
}
