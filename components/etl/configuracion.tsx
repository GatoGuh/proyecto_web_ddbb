"use client"

import { DownloadCloudIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CIUDADES } from "@/lib/etl/ciudades"
import { TAMANO_LOTE } from "@/lib/etl/carga"
import {
  diasInclusivos,
  MAX_DIAS_EXTRACCION,
  validarConfiguracion,
} from "@/lib/etl/open-meteo"
import type { Extraccion } from "@/hooks/use-extraccion"
import { EstadoEtiqueta, formatoDuracion, formatoEntero } from "./comun"

export function Configuracion({
  ciudades,
  setCiudades,
  inicio,
  setInicio,
  fin,
  setFin,
  extraccion,
  enCurso,
  onExtraer,
  onReintentar,
}: {
  ciudades: string[]
  setCiudades: (c: string[]) => void
  inicio: string
  setInicio: (v: string) => void
  fin: string
  setFin: (v: string) => void
  extraccion: Extraccion | null
  enCurso: boolean
  onExtraer: () => void
  onReintentar: (ciudad: string) => void
}) {
  const errores = validarConfiguracion(ciudades, inicio, fin)
  const dias = diasInclusivos(inicio, fin)
  const horas = dias && dias > 0 ? dias * 24 : 0
  const previstos = horas * ciudades.length

  const alternar = (nombre: string, marcado: boolean) => {
    const nuevo = new Set(ciudades)
    if (marcado) nuevo.add(nombre)
    else nuevo.delete(nombre)
    // Se conserva el orden de la lista original.
    setCiudades(CIUDADES.map((c) => c.nombre).filter((n) => nuevo.has(n)))
  }

  const peticiones = extraccion
    ? extraccion.ciudades.map((c) => extraccion.peticiones[c])
    : []
  const procesadas = peticiones.filter(
    (p) => p.estado === "completada" || p.estado === "error"
  ).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Configuración de la extracción</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1fr_1.2fr]">
        <fieldset className="grid grid-cols-1 gap-2">
          <legend className="mb-2 text-sm font-medium">Ciudades</legend>
          {CIUDADES.map((c) => (
            <Label key={c.nombre} className="font-normal">
              <Checkbox
                checked={ciudades.includes(c.nombre)}
                onCheckedChange={(v) => alternar(c.nombre, v)}
                disabled={enCurso}
              />
              {c.nombre}
              <span className="text-xs text-muted-foreground tabular-nums">
                ({c.latitud}, {c.longitud})
              </span>
            </Label>
          ))}
        </fieldset>

        <div className="grid content-start gap-3">
          <div className="grid grid-cols-1 gap-1.5">
            <Label htmlFor="fecha-inicio">Fecha inicial (UTC)</Label>
            <Input
              id="fecha-inicio"
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              disabled={enCurso}
            />
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            <Label htmlFor="fecha-fin">Fecha final (UTC, incluida)</Label>
            <Input
              id="fecha-fin"
              type="date"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
              disabled={enCurso}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Máximo {MAX_DIAS_EXTRACCION} días por extracción. Los últimos días
            pueden llegar con valores nulos: el archivo histórico se completa
            con unos días de retraso.
          </p>
        </div>

        <div className="grid content-start gap-3">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="mb-1 font-medium">Volumen previsto</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
              <dt className="text-muted-foreground">Peticiones</dt>
              <dd>{ciudades.length} (una por ciudad)</dd>
              <dt className="text-muted-foreground">Días</dt>
              <dd>{dias && dias > 0 ? dias : "—"}</dd>
              <dt className="text-muted-foreground">Registros horarios</dt>
              <dd>
                {formatoEntero(previstos)}{" "}
                <span className="text-muted-foreground">
                  ({ciudades.length} × {formatoEntero(horas)} h)
                </span>
              </dd>
              <dt className="text-muted-foreground">Lotes de carga</dt>
              <dd>
                hasta {Math.ceil(previstos / TAMANO_LOTE)} de {TAMANO_LOTE}
              </dd>
            </dl>
          </div>
          {errores.length > 0 && (
            <ul
              role="alert"
              className="list-inside list-disc text-sm text-destructive"
            >
              {errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          <Button
            size="lg"
            onClick={onExtraer}
            disabled={enCurso || errores.length > 0}
          >
            <DownloadCloudIcon data-icon="inline-start" />
            {enCurso ? "Extrayendo…" : "Extraer datos"}
          </Button>
        </div>

        {extraccion && (
          <div className="lg:col-span-3">
            <p className="mb-2 text-sm" aria-live="polite">
              Peticiones: {procesadas} de {peticiones.length} procesadas ·{" "}
              {peticiones.length - procesadas} pendientes · periodo{" "}
              {extraccion.inicio} → {extraccion.fin}
            </p>
            <ul className="flex flex-wrap gap-2">
              {peticiones.map((p) => (
                <li
                  key={p.ciudad}
                  className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm"
                >
                  <span className="font-medium">{p.ciudad}</span>
                  <EstadoEtiqueta
                    estado={p.estado}
                    texto={
                      p.estado === "completada"
                        ? "Descargada"
                        : p.estado === "error"
                          ? "Error"
                          : undefined
                    }
                  />
                  {p.duracionMs !== undefined && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatoDuracion(p.duracionMs)}
                    </span>
                  )}
                  {p.estado === "error" && (
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => onReintentar(p.ciudad)}
                      disabled={enCurso}
                    >
                      <RotateCcwIcon data-icon="inline-start" />
                      Reintentar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {peticiones
              .filter((p) => p.estado === "error")
              .map((p) => (
                <p key={p.ciudad} className="mt-2 text-sm text-destructive">
                  {p.ciudad}: {p.error}
                </p>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
