"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { TableIcon, LineChartIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { colorCiudad } from "@/lib/etl/ciudades"
import type { PuntoDiario, ResumenCiudad } from "@/lib/etl/resumen"
import { cn } from "@/lib/utils"
import { formatoDecimal, formatoEntero } from "./comun"

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
]
/** "2026-09-04" → "4 sep" */
const fechaCorta = (iso: string) =>
  `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`

// Estilo del texto de los ejes (sin trazo, para que no se vea borroso).
const EJE = { fontSize: 14, fill: "var(--muted-foreground)" }

/* ------------------------------------------------------------------ */
/* Embudo: los cinco contadores del pipeline como barras comparables   */
/* ------------------------------------------------------------------ */

export type FilaEmbudo = {
  etiqueta: string
  valor: number
  ayuda?: string
  destacada?: boolean
}

export function Embudo({
  filas,
  total,
}: {
  filas: FilaEmbudo[]
  total: number
}) {
  return (
    <figure className="grid gap-3">
      <figcaption className="text-sm font-semibold">
        De lo descargado a lo que se sube
      </figcaption>
      <dl className="grid gap-3">
        {filas.map((f) => {
          const pct = total > 0 ? (f.valor / total) * 100 : 0
          return (
            <div key={f.etiqueta} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <dt className={cn(f.destacada && "font-semibold")}>
                  {f.etiqueta}
                </dt>
                <dd className="font-semibold tabular-nums">
                  {formatoEntero(f.valor)}
                </dd>
              </div>
              <div className="h-2 rounded-sm bg-muted" aria-hidden>
                <div
                  className={cn(
                    "h-2 rounded-sm transition-[width] duration-500",
                    f.destacada ? "morado-horizontal" : "bg-zinc-600"
                  )}
                  style={{ width: `${Math.max(pct, f.valor > 0 ? 1 : 0)}%` }}
                />
              </div>
              {f.ayuda && (
                <dd className="text-sm text-muted-foreground">{f.ayuda}</dd>
              )}
            </div>
          )
        })}
      </dl>
    </figure>
  )
}

/* ------------------------------------------------------------------ */
/* Utilidades compartidas                                              */
/* ------------------------------------------------------------------ */

function Leyenda({ ciudades }: { ciudades: string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
      {ciudades.map((c) => (
        <li key={c} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="w-3.5 rounded-full"
            style={{ background: colorCiudad(c), height: 3 }}
          />
          {c}
        </li>
      ))}
    </ul>
  )
}

function CabeceraGrafico({
  titulo,
  subtitulo,
  verTabla,
  setVerTabla,
}: {
  titulo: string
  subtitulo: string
  verTabla: boolean
  setVerTabla: (v: boolean) => void
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <p className="text-sm text-muted-foreground">{subtitulo}</p>
      </div>
      <Button
        variant="ghost"
        size="xs"
        aria-pressed={verTabla}
        onClick={() => setVerTabla(!verTabla)}
      >
        {verTabla ? (
          <LineChartIcon data-icon="inline-start" />
        ) : (
          <TableIcon data-icon="inline-start" />
        )}
        {verTabla ? "Ver gráfico" : "Ver como tabla"}
      </Button>
    </div>
  )
}

type EntradaTooltip = { dataKey?: unknown; value?: unknown; color?: string }

