"use client"

import * as React from "react"
import {
  CheckCircle2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  Loader2Icon,
  TriangleAlertIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export type EstadoFase = "pendiente" | "en_curso" | "completada" | "error"

const ESTADOS: Record<
  EstadoFase,
  {
    texto: string
    Icono: typeof CheckCircle2Icon
    clase: string
  }
> = {
  pendiente: {
    texto: "Pendiente",
    Icono: CircleDashedIcon,
    clase: "solido text-muted-foreground",
  },
  en_curso: {
    texto: "En curso",
    Icono: Loader2Icon,
    clase: "solido-azul",
  },
  completada: {
    texto: "Completada",
    Icono: CheckCircle2Icon,
    clase: "solido-verde",
  },
  error: {
    texto: "Con errores",
    Icono: TriangleAlertIcon,
    clase: "solido-rojo",
  },
}

/** Estado con icono y texto: no depende solo del color. */
export function EstadoEtiqueta({
  estado,
  texto,
  className,
}: {
  estado: EstadoFase
  texto?: string
  className?: string
}) {
  const { texto: base, Icono, clase } = ESTADOS[estado]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium whitespace-nowrap",
        clase,
        className
      )}
    >
      <Icono
        aria-hidden
        className={cn("size-3.5", estado === "en_curso" && "animate-spin")}
      />
      {texto ?? base}
    </span>
  )
}

const numero = new Intl.NumberFormat("es-ES")
const decimal = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 })

export const formatoEntero = (n: number) => numero.format(n)
export const formatoDecimal = (n: number) => decimal.format(n)

export function formatoDuracion(ms: number | undefined) {
  if (ms === undefined) return "—"
  if (ms < 1) return "< 1 ms"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${decimal.format(ms / 1000)} s`
}

/** "2026-09-01T13:00:00.000Z" → "2026-09-01 13:00 UTC" */
export function formatoFechaUtc(iso: string | null | undefined) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`
}

/** Muestra un valor crudo sin ocultar null, cadenas vacías ni ausencias. */
export function ValorCrudo({ valor }: { valor: unknown }) {
  if (valor === undefined) {
    return <span className="text-destructive italic">ausente</span>
  }
  if (valor === null) {
    return <span className="font-mono text-destructive">null</span>
  }
  if (valor === "") {
    return <span className="font-mono text-destructive">&quot;&quot;</span>
  }
  if (typeof valor === "number") {
    return <span className="tabular-nums">{formatoDecimal(valor)}</span>
  }
  return <span className="font-mono">{JSON.stringify(valor)}</span>
}

export const TAMANOS_PAGINA = [25, 50, 100] as const

export function usePaginacion(total: number, tamanoInicial = 25) {
  const [pagina, setPagina] = React.useState(1)
  const [tamano, setTamanoBase] = React.useState(tamanoInicial)
  const totalPaginas = Math.max(1, Math.ceil(total / tamano))
  // Si el conjunto se reduce, la página se ajusta sin efectos secundarios.
  const actual = Math.min(pagina, totalPaginas)
  const inicio = (actual - 1) * tamano
  return {
    pagina: actual,
    setPagina,
    tamano,
    setTamano: (t: number) => {
      setTamanoBase(t)
      setPagina(1)
    },
    totalPaginas,
    inicio,
    fin: Math.min(inicio + tamano, total),
    total,
  }
}

export type Paginacion = ReturnType<typeof usePaginacion>

export function Paginador({
  paginacion,
  etiqueta = "registros",
}: {
  paginacion: Paginacion
  etiqueta?: string
}) {
  const { pagina, setPagina, totalPaginas, inicio, fin, total, tamano } =
    paginacion
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <p aria-live="polite">
        {total === 0
          ? `Sin ${etiqueta}`
          : `Mostrando ${formatoEntero(inicio + 1)}–${formatoEntero(fin)} de ${formatoEntero(total)} ${etiqueta}`}
      </p>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5">
          <span>Filas por página</span>
          <SelectorNativo
            value={String(tamano)}
            onChange={(e) => paginacion.setTamano(Number(e.target.value))}
          >
            {TAMANOS_PAGINA.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </SelectorNativo>
        </label>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setPagina(pagina - 1)}
          disabled={pagina <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeftIcon />
        </Button>
        <span className="tabular-nums">
          {pagina} / {totalPaginas}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setPagina(pagina + 1)}
          disabled={pagina >= totalPaginas}
          aria-label="Página siguiente"
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}

export function SelectorNativo({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 rounded-lg border border-input bg-campo px-2 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 sm:text-sm",
        className
      )}
      {...props}
    />
  )
}

export function Explicacion({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
    >
      {children}
    </p>
  )
}

export function descargarJson(nombre: string, datos: unknown) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

/** Botón conmutador de una ciudad, con su color fijo y estado accesible. */
export function ChipCiudad({
  ciudad,
  color,
  marcada,
  disabled,
  onClick,
}: {
  ciudad: string
  color: string
  marcada: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={marcada}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
        marcada
          ? "solido-claro"
          : "solido text-muted-foreground hover:text-foreground"
      )}
    >
      <span
        aria-hidden
        className="size-2.5 rounded-full"
        style={{
          background: marcada ? color : "transparent",
          boxShadow: `inset 0 0 0 2px ${color}`,
        }}
      />
      {ciudad}
    </button>
  )
}
