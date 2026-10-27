"use client"

import * as React from "react"
import { ChevronRightIcon, DatabaseIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  EstadoEtiqueta,
  formatoDuracion,
  formatoEntero,
  type EstadoFase,
} from "./comun"

export type Fase = {
  id: string
  titulo: string
  explicacion: string
  estado: EstadoFase
  entrada: { valor: number | null; etiqueta: string }
  salida: { valor: number | null; etiqueta: string }
  duracionMs?: number
  nota?: React.ReactNode
  pestana: string
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

/**
 * Cabecera mínima: título, estado de Supabase y una barra con las cinco fases.
 * Los recuentos, la explicación y la duración de cada fase aparecen en un
 * tooltip (ratón o teclado); al pulsar una fase se abren sus datos.
 */
export function Cabecera({
  fases,
  destino,
  onInspeccionar,
}: {
  fases: Fase[]
  destino: Destino
  onInspeccionar: (pestana: string) => void
}) {
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

        <nav aria-label="Fases del pipeline">
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
            {fases.map((f, i) => (
              <li key={f.id} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRightIcon
                    aria-hidden
                    className="size-4 text-zinc-600"
                  />
                )}
                <Paso
                  fase={f}
                  numero={i + 1}
                  alinearDerecha={i >= fases.length - 2}
                  onPulsar={() => onInspeccionar(f.pestana)}
                />
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </header>
  )
}

function Paso({
  fase: f,
  numero,
  alinearDerecha,
  onPulsar,
}: {
  fase: Fase
  numero: number
  alinearDerecha: boolean
  onPulsar: () => void
}) {
  const id = React.useId()
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onPulsar}
        aria-describedby={id}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-sm font-medium transition-[filter] hover:brightness-125 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none",
          COLOR_PASO[f.estado]
        )}
      >
        <span className="text-sm tabular-nums opacity-80">{numero}</span>
        {f.titulo}
        {f.salida.valor !== null && (
          <span className="tabular-nums opacity-90">
            · {formatoEntero(f.salida.valor)}
          </span>
        )}
      </button>
      <div
        id={id}
        role="tooltip"
        className={cn(
          // Oculto con display:none para que no ensanche la página en móvil;
          // allí ocupa el ancho de la pantalla, justo debajo de la fase.
          "pointer-events-none fixed inset-x-4 z-50 mt-2 hidden rounded-md border bg-popover p-3 text-sm leading-relaxed text-popover-foreground shadow-xl group-focus-within:block group-hover:block sm:absolute sm:inset-x-auto sm:top-full sm:w-72",
          alinearDerecha ? "sm:right-0" : "sm:left-0"
        )}
      >
        <span className="mb-1 flex items-center justify-between gap-2">
          <strong className="text-sm">{f.titulo}</strong>
          <EstadoEtiqueta estado={f.estado} />
        </span>
        <span className="block text-muted-foreground">{f.explicacion}</span>
        <span className="mt-2 grid grid-cols-2 gap-2 tabular-nums">
          <Cifra titulo="Entrada" dato={f.entrada} />
          <Cifra titulo="Salida" dato={f.salida} />
        </span>
        {f.nota && <span className="mt-2 block">{f.nota}</span>}
        <span className="mt-2 block text-muted-foreground">
          Duración: {formatoDuracion(f.duracionMs)} · Pulsa para ver los datos.
        </span>
      </div>
    </div>
  )
}

function Cifra({
  titulo,
  dato,
}: {
  titulo: string
  dato: { valor: number | null; etiqueta: string }
}) {
  return (
    <span className="grid rounded-sm bg-muted px-2 py-1">
      <span className="text-muted-foreground">{titulo}</span>
      <span className="text-sm font-semibold">
        {dato.valor === null ? "—" : formatoEntero(dato.valor)}
      </span>
      <span className="text-muted-foreground">{dato.etiqueta}</span>
    </span>
  )
}
