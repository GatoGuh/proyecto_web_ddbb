"use client"

import * as React from "react"
import { DatabaseIcon, SearchIcon } from "lucide-react"
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

/**
 * Cabecera: qué es la aplicación, a dónde se suben los datos y el recorrido
 * de las cinco fases con sus contadores reales.
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
    <header className="fondo-cabecera border-b text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 pt-8 pb-6 sm:px-6 lg:pt-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Pipeline ETL de datos meteorológicos
            </h1>
            <p className="mt-2 text-base text-white/85">
              Descarga datos horarios de Open-Meteo, observa qué les ocurre en
              cada fase y guarda en Supabase solo los registros que elijas.
            </p>
          </div>
          <div className="grid max-w-xs justify-items-start gap-1.5 rounded-md bg-white/[0.04] p-3 ring-1 ring-white/10 sm:justify-items-end">
            <span className="flex items-center gap-1.5 text-sm text-white/85">
              <DatabaseIcon aria-hidden className="size-4" />
              Base de datos de destino
            </span>
            <EstadoEtiqueta
              estado={destino.estado}
              texto={destino.texto}
              sobreColor
            />
            {destino.detalle && (
              <p className="text-xs text-white/80 sm:text-right">
                {destino.detalle}
              </p>
            )}
          </div>
        </div>

        <nav aria-label="Fases del pipeline">
          <ol className="grid gap-2 lg:grid-cols-5 lg:gap-3">
            {fases.map((f, i) => (
              <li key={f.id} className="relative flex">
                <button
                  type="button"
                  onClick={() => onInspeccionar(f.pestana)}
                  className={cn(
                    "flex w-full flex-col gap-2 rounded-md bg-white/[0.04] p-3 text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:outline-none",
                    f.estado === "en_curso" &&
                      "bg-violet-500/10 ring-violet-400/70",
                    f.estado === "error" && "ring-red-400/70"
                  )}
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold">
                      <span
                        aria-hidden
                        className="fondo-morado grid size-6 place-items-center rounded-sm text-xs font-bold text-white"
                      >
                        {i + 1}
                      </span>
                      {f.titulo}
                    </span>
                    <EstadoEtiqueta estado={f.estado} sobreColor />
                  </span>
                  <span className="text-xs leading-relaxed text-white/80">
                    {f.explicacion}
                  </span>
                  <span className="mt-auto grid grid-cols-2 gap-2 rounded-sm bg-black/40 px-2 py-1.5 tabular-nums">
                    <Cifra titulo="Entrada" dato={f.entrada} />
                    <Cifra titulo="Salida" dato={f.salida} />
                  </span>
                  {f.nota && (
                    <span className="text-xs text-white/85">{f.nota}</span>
                  )}
                  <span className="flex items-center justify-between text-xs text-white/75">
                    <span>Duración: {formatoDuracion(f.duracionMs)}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-white">
                      <SearchIcon aria-hidden className="size-3.5" />
                      Ver datos
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </header>
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
    <span className="grid">
      <span className="text-[11px] text-white/70">{titulo}</span>
      <span className="text-base leading-tight font-semibold">
        {dato.valor === null ? "—" : formatoEntero(dato.valor)}
      </span>
      <span className="text-[11px] leading-tight text-white/75">
        {dato.etiqueta}
      </span>
    </span>
  )
}
