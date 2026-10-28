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
import { cn } from "@/lib/utils"
import { Cristal } from "./cristal"
import { formatoEntero } from "./comun"

/**
 * Cuántos registros están marcados, un botón para marcarlos o desmarcarlos
 * todos y el de subir. Aparece en la sección 3 y, en versión compacta, junto
 * al mapa del paso 1; ambas comparten el mismo estado.
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
  compacto = false,
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
  /** Para columnas estrechas: botones apilados a todo el ancho. */
  compacto?: boolean
}) {
  const subiendo = carga?.enCurso ?? false
  const textoSubir = `Subir ${formatoEntero(marcados)} registros a Supabase`
  return (
    <div className="grid grid-cols-1 gap-3">
      <div
        className={cn(
          "flex flex-col gap-3 rounded-lg bg-background p-4",
          !compacto && "sm:flex-row sm:items-center"
        )}
      >
        {/* Solo una de las dos copias anuncia los cambios al lector de pantalla. */}
        <p
          className="flex-1 text-base"
          aria-live={compacto ? undefined : "polite"}
        >
          <strong className="text-2xl font-semibold tabular-nums">
            {formatoEntero(marcados)}
          </strong>{" "}
          <span className="text-muted-foreground">
            de {formatoEntero(total)} registros marcados
            {hayFiltros && " (con filtros)"}
          </span>
        </p>
        {/* Los dos botones en fila: «Marcar todos» con su ancho y «Subir»
            ocupando el resto. En móvil, uno debajo del otro. */}
        <div
          className={cn(
            "grid grid-cols-1 gap-2",
            compacto ? "sm:grid-cols-[auto_1fr]" : "sm:flex"
          )}
        >
          {/* Un único botón: marca todos o, si ya lo están, lo desmarca todo. */}
          <Cristal tono="claro" apagado={total === 0 || subiendo}>
            <Button
              variant="cristal"
              size="lg"
              className="h-10 px-4"
              onClick={todosMarcados ? onDesmarcarTodo : onMarcarTodos}
              disabled={total === 0 || subiendo}
            >
              {todosMarcados ? "Desmarcar todo" : "Marcar todos"}
            </Button>
          </Cristal>
          <Cristal apagado={motivoBloqueo !== null || subiendo}>
            <Button
              variant="cristal"
              size="lg"
              className="h-10 px-4"
              disabled={motivoBloqueo !== null || subiendo}
              aria-label={subiendo ? undefined : textoSubir}
              onClick={onSubir}
            >
              {subiendo ? (
                <Loader2Icon
                  data-icon="inline-start"
                  className="animate-spin"
                />
              ) : (
                <UploadCloudIcon data-icon="inline-start" />
              )}
              {/* Junto al mapa, texto corto para que quepa al lado de «Marcar
                  todos»: el número ya se ve justo encima. */}
              {subiendo
                ? "Subiendo…"
                : compacto
                  ? "Subir a Supabase"
                  : textoSubir}
            </Button>
          </Cristal>
        </div>
      </div>

      <Estado
        carga={carga}
        motivoBloqueo={motivoBloqueo}
        aviso={aviso}
        fueraDeFiltros={fueraDeFiltros}
        onReintentar={onReintentar}
        anunciar={!compacto}
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
  anunciar,
}: {
  carga: Carga | null
  motivoBloqueo: string | null
  aviso: string | null
  fueraDeFiltros: number
  onReintentar: () => void
  anunciar: boolean
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
      aria-live={anunciar ? "polite" : undefined}
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
