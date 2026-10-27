"use client"

import * as React from "react"
import { CIUDADES, colorCiudad } from "@/lib/etl/ciudades"
import {
  CONTORNO,
  MAPA_ALTO,
  MAPA_ANCHO,
  POSICION_CIUDADES,
  PROVINCIAS,
} from "@/lib/etl/mapa-espana"
import type { ResumenCiudad } from "@/lib/etl/resumen"
import type { EstadoPeticion } from "@/hooks/use-extraccion"
import { formatoDecimal, formatoEntero } from "./comun"

const TEXTO_ESTADO: Record<EstadoPeticion, string> = {
  pendiente: "pendiente de descarga",
  en_curso: "descargando…",
  completada: "descargada",
  error: "error en la descarga",
}

// Provincia → ciudad del pipeline (solo esas provincias son interactivas).
const CIUDAD_DE_PROVINCIA = new Map(
  Object.entries(POSICION_CIUDADES).map(([ciudad, p]) => [p.provincia, ciudad])
)

export type PropsMapa = {
  seleccionadas: string[]
  onAlternar: (ciudad: string) => void
  bloqueado: boolean
  estados: Record<string, EstadoPeticion | undefined>
  resumen: Map<string, ResumenCiudad>
}

/**
 * Mapa minimalista de España (península y Baleares) por provincias. La
 * provincia de cada ciudad es un botón: un clic o Intro/Espacio la añade o la
 * quita de la descarga. Al pasar por encima se muestra su resumen.
 */
export function MapaCiudades({
  seleccionadas,
  onAlternar,
  bloqueado,
  estados,
  resumen,
}: PropsMapa) {
  const [enfocada, setEnfocada] = React.useState<string | null>(null)
  const idDegradado = React.useId()

  const pulsar = (ciudad: string) => {
    if (!bloqueado) onAlternar(ciudad)
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <svg
        viewBox={`0 0 ${MAPA_ANCHO} ${MAPA_ALTO}`}
        className="h-auto w-full"
        role="group"
        aria-label="Mapa de España. Las provincias de las cinco ciudades son botones para añadirlas o quitarlas de la descarga."
      >
        <defs>
          <linearGradient id={idDegradado} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="55%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>

        {/* Provincias sin interacción */}
        <g aria-hidden>
          {PROVINCIAS.filter((p) => !CIUDAD_DE_PROVINCIA.has(p.id)).map((p) => (
            <path
              key={p.id}
              d={p.d}
              fill="var(--mapa-provincia)"
              stroke="var(--mapa-borde)"
              strokeWidth={0.6}
              strokeLinejoin="round"
            />
          ))}
          <path
            d={CONTORNO}
            fill="none"
            stroke="var(--mapa-contorno)"
            strokeWidth={0.9}
            strokeLinejoin="round"
          />
        </g>

        {/* Provincias de las ciudades: cada una es un botón */}
        {CIUDADES.map((c) => {
          const pos = POSICION_CIUDADES[c.nombre]
          const provincia = PROVINCIAS.find((p) => p.id === pos.provincia)
          if (!provincia) return null
          const marcada = seleccionadas.includes(c.nombre)
          const estado = estados[c.nombre]
          return (
            <g
              key={c.nombre}
              role="button"
              tabIndex={0}
              aria-pressed={marcada}
              aria-disabled={bloqueado}
              aria-label={`${c.nombre}: ${marcada ? "incluida" : "no incluida"} en la descarga${
                estado ? `, ${TEXTO_ESTADO[estado]}` : ""
              }`}
              className="provincia-ciudad"
              onClick={() => pulsar(c.nombre)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  pulsar(c.nombre)
                }
              }}
              onMouseEnter={() => setEnfocada(c.nombre)}
              onMouseLeave={() => setEnfocada(null)}
              onFocus={() => setEnfocada(c.nombre)}
              onBlur={() => setEnfocada(null)}
            >
              <path
                d={provincia.d}
                fill={
                  marcada ? `url(#${idDegradado})` : "var(--mapa-disponible)"
                }
                stroke={marcada ? "#c4b5fd" : "var(--mapa-disponible-borde)"}
                strokeWidth={marcada ? 1.2 : 1}
                strokeDasharray={estado === "error" ? "4 3" : undefined}
                strokeLinejoin="round"
              />
              <Etiqueta
                x={pos.x}
                y={pos.y}
                texto={estado === "error" ? `${c.nombre} · error` : c.nombre}
                color={colorCiudad(c.nombre)}
                marcada={marcada}
                desplazamiento={c.nombre === "Bilbao" ? 30 : 0}
              />
            </g>
          )
        })}
      </svg>

      <ResumenEnfocado
        ciudad={enfocada}
        marcada={enfocada ? seleccionadas.includes(enfocada) : false}
        estado={enfocada ? estados[enfocada] : undefined}
        datos={enfocada ? resumen.get(enfocada) : undefined}
      />
    </div>
  )
}

