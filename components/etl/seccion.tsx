import * as React from "react"
import { cn } from "@/lib/utils"

/** Bloque de un paso del recorrido: número, título, qué hacer aquí y contenido. */
export function Seccion({
  id,
  numero,
  titulo,
  descripcion,
  acciones,
  className,
  children,
}: {
  id?: string
  numero?: number
  titulo: string
  descripcion?: React.ReactNode
  acciones?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const idTitulo = id ? `${id}-titulo` : undefined
  return (
    <section
      id={id}
      aria-labelledby={idTitulo}
      className={cn(
        "scroll-mt-4 rounded-lg border bg-card p-4 sm:p-6",
        className
      )}
    >
      <header className="mb-5 flex flex-wrap items-start gap-x-4 gap-y-2">
        {numero !== undefined && (
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-md morado-conico text-sm font-semibold text-white"
          >
            {numero}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 id={idTitulo} className="text-lg font-semibold tracking-tight">
            {numero !== undefined && (
              <span className="sr-only">Paso {numero}: </span>
            )}
            {titulo}
          </h2>
          {descripcion && (
            <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
              {descripcion}
            </p>
          )}
        </div>
        {acciones}
      </header>
      {children}
    </section>
  )
}
