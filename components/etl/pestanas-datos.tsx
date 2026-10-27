"use client"

import * as React from "react"
import { DownloadIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Extraccion } from "@/hooks/use-extraccion"
import type {
  RegistroRechazado,
  ResultadoTransformacion,
} from "@/lib/etl/tipos"
import {
  descargarJson,
  EstadoEtiqueta,
  Explicacion,
  formatoEntero,
  formatoFechaUtc,
  Paginador,
  usePaginacion,
  ValorCrudo,
} from "./comun"

/**
 * Formato legible: objetos indentados, pero los arrays de valores en una sola
 * línea para no generar miles de líneas.
 */
function formatearJson(valor: unknown, sangria = ""): string {
  if (Array.isArray(valor)) {
    if (valor.every((v) => v === null || typeof v !== "object")) {
      return `[${valor.map((v) => JSON.stringify(v)).join(", ")}]`
    }
    const interior = sangria + "  "
    return `[\n${valor.map((v) => interior + formatearJson(v, interior)).join(",\n")}\n${sangria}]`
  }
  if (valor !== null && typeof valor === "object") {
    const interior = sangria + "  "
    const lineas = Object.entries(valor).map(
      ([k, v]) =>
        `${interior}${JSON.stringify(k)}: ${formatearJson(v, interior)}`
    )
    return `{\n${lineas.join(",\n")}\n${sangria}}`
  }
  return JSON.stringify(valor)
}

export function PestanaJson({ extraccion }: { extraccion: Extraccion | null }) {
  const [elegida, setElegida] = React.useState<string | null>(null)
  if (!extraccion) return <SinDatos texto="Todavía no se ha extraído nada." />

  const peticiones = extraccion.ciudades.map((c) => extraccion.peticiones[c])
  const actual = peticiones.find((p) => p.ciudad === elegida) ?? peticiones[0]
  const descargables = peticiones.filter((p) => p.json !== undefined)

  return (
    <div className="grid grid-cols-1 gap-3">
      <Explicacion>
        Respuesta original de Open-Meteo, sin modificar. Se conserva en memoria
        mientras la página esté abierta. Fíjate en que <code>hourly</code>{" "}
        contiene arrays paralelos: la posición <em>i</em> de cada array
        corresponde a la hora <code>time[i]</code>.
      </Explicacion>
      <div className="flex flex-wrap items-center gap-2">
        {peticiones.map((p) => (
          <Button
            key={p.ciudad}
            size="sm"
            variant={p.ciudad === actual.ciudad ? "default" : "outline"}
            aria-pressed={p.ciudad === actual.ciudad}
            onClick={() => setElegida(p.ciudad)}
          >
            {p.ciudad}
          </Button>
        ))}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={actual.json === undefined}
            onClick={() =>
              descargarJson(
                `open-meteo_${actual.ciudad}_${extraccion.inicio}_${extraccion.fin}.json`,
                actual.json
              )
            }
          >
            <DownloadIcon data-icon="inline-start" />
            Descargar {actual.ciudad}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={descargables.length === 0}
            onClick={() =>
              descargarJson(
                `open-meteo_${extraccion.inicio}_${extraccion.fin}.json`,
                Object.fromEntries(descargables.map((p) => [p.ciudad, p.json]))
              )
            }
          >
            <DownloadIcon data-icon="inline-start" />
            Descargar todas ({descargables.length})
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <EstadoEtiqueta estado={actual.estado} />
        {actual.url && (
          <code className="min-w-0 text-sm break-all text-muted-foreground">
            GET {actual.url}
          </code>
        )}
      </div>
      {actual.estado === "error" && (
        <Alert variant="destructive">
          <AlertTitle>La descarga de {actual.ciudad} falló</AlertTitle>
          <AlertDescription>{actual.error}</AlertDescription>
        </Alert>
      )}
      {actual.json !== undefined && (
        <pre className="max-h-[28rem] overflow-auto rounded-lg border bg-muted p-3 font-mono text-sm leading-relaxed break-all whitespace-pre-wrap">
          {formatearJson(actual.json)}
        </pre>
      )}
    </div>
  )
}

export function SinDatos({ texto }: { texto: string }) {
  return (
    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {texto}
    </p>
  )
}