/** Nombre de la ciudad sobre el mapa, con un punto de su color de gráficos. */
function Etiqueta({
  x,
  y,
  texto,
  color,
  marcada,
  desplazamiento,
}: {
  x: number
  y: number
  texto: string
  color: string
  marcada: boolean
  desplazamiento?: number
}) {
  // Barcelona queda pegada al borde derecho: su etiqueta va a la izquierda.
  // Bizkaia es pequeña: la etiqueta de Bilbao se aparta para no taparla.
  const izquierda = x > MAPA_ANCHO - 120
  const ancho = texto.length * 7.4 + 22
  const bx = izquierda ? x - ancho + 8 : x - 8 + (desplazamiento ?? 0)
  return (
    <g pointerEvents="none">
      <rect
        x={bx}
        y={y - 11}
        width={ancho}
        height={22}
        rx={3}
        fill={marcada ? "rgb(9 9 11 / 0.82)" : "rgb(9 9 11 / 0.65)"}
        stroke={marcada ? "rgb(196 181 253 / 0.5)" : "rgb(255 255 255 / 0.12)"}
      />
      <circle cx={bx + 10} cy={y} r={4} fill={color} />
      <text
        x={bx + 19}
        y={y + 4.5}
        fontSize={13}
        fontWeight={600}
        fill={marcada ? "#ffffff" : "#a1a1b0"}
      >
        {texto}
      </text>
    </g>
  )
}

function ResumenEnfocado({
  ciudad,
  marcada,
  estado,
  datos,
}: {
  ciudad: string | null
  marcada: boolean
  estado?: EstadoPeticion
  datos?: ResumenCiudad
}) {
  return (
    <div
      className="min-h-[3.25rem] rounded-md border bg-muted/50 px-3 py-2 text-sm"
      aria-live="polite"
    >
      {!ciudad ? (
        <p className="text-muted-foreground">
          Pulsa una provincia resaltada para añadirla o quitarla de la descarga.
          Pasa el ratón por encima para ver su resumen.
        </p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 tabular-nums">
          <span className="font-semibold">{ciudad}</span>
          <span className="text-muted-foreground">
            {marcada ? "Incluida en la descarga" : "No incluida"}
            {estado && ` · ${TEXTO_ESTADO[estado]}`}
          </span>
          {datos && (
            <>
              <span>
                {formatoEntero(datos.registros)}{" "}
                <span className="text-muted-foreground">registros válidos</span>
              </span>
              <span>
                {formatoDecimal(datos.tempMedia)} °C{" "}
                <span className="text-muted-foreground">
                  media ({formatoDecimal(datos.tempMin)} a{" "}
                  {formatoDecimal(datos.tempMax)})
                </span>
              </span>
              <span>
                {formatoDecimal(datos.humedadMedia)} %{" "}
                <span className="text-muted-foreground">humedad</span>
              </span>
              <span>
                {formatoDecimal(datos.lluviaTotal)} mm{" "}
                <span className="text-muted-foreground">
                  de lluvia ({datos.horasConLluvia} h)
                </span>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
