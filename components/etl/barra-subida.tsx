"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { EyeIcon, Loader2Icon, UploadCloudIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatoEntero } from "./comun"

const sinSuscripcion = () => () => {}

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
  // Se monta directamente en <body> para que ningún contenedor altere su
  // posición fija (en iOS Safari un ancestro con transformación o filtro la
  // desplaza a mitad de pantalla).
  const enNavegador = React.useSyncExternalStore(
    sinSuscripcion,
    () => true,
    () => false
  )
  if (!enNavegador) return null

  // En móvil la ayuda general se oculta para que la barra ocupe poco; los
  // avisos que impiden o limitan la subida se muestran siempre.
  const hayAviso =
    motivoBloqueo !== null || aviso !== null || fueraDeFiltros > 0
  const textoSubir = `Subir ${formatoEntero(aCargar)} registros a Supabase`

  return createPortal(
    <div
      role="region"
      aria-label="Subida a Supabase"
      className="fixed inset-x-0 bottom-0 z-[1100] [transform:translateZ(0)] border-t fondo-barra pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_#000]"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:gap-x-4 sm:px-6 sm:py-3">
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="text-sm">
            <strong className="text-base tabular-nums">
              {formatoEntero(aCargar)}
            </strong>{" "}
            {aCargar === 1 ? "registro listo" : "registros listos"} para subir
          </p>
          <p
            className={cn(
              "text-sm",
              !hayAviso && "hidden sm:block",
              motivoBloqueo || aviso
                ? "text-amber-400"
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
        <Button
          variant="outline"
          className="h-10"
          aria-label="Revisar lista"
          onClick={onRevisar}
        >
          <EyeIcon data-icon="inline-start" />
          <span className="hidden sm:inline">Revisar lista</span>
        </Button>
        <Button
          size="lg"
          className="h-10 px-4"
          disabled={motivoBloqueo !== null || subiendo}
          aria-label={subiendo ? undefined : textoSubir}
          onClick={onSubir}
        >
          {subiendo ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <UploadCloudIcon data-icon="inline-start" />
          )}
          {subiendo ? (
            "Subiendo…"
          ) : (
            <>
              <span className="sm:hidden">Subir</span>
              <span className="hidden sm:inline">{textoSubir}</span>
            </>
          )}
        </Button>
      </div>
    </div>,
    document.body
  )
}
