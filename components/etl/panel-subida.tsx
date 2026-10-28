"use client"

import {
  CheckCircle2Icon,
  Loader2Icon,
  RotateCcwIcon,
  TriangleAlertIcon,
  UploadCloudIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Carga } from "@/hooks/use-carga"
import { formatoEntero } from "./comun"

/**
 * Lo único que se ve de la sección 3 a simple vista: cuántos registros están
 * marcados, un botón para marcarlos o desmarcarlos todos y el de subir.
 */
export function PanelSubida({
  marcados,
  total,
  hayFiltros,
  todosMarcados,
  fueraDeFiltros,
  motivoBloqueo,
  aviso,
  carga,
  onMarcarTodos,
  onDesmarcarTodo,
  onSubir,
  onReintentar,
}: {
  /** Seleccionados que cumplen los filtros: lo que se subiría. */
  marcados: number
  /** Registros que cumplen los filtros (todos los válidos si no hay filtros). */
  total: number
  hayFiltros: boolean
  todosMarcados: boolean
  fueraDeFiltros: number
  /** Si existe, el botón de subir queda desactivado y se muestra este motivo. */
  motivoBloqueo: string | null
  aviso: string | null
  carga: Carga | null
  onMarcarTodos: () => void
  onDesmarcarTodo: () => void
  onSubir: () => void
  onReintentar: () => void
}) {
  const subiendo = carga?.enCurso ?? false
  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="flex flex-col gap-3 rounded-lg bg-background p-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-base" aria-live="polite">
          <strong className="text-2xl font-semibold tabular-nums">
            {formatoEntero(marcados)}
          </strong>{" "}
          <span className="text-muted-foreground">
            de {formatoEntero(total)} registros marcados
            {hayFiltros && " (con filtros)"}
          </span>
        </p>
        <div className="grid grid-cols-1 gap-2 sm:flex">
          {/* Un único botón: marca todos o, si ya lo están, lo desmarca todo. */}
          <Button
            variant="outline"
            size="lg"
            className="h-11 px-4"
            onClick={todosMarcados ? onDesmarcarTodo : onMarcarTodos}
            disabled={total === 0 || subiendo}
          >
            {todosMarcados ? "Desmarcar todo" : "Marcar todos"}
          </Button>
          <Button
            size="lg"
            className="h-11 px-4"
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
              : `Subir ${formatoEntero(marcados)} registros a Supabase`}
          </Button>
        </div>
      </div>

      <Estado
        carga={carga}
        motivoBloqueo={motivoBloqueo}
        aviso={aviso}
        fueraDeFiltros={fueraDeFiltros}
        onReintentar={onReintentar}
      />
    </div>
  )
}

/** Una sola línea: el resultado de la subida o lo que impide subir. */
function Estado({
  carga,
  motivoBloqueo,
  aviso,
  fueraDeFiltros,
  onReintentar,
}: {
  carga: Carga | null
  motivoBloqueo: string | null
  aviso: string | null
  fueraDeFiltros: number
  onReintentar: () => void
}) {
  const lotesFallidos = carga?.lotes.filter((l) => l.estado === "error") ?? []
  const v = carga?.verificacion

  let icono = null
  let texto: string | null = null
  let tono = "text-muted-foreground"
  if (carga?.enCurso) {
    const hechos = carga.lotes.filter((l) => l.estado === "completado").length
    icono = <Loader2Icon aria-hidden className="size-4 animate-spin" />
    texto = `Subiendo… ${hechos} de ${carga.lotes.length} lotes enviados.`
  } else if (lotesFallidos.length > 0) {
    icono = <TriangleAlertIcon aria-hidden className="size-4" />
    texto = `No se pudieron subir ${lotesFallidos.length} de ${carga!.lotes.length} lotes.`
    tono = "text-destructive"
  } else if (v?.estado === "en_curso") {
    icono = <Loader2Icon aria-hidden className="size-4 animate-spin" />
    texto = "Comprobando en Supabase que los registros han llegado…"
  } else if (v?.estado === "error") {
    icono = <TriangleAlertIcon aria-hidden className="size-4" />
    texto = `Se subieron, pero no se pudo comprobar: ${v.error}`
    tono = "text-amber-400"
  } else if (v?.estado === "completada") {
    const ok = v.comprobadas - v.faltan.length
    if (v.faltan.length === 0) {
      icono = <CheckCircle2Icon aria-hidden className="size-4" />
      texto = `${formatoEntero(ok)} registros guardados y comprobados en Supabase.`
      tono = "text-emerald-400"
    } else {
      icono = <TriangleAlertIcon aria-hidden className="size-4" />
      texto = `${formatoEntero(ok)} guardados; ${formatoEntero(v.faltan.length)} no aparecen en Supabase.`
      tono = "text-destructive"
    }
  } else if (motivoBloqueo ?? aviso) {
    texto = motivoBloqueo ?? aviso
    tono = "text-amber-400"
  } else if (fueraDeFiltros > 0) {
    texto = `${formatoEntero(fueraDeFiltros)} marcados no cumplen los filtros y no se subirán.`
    tono = "text-amber-400"
  }

  if (!texto) return null
  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-sm ${tono}`}
      aria-live="polite"
    >
      {icono}
      <span>{texto}</span>
      {lotesFallidos.length > 0 && !carga?.enCurso && (
        <Button variant="outline" size="sm" onClick={onReintentar}>
          <RotateCcwIcon data-icon="inline-start" />
          Reintentar
        </Button>
      )}
    </div>
  )
}
