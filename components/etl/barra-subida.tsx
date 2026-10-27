"use client"

import { EyeIcon, Loader2Icon, UploadCloudIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatoEntero } from "./comun"

/**
 * Acción principal siempre a mano: cuántos registros se subirán y el botón
 * para subirlos. Si no se puede subir, explica por qué.
 */
export function BarraSubida({
  aCargar,
  fueraDeFiltros,
  subiendo,
  motivoBloqueo,
  aviso,
  onRevisar,
  onSubir,
}: {
  aCargar: number
  fueraDeFiltros: number
  subiendo: boolean
  /** Si existe, el botón queda desactivado y se muestra este motivo. */
  motivoBloqueo: string | null
  aviso: string | null
  onRevisar: () => void
  onSubir: () => void
}) {
  return (
    <div
      role="region"
      aria-label="Subida a Supabase"
      className="fixed inset-x-0 bottom-0 z-[1100] border-t bg-card/95 shadow-[0_-8px_24px_-12px_rgb(15_27_45/0.25)] backdrop-blur supports-[backdrop-filter]:bg-card/85"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-sm">
            <strong className="text-base tabular-nums">
              {formatoEntero(aCargar)}
            </strong>{" "}
            {aCargar === 1 ? "registro listo" : "registros listos"} para subir
          </p>
          <p
            className={cn(
              "text-xs",
              motivoBloqueo || aviso
                ? "text-amber-700 dark:text-amber-400"
                : "text-muted-foreground"
            )}
          >
            {motivoBloqueo ??
              aviso ??
              (fueraDeFiltros > 0
                ? `${formatoEntero(fueraDeFiltros)} seleccionados no cumplen los filtros y no se subirán.`
                : "Solo se suben las filas seleccionadas que cumplen los filtros, en el orden elegido.")}
          </p>
        </div>
        <Button variant="outline" onClick={onRevisar}>
          <EyeIcon data-icon="inline-start" />
          Revisar antes de subir
        </Button>
        <Button
          size="lg"
          className="fondo-atardecer h-10 border-0 px-4 text-white shadow-sm disabled:opacity-50"
          disabled={motivoBloqueo !== null || subiendo}
          onClick={onSubir}
        >
          {subiendo ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <UploadCloudIcon data-icon="inline-start" />
          )}
          {subiendo
            ? "Subiendo…"
            : `Subir ${formatoEntero(aCargar)} registros a Supabase`}
        </Button>
      </div>
    </div>
  )
}
