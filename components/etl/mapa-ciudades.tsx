"use client"

import { useTheme } from "next-themes"
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
} from "react-leaflet"
import { CIUDADES, colorCiudad } from "@/lib/etl/ciudades"
import type { ResumenCiudad } from "@/lib/etl/resumen"
import type { EstadoPeticion } from "@/hooks/use-extraccion"
import { formatoDecimal, formatoEntero } from "./comun"

const TEXTO_ESTADO: Record<EstadoPeticion, string> = {
  pendiente: "Pendiente de descarga",
  en_curso: "Descargando…",
  completada: "Descargada",
  error: "Error en la descarga",
}

export type PropsMapa = {
  seleccionadas: string[]
  onAlternar: (ciudad: string) => void
  bloqueado: boolean
  estados: Record<string, EstadoPeticion | undefined>
  resumen: Map<string, ResumenCiudad>
}

/** Mapa de España con las ciudades disponibles. Un clic selecciona o quita. */
export default function MapaCiudades({
  seleccionadas,
  onAlternar,
  bloqueado,
  estados,
  resumen,
}: PropsMapa) {
  const { resolvedTheme } = useTheme()
  const oscuro = resolvedTheme === "dark"
  // Teselas estándar de OpenStreetMap (sin clave). En modo oscuro se
  // oscurecen con un filtro CSS (ver globals.css).
  const teselas = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"

  return (
    <MapContainer
      center={[40.1, -3.4]}
      zoom={5}
      minZoom={4}
      maxZoom={9}
      scrollWheelZoom={false}
      className="h-full min-h-[280px] w-full"
      attributionControl
    >
      <TileLayer
        url={teselas}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {CIUDADES.map((c) => {
        const marcada = seleccionadas.includes(c.nombre)
        const color = colorCiudad(c.nombre)
        const estado = estados[c.nombre]
        const datos = resumen.get(c.nombre)
        return (
          <CircleMarker
            key={`${c.nombre}-${marcada}-${oscuro}`}
            center={[c.latitud, c.longitud]}
            radius={marcada ? 11 : 8}
            pathOptions={{
              // El anillo del color de la superficie separa el punto del mapa.
              color: marcada ? (oscuro ? "#0a1120" : "#ffffff") : color,
              weight: marcada ? 3 : 2.5,
              fillColor: marcada ? color : oscuro ? "#111a2c" : "#ffffff",
              fillOpacity: 1,
              dashArray: estado === "error" ? "4 3" : undefined,
            }}
            eventHandlers={{
              // Antes de descargar, el clic selecciona. Después abre el resumen,
              // que incluye su propio botón para añadir o quitar.
              click: () => {
                if (!bloqueado && !estado) onAlternar(c.nombre)
              },
            }}
          >
            <Tooltip
              permanent
              direction="right"
              offset={[10, 0]}
              className="etiqueta-ciudad"
              opacity={marcada ? 1 : 0.75}
            >
              {c.nombre}
              {estado === "error" ? " · error" : ""}
            </Tooltip>
            {(datos || estado) && (
              <Popup>
                <div className="grid gap-1 text-sm">
                  <p className="font-semibold">{c.nombre}</p>
                  {estado && (
                    <p className="text-muted-foreground">
                      {TEXTO_ESTADO[estado]}
                    </p>
                  )}
                  {datos && (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 tabular-nums">
                      <dt className="text-muted-foreground">
                        Registros válidos
                      </dt>
                      <dd>{formatoEntero(datos.registros)}</dd>
                      <dt className="text-muted-foreground">Temp. media</dt>
                      <dd>{formatoDecimal(datos.tempMedia)} °C</dd>
                      <dt className="text-muted-foreground">Mín. / máx.</dt>
                      <dd>
                        {formatoDecimal(datos.tempMin)} /{" "}
                        {formatoDecimal(datos.tempMax)} °C
                      </dd>
                      <dt className="text-muted-foreground">Humedad media</dt>
                      <dd>{formatoDecimal(datos.humedadMedia)} %</dd>
                      <dt className="text-muted-foreground">Lluvia total</dt>
                      <dd>
                        {formatoDecimal(datos.lluviaTotal)} mm (
                        {datos.horasConLluvia} h)
                      </dd>
                    </dl>
                  )}
                  {!bloqueado && (
                    <button
                      type="button"
                      className="mt-1 text-left text-xs font-medium text-primary underline-offset-2 hover:underline"
                      onClick={() => onAlternar(c.nombre)}
                    >
                      {marcada
                        ? "Quitar de la descarga"
                        : "Añadir a la descarga"}
                    </button>
                  )}
                </div>
              </Popup>
            )}
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
