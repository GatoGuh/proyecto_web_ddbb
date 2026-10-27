"use client"

import { ArrowDownIcon, ArrowRightIcon, SearchIcon } from "lucide-react"
import * as React from "react"
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

export function Pipeline({
  fases,
  onInspeccionar,
}: {
  fases: Fase[]
  onInspeccionar: (pestana: string) => void
}) {
  return (
    <section
      aria-labelledby="titulo-pipeline"
      className="grid grid-cols-1 gap-3"
    >
      <h2 id="titulo-pipeline" className="text-base font-semibold">
        2. Pipeline ETL
      </h2>
      <ol className="grid grid-cols-1 gap-2 lg:grid-cols-[repeat(5,minmax(0,1fr))] lg:gap-0">
        {fases.map((f, i) => (
          <li key={f.id} className="flex flex-col items-stretch lg:flex-row">
            <article
              className={cn(
                "flex min-w-0 flex-1 flex-col gap-2 rounded-xl border bg-card p-3 text-sm ring-1 ring-foreground/5",
                f.estado === "en_curso" && "border-sky-600/50",
                f.estado === "error" && "border-destructive/50"
              )}
              aria-label={`Fase ${i + 1}: ${f.titulo}`}
            >
              <header className="flex flex-wrap items-center justify-between gap-1">
                <h3 className="font-semibold">
                  <span className="text-muted-foreground">{i + 1}.</span>{" "}
                  {f.titulo}
                </h3>
                <EstadoEtiqueta estado={f.estado} />
              </header>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {f.explicacion}
              </p>
              <dl className="mt-auto grid grid-cols-2 gap-1 rounded-lg bg-muted/50 p-2 tabular-nums">
                <div>
                  <dt className="text-xs text-muted-foreground">Entrada</dt>
                  <dd className="font-semibold">
                    {f.entrada.valor === null
                      ? "—"
                      : formatoEntero(f.entrada.valor)}
                  </dd>
                  <dd className="text-xs text-muted-foreground">
                    {f.entrada.etiqueta}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Salida</dt>
                  <dd className="font-semibold">
                    {f.salida.valor === null
                      ? "—"
                      : formatoEntero(f.salida.valor)}
                  </dd>
                  <dd className="text-xs text-muted-foreground">
                    {f.salida.etiqueta}
                  </dd>
                </div>
              </dl>
              {f.nota && <div className="text-xs">{f.nota}</div>}
              <footer className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>Duración: {formatoDuracion(f.duracionMs)}</span>
                <button
                  type="button"
                  onClick={() => onInspeccionar(f.pestana)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <SearchIcon aria-hidden className="size-3.5" />
                  Inspeccionar
                </button>
              </footer>
            </article>
            {i < fases.length - 1 && (
              <div
                aria-hidden
                className="flex items-center justify-center py-0.5 text-muted-foreground lg:px-1 lg:py-0"
              >
                <ArrowDownIcon className="size-4 lg:hidden" />
                <ArrowRightIcon className="hidden size-4 lg:block" />
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

export type Contador = {
  etiqueta: string
  valor: number
  detalle?: string
  destacado?: boolean
}

export function Contadores({ contadores }: { contadores: Contador[] }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {contadores.map((c) => (
        <div
          key={c.etiqueta}
          className={cn(
            "rounded-xl border bg-card p-3",
            c.destacado && "border-primary/60 ring-1 ring-primary/30"
          )}
        >
          <dt className="text-xs text-muted-foreground">{c.etiqueta}</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {formatoEntero(c.valor)}
          </dd>
          {c.detalle && (
            <dd className="text-xs text-muted-foreground">{c.detalle}</dd>
          )}
        </div>
      ))}
    </dl>
  )
}