export function PestanaTransformados({
  resultado,
}: {
  resultado: ResultadoTransformacion
}) {
  const filas = resultado.registros
  const paginacion = usePaginacion(filas.length)
  const visibles = filas.slice(paginacion.inicio, paginacion.fin)
  return (
    <div className="grid grid-cols-1 gap-3">
      <Explicacion>
        Cada posición de los arrays se convierte en un registro (ciudad, hora).
        Aquí los valores aparecen <strong>tal como llegaron</strong>: un{" "}
        <code>null</code> sigue siendo <code>null</code>, no se convierte en 0.
        La hora sin zona que envía la API (<code>2026-09-01T13:00</code>) se
        interpreta explícitamente como UTC.
      </Explicacion>
      {resultado.erroresEstructurales.map((e, i) => (
        <Alert key={`e${i}`} variant="destructive">
          <AlertTitle>{e.ciudad}: respuesta no procesable</AlertTitle>
          <AlertDescription>{e.mensaje}</AlertDescription>
        </Alert>
      ))}
      {resultado.avisos.map((a, i) => (
        <Alert key={`a${i}`}>
          <AlertTitle>{a.ciudad}: aviso de estructura</AlertTitle>
          <AlertDescription>{a.mensaje}</AlertDescription>
        </Alert>
      ))}
      {filas.length === 0 ? (
        <SinDatos texto="No hay registros transformados." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ciudad</TableHead>
                  <TableHead className="text-right">Posición</TableHead>
                  <TableHead>time (original)</TableHead>
                  <TableHead>fecha_hora (UTC)</TableHead>
                  <TableHead className="text-right">Temperatura (°C)</TableHead>
                  <TableHead className="text-right">Humedad (%)</TableHead>
                  <TableHead className="text-right">
                    Precipitación (mm)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.ciudad}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.indice}
                    </TableCell>
                    <TableCell>
                      <ValorCrudo valor={r.fecha_hora_original} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.fecha_hora ? (
                        formatoFechaUtc(r.fecha_hora)
                      ) : (
                        <span className="text-destructive">no válida</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ValorCrudo valor={r.temperatura_c} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ValorCrudo valor={r.humedad_pct} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ValorCrudo valor={r.precipitacion_mm} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Paginador paginacion={paginacion} />
        </>
      )}
    </div>
  )
}

export function PestanaRechazados({
  rechazados,
  excluidosPorFiltros,
}: {
  rechazados: RegistroRechazado[]
  excluidosPorFiltros: number
}) {
  const paginacion = usePaginacion(rechazados.length)
  const visibles = rechazados.slice(paginacion.inicio, paginacion.fin)
  const resumen = new Map<string, number>()
  for (const r of rechazados) {
    for (const m of r.motivos) {
      // Agrupa por tipo de motivo (texto antes de los dos puntos o el paréntesis).
      const tipo = m.split(/[:(]/)[0].trim()
      resumen.set(tipo, (resumen.get(tipo) ?? 0) + 1)
    }
  }
  return (
    <div className="grid grid-cols-1 gap-3">
      <Explicacion>
        Descartes <strong>por calidad</strong>: registros sin ciudad, sin fecha
        válida, con alguna medición ausente, nula, vacía o no numérica, humedad
        fuera de 0–100, precipitación negativa o duplicados de (ciudad,
        fecha_hora). Si hay duplicados se conserva la primera aparición válida
        en el orden de extracción. Las temperaturas extremas <strong>no</strong>{" "}
        se descartan. Los {formatoEntero(excluidosPorFiltros)} registros válidos
        excluidos por tus filtros no aparecen aquí: no son errores de calidad.
      </Explicacion>
      {resumen.size > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {[...resumen].map(([tipo, n]) => (
            <li key={tipo} className="rounded-full border px-2 py-0.5">
              {tipo}: <span className="font-semibold tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      )}
      {rechazados.length === 0 ? (
        <SinDatos texto="Ningún registro rechazado por calidad." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ciudad</TableHead>
                  <TableHead className="text-right">Posición</TableHead>
                  <TableHead>fecha_hora (UTC)</TableHead>
                  <TableHead className="text-right">Temperatura (°C)</TableHead>
                  <TableHead className="text-right">Humedad (%)</TableHead>
                  <TableHead className="text-right">
                    Precipitación (mm)
                  </TableHead>
                  <TableHead>Motivo del rechazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map(({ registro: r, motivos }) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.ciudad || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.indice}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.fecha_hora ? (
                        formatoFechaUtc(r.fecha_hora)
                      ) : (
                        <ValorCrudo valor={r.fecha_hora_original} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <ValorCrudo valor={r.temperatura_c} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ValorCrudo valor={r.humedad_pct} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ValorCrudo valor={r.precipitacion_mm} />
                    </TableCell>
                    <TableCell className="whitespace-normal text-destructive">
                      <ul className="list-inside list-disc">
                        {motivos.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Paginador paginacion={paginacion} etiqueta="rechazados" />
        </>
      )}
    </div>
  )
}
