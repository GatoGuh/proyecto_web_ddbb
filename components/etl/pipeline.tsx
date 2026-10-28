"use client"

import { ChevronRightIcon, DatabaseIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { EstadoEtiqueta, type EstadoFase } from "./comun"

export type Paso = {
  /** id de la sección a la que lleva el paso. */
  id: string
  titulo: string
  estado: EstadoFase
  /** Dato breve junto al título, p. ej. «3600 registros». */
  detalle?: string
}

export type Destino = {
  estado: EstadoFase
  texto: string
  detalle?: string
}

const COLOR_PASO: Record<EstadoFase, string> = {
  pendiente: "solido text-muted-foreground",
  en_curso: "solido-azul",
  completada: "solido-verde",
  error: "solido-rojo",
}

const TEXTO_ESTADO: Record<EstadoFase, string> = {
  pendiente: "pendiente",
  en_curso: "en curso",
  completada: "completado",
  error: "con errores",
}

/**
 * Cabecera: título, estado de Supabase y los tres pasos de la página
 * (descarga, visualización y subida). Cada paso lleva a su sección.
 */
export function Cabecera({
  pasos,
  destino,
}: {
  pasos: Paso[]
  destino: Destino
}) {
  const ir = (id: string) =>
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" })

  return (
    <header className="border-b fondo-cabecera">
      <div className="mx-auto grid max-w-7xl gap-5 px-4 pt-6 pb-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Pipeline ETL de datos meteorológicos
          </h1>
          <span
            className="flex items-center gap-2 text-sm text-muted-foreground"
            title={destino.detalle}
          >
            <DatabaseIcon aria-hidden className="size-4" />
            <EstadoEtiqueta estado={destino.estado} texto={destino.texto} />
          </span>
        </div>
        {destino.detalle && destino.estado === "error" && (
          <p className="-mt-2 text-sm text-muted-foreground">
            {destino.detalle}
          </p>
        )}

        <nav aria-label="Pasos">
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
            {pasos.map((p, i) => (
              <li key={p.id} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRightIcon
                    aria-hidden
                    className="size-4 text-zinc-600"
                  />
                )}
                <button
                  type="button"
                  onClick={() => ir(p.id)}
                  aria-label={`Paso ${i + 1}: ${p.titulo}, ${TEXTO_ESTADO[p.estado]}${
                    p.detalle ? `, ${p.detalle}` : ""
                  }`}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-[filter] hover:brightness-125 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
                    COLOR_PASO[p.estado]
                  )}
                >
                  <span className="tabular-nums opacity-80">{i + 1}</span>
                  {p.titulo}
                  {p.detalle && (
                    <span className="font-normal tabular-nums opacity-90">
                      · {p.detalle}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </header>
  )
}