function CajaTooltip({
  titulo,
  filas,
}: {
  titulo: string
  filas: { clave: string; valor: string }[]
}) {
  return (
    <div className="min-w-36 rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-semibold">{titulo}</p>
      <ul className="grid gap-0.5">
        {filas.map((f) => (
          <li key={f.clave} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ background: colorCiudad(f.clave) }}
            />
            <span className="text-muted-foreground">{f.clave}</span>
            <span className="ml-auto font-medium tabular-nums">{f.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Temperatura media diaria por ciudad                                 */
/* ------------------------------------------------------------------ */

export function GraficoTemperatura({
  datos,
  ciudades,
}: {
  datos: PuntoDiario[]
  ciudades: string[]
}) {
  const [verTabla, setVerTabla] = React.useState(false)
  return (
    <figure className="grid min-w-0 content-start gap-3">
      <CabeceraGrafico
        titulo="Temperatura media diaria"
        subtitulo="°C, media de las 24 horas de cada día (UTC). Registros válidos."
        verTabla={verTabla}
        setVerTabla={setVerTabla}
      />
      <Leyenda ciudades={ciudades} />
      {verTabla ? (
        <div className="max-h-[26rem] overflow-auto rounded-md border">
          <table className="w-full text-sm tabular-nums">
            <thead className="sticky top-0 bg-card">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Día</th>
                {ciudades.map((c) => (
                  <th key={c} className="px-2 py-1.5 text-right font-medium">
                    {c} (°C)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.map((d) => (
                <tr key={d.fecha} className="border-t">
                  <td className="px-2 py-1">{fechaCorta(d.fecha)}</td>
                  {ciudades.map((c) => (
                    <td key={c} className="px-2 py-1 text-right">
                      {typeof d[c] === "number"
                        ? formatoDecimal(d[c] as number)
                        : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className="h-80 w-full lg:h-[26rem]"
          role="img"
          aria-label="Gráfico de líneas de la temperatura media diaria por ciudad. Disponible también como tabla."
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={datos}
              margin={{ top: 8, right: 12, bottom: 0, left: -8 }}
            >
              <CartesianGrid vertical={false} stroke="var(--rejilla)" />
              <XAxis
                dataKey="fecha"
                tickFormatter={fechaCorta}
                tick={EJE}
                stroke="var(--eje)"
                tickLine={false}
                minTickGap={44}
              />
              <YAxis
                tick={EJE}
                stroke="var(--eje)"
                tickLine={false}
                axisLine={false}
                width={50}
                domain={["auto", "auto"]}
                tickFormatter={(v: number) => `${v}°`}
              />
              <Tooltip
                cursor={{ stroke: "var(--eje)", strokeWidth: 1 }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <CajaTooltip
                      titulo={fechaCorta(String(label))}
                      filas={(payload as readonly EntradaTooltip[]).map(
                        (p) => ({
                          clave: String(p.dataKey),
                          valor: `${formatoDecimal(Number(p.value))} °C`,
                        })
                      )}
                    />
                  ) : null
                }
              />
              {ciudades.map((c) => (
                <Line
                  key={c}
                  dataKey={c}
                  type="monotone"
                  stroke={colorCiudad(c)}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: "var(--card)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  )
}

/* ------------------------------------------------------------------ */
/* Lluvia acumulada por ciudad                                         */
/* ------------------------------------------------------------------ */

export function GraficoLluvia({ resumen }: { resumen: ResumenCiudad[] }) {
  const [verTabla, setVerTabla] = React.useState(false)
  const datos = resumen.map((r) => ({
    ciudad: r.ciudad,
    lluvia: r.lluviaTotal,
    horas: r.horasConLluvia,
  }))
  return (
    <figure className="grid min-w-0 content-start gap-3">
      <CabeceraGrafico
        titulo="Lluvia acumulada"
        subtitulo="mm totales en el periodo y horas con lluvia (> 0 mm)."
        verTabla={verTabla}
        setVerTabla={setVerTabla}
      />
      {verTabla ? (
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr>
              <th className="py-1.5 text-left font-medium">Ciudad</th>
              <th className="py-1.5 text-right font-medium">Lluvia (mm)</th>
              <th className="py-1.5 text-right font-medium">
                Horas con lluvia
              </th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d) => (
              <tr key={d.ciudad} className="border-t">
                <td className="py-1">{d.ciudad}</td>
                <td className="py-1 text-right">{formatoDecimal(d.lluvia)}</td>
                <td className="py-1 text-right">{d.horas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div
          className="w-full"
          style={{ height: Math.max(datos.length * 40 + 16, 80) }}
          role="img"
          aria-label="Gráfico de barras de la lluvia acumulada por ciudad. Disponible también como tabla."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={datos}
              layout="vertical"
              margin={{ top: 0, right: 76, bottom: 0, left: 0 }}
              barCategoryGap={8}
            >
              <XAxis type="number" hide domain={[0, "dataMax"]} />
              <YAxis
                type="category"
                dataKey="ciudad"
                tick={{ ...EJE, fill: "var(--foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--eje)" }}
                width={90}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                content={({ active, payload }) => {
                  const d = payload?.[0]?.payload as
                    (typeof datos)[number] | undefined
                  return active && d ? (
                    <CajaTooltip
                      titulo="Lluvia acumulada"
                      filas={[
                        {
                          clave: d.ciudad,
                          valor: `${formatoDecimal(d.lluvia)} mm · ${d.horas} h`,
                        },
                      ]}
                    />
                  ) : null
                }}
              />
              <Bar
                dataKey="lluvia"
                barSize={20}
                radius={[0, 4, 4, 0]}
                isAnimationActive={false}
              >
                {datos.map((d) => (
                  <Cell key={d.ciudad} fill={colorCiudad(d.ciudad)} />
                ))}
                <LabelList
                  dataKey="lluvia"
                  position="right"
                  formatter={(v: unknown) => `${formatoDecimal(Number(v))} mm`}
                  style={{ fill: "var(--foreground)", fontSize: 14 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  )
}
