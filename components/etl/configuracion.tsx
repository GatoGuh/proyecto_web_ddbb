"use client"

import { DownloadCloudIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CIUDADES, colorCiudad } from "@/lib/etl/ciudades"
import {
  diasInclusivos,
  MAX_DIAS_EXTRACCION,
  validarConfiguracion,
} from "@/lib/etl/open-meteo"
import type { ResumenCiudad } from "@/lib/etl/resumen"
import type { Extraccion } from "@/hooks/use-extraccion"
import {
  ChipCiudad,
  EstadoEtiqueta,
  formatoDuracion,
  formatoEntero,
} from "./comun"
import { MapaCiudades } from "./mapa-ciudades"
import { Seccion } from "./seccion"

export function Configuracion({
  ciudades,
  setCiudades,
  inicio,
  setInicio,
  fin,
  setFin,
  extraccion,
  enCurso,
  resumen,
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
  resumen: Map<string, ResumenCiudad>
  onExtraer: () => void
  onReintentar: (ciudad: string) => void
}) {
  const errores = validarConfiguracion(ciudades, inicio, fin)
  const dias = diasInclusivos(inicio, fin)
  const horas = dias && dias > 0 ? dias * 24 : 0
  const previstos = horas * ciudades.length

  const alternar = (nombre: string) => {
    const nuevo = new Set(ciudades)
    if (nuevo.has(nombre)) nuevo.delete(nombre)
    else nuevo.add(nombre)
    // Se conserva el orden de la lista original.
    setCiudades(CIUDADES.map((c) => c.nombre).filter((n) => nuevo.has(n)))
  }

  const peticiones = extraccion
    ? extraccion.ciudades.map((c) => extraccion.peticiones[c])
    : []
  const procesadas = peticiones.filter(
    (p) => p.estado === "completada" || p.estado === "error"
  ).length
  const estados = Object.fromEntries(
    peticiones.map((p) => [p.ciudad, p.estado])
  )
  const fallidas = peticiones.filter((p) => p.estado === "error")

  return (
    <Seccion
      id="paso-descarga"
      numero={1}
      titulo="Elige qué descargar"
      descripcion="Pulsa las provincias resaltadas del mapa para elegir ciudades, ajusta las fechas y descarga los datos horarios de Open-Meteo."
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-lg border bg-card p-2 sm:p-4">
            <MapaCiudades
              seleccionadas={ciudades}
              onAlternar={alternar}
              bloqueado={enCurso}
              estados={estados}
              resumen={resumen}
            />
          </div>
          <div>
            <p
              className="mb-2 text-sm text-muted-foreground"
              id="ayuda-ciudades"
            >
              Ciudades seleccionadas ({ciudades.length} de {CIUDADES.length}).
              También puedes elegirlas aquí:
            </p>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-describedby="ayuda-ciudades"
            >
              {CIUDADES.map((c) => (
                <ChipCiudad
                  key={c.nombre}
                  ciudad={c.nombre}
                  color={colorCiudad(c.nombre)}
                  marcada={ciudades.includes(c.nombre)}
                  disabled={enCurso}
                  onClick={() => alternar(c.nombre)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 content-start gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="fecha-inicio">Desde</Label>
              <Input
                id="fecha-inicio"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                disabled={enCurso}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fecha-fin">Hasta (incluido)</Label>
              <Input
                id="fecha-fin"
                type="date"
                value={fin}
                onChange={(e) => setFin(e.target.value)}
                disabled={enCurso}
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Fechas en hora UTC. Máximo {MAX_DIAS_EXTRACCION} días por descarga.
          </p>

          {errores.length > 0 && (
            <ul role="alert" className="grid gap-1 text-sm text-destructive">
              {errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          <Button
            size="lg"
            className="h-11 border-0 fondo-morado text-base text-white"
            onClick={onExtraer}
            disabled={enCurso || errores.length > 0}
          >
            <DownloadCloudIcon data-icon="inline-start" />
            {enCurso ? "Descargando…" : "Descargar datos"}
          </Button>
          <p className="-mt-2 text-sm text-muted-foreground tabular-nums">
            {formatoEntero(previstos)} registros horarios ({ciudades.length}{" "}
            {ciudades.length === 1 ? "ciudad" : "ciudades"} ×{" "}
            {dias && dias > 0 ? dias : 0} días × 24 h)
          </p>

          {extraccion && (
            <div className="grid gap-2" aria-live="polite">
              <p className="text-sm font-medium">
                {procesadas} de {peticiones.length} ciudades procesadas
                {procesadas < peticiones.length &&
                  ` · faltan ${peticiones.length - procesadas}`}
              </p>
              <ul className="grid gap-1.5">
                {peticiones.map((p) => (
                  <li
                    key={p.ciudad}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ background: colorCiudad(p.ciudad) }}
                    />
                    <span className="w-20 font-medium">{p.ciudad}</span>
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
                    <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                      {p.duracionMs !== undefined &&
                        formatoDuracion(p.duracionMs)}
                    </span>
                  </li>
                ))}
              </ul>
              {fallidas.map((p) => (
                <div
                  key={p.ciudad}
                  className="flex flex-wrap items-center gap-2 rounded-md border caja-error p-2 text-sm"
                >
                  <span className="text-destructive">
                    {p.ciudad}: {p.error}
                  </span>
                  <Button
                    size="xs"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => onReintentar(p.ciudad)}
                    disabled={enCurso}
                  >
                    <RotateCcwIcon data-icon="inline-start" />
                    Reintentar {p.ciudad}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Seccion>
  )
}
