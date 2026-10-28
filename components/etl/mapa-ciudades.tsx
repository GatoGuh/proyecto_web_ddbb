"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
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
import {
  FLECHA_CURSOR,
  programar,
  useSeguimientoRaton,
  Z_CRISTAL,
} from "./cristal"

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

// Reflejo del ratón en el vidrio de la provincia: un punto de luz que sigue al
// cursor e ilumina el relieve (lejos y arriba a la izquierda en reposo) y la
// silueta del puntero, tenue y difuminada.
const LUZ_REPOSO = { x: -150, y: -200, z: 260 }
const LUZ_CERCA = 120
const SILUETA_DESPLAZAMIENTO_PX = { x: 5, y: 4 }

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
 * quita de la descarga. Al pasar por encima aparece su resumen en una tarjeta
 * de cristal líquido que refracta el mapa; las etiquetas de las ciudades son
 * también pequeñas lentes de cristal.
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
  const idVidrio = React.useId()
  const idRecorte = React.useId()
  const idDesenfoque = React.useId()
  const refLuz = React.useRef<SVGFEPointLightElement>(null)
  const refSilueta = React.useRef<SVGGElement | null>(null)
  // Cuántas unidades del SVG mide un píxel de pantalla (el mapa se escala).
  const unidadPorPx = React.useRef(1)
  const ultima = React.useRef({ x: LUZ_REPOSO.x, y: LUZ_REPOSO.y })

  const colocarReflejo = (x: number, y: number) => {
    ultima.current = { x, y }
    const k = unidadPorPx.current
    refLuz.current?.setAttribute("x", String(x))
    refLuz.current?.setAttribute("y", String(y))
    refSilueta.current?.setAttribute(
      "transform",
      `translate(${x + SILUETA_DESPLAZAMIENTO_PX.x * k} ${y + SILUETA_DESPLAZAMIENTO_PX.y * k}) scale(${k})`
    )
  }
  const reflejo = useSeguimientoRaton(colocarReflejo)
  const enSvg = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget
    const ancho = svg.getBoundingClientRect().width
    if (ancho > 0) unidadPorPx.current = MAPA_ANCHO / ancho
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      svg.getScreenCTM()?.inverse()
    )
    return [p.x, p.y] as const
  }
  const entrar = (e: React.PointerEvent<SVGSVGElement>) => {
    refLuz.current?.setAttribute("z", String(LUZ_CERCA))
    reflejo.saltar(...enSvg(e))
  }
  const salir = () => {
    refLuz.current?.setAttribute("z", String(LUZ_REPOSO.z))
    reflejo.saltar(LUZ_REPOSO.x, LUZ_REPOSO.y)
  }
  // La silueta se monta al entrar en una provincia: se coloca al instante.
  const montarSilueta = (el: SVGGElement | null) => {
    refSilueta.current = el
    if (el) colocarReflejo(ultima.current.x, ultima.current.y)
  }
  // Las lentes del mapa capturan este contenedor para refractar el mapa.
  const idMapa = "m" + React.useId().replace(/[^a-zA-Z0-9]/g, "")
  const captura = `[data-mapa="${idMapa}"]`
  // Al marcar o desmarcar una provincia cambia lo que hay detrás de las
  // lentes: se rehacen para que refracten el mapa actualizado.
  const claveSeleccion = seleccionadas.join("|")
  React.useEffect(() => {
    programar()
    return programar
  }, [claveSeleccion])

  const pulsar = (ciudad: string) => {
    if (!bloqueado) onAlternar(ciudad)
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      <div data-mapa={idMapa} className="relative">
        <svg
          onPointerEnter={entrar}
          onPointerMove={(e) => reflejo.mover(...enSvg(e))}
          onPointerLeave={salir}
          viewBox={`0 0 ${MAPA_ANCHO} ${MAPA_ALTO}`}
          className="h-auto w-full"
          role="group"
          aria-label="Mapa de España. Las provincias de las cinco ciudades son botones para añadirlas o quitarlas de la descarga."
        >
          <defs>
            <linearGradient id={idDegradado} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--cristal-a)" />
              <stop offset="55%" stopColor="var(--cristal-b)" />
              <stop offset="100%" stopColor="var(--cristal-c)" />
            </linearGradient>
            <filter
              id={idDesenfoque}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="1.4" />
            </filter>
            {/* Vidrio líquido que sigue la silueta de cada provincia: relieve
              iluminado desde arriba a la izquierda, filo de luz en el borde
              interior y una sombra interior abajo. */}
            <filter
              id={idVidrio}
              x="-10%"
              y="-10%"
              width="120%"
              height="120%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur
                in="SourceAlpha"
                stdDeviation="2.5"
                result="relieve"
              />
              <feSpecularLighting
                in="relieve"
                surfaceScale="3"
                specularConstant="0.28"
                specularExponent="20"
                lightingColor="#ffffff"
                result="brillo"
              >
                <fePointLight
                  ref={refLuz}
                  x={LUZ_REPOSO.x}
                  y={LUZ_REPOSO.y}
                  z={LUZ_REPOSO.z}
                />
              </feSpecularLighting>
              <feComposite
                in="brillo"
                in2="SourceAlpha"
                operator="in"
                result="brilloDentro"
              />
              <feMorphology
                in="SourceAlpha"
                operator="erode"
                radius="1.2"
                result="interior"
              />
              <feComposite
                in="SourceAlpha"
                in2="interior"
                operator="out"
                result="filo"
              />
              <feFlood floodColor="#ffffff" floodOpacity="0.45" />
              <feComposite in2="filo" operator="in" result="filoClaro" />
              <feOffset in="SourceAlpha" dy="-3" result="desplazada" />
              <feComposite
                in="SourceAlpha"
                in2="desplazada"
                operator="out"
                result="bordeInferior"
              />
              <feGaussianBlur
                in="bordeInferior"
                stdDeviation="1.5"
                result="bordeSuave"
              />
              <feFlood floodColor="#1d1238" floodOpacity="0.45" />
              <feComposite
                in2="bordeSuave"
                operator="in"
                result="sombraInterior"
              />
              <feMerge>
                <feMergeNode in="SourceGraphic" />
                <feMergeNode in="sombraInterior" />
                <feMergeNode in="brilloDentro" />
                <feMergeNode in="filoClaro" />
              </feMerge>
            </filter>
          </defs>

          {/* Provincias sin interacción */}
          <g aria-hidden>
            {PROVINCIAS.filter((p) => !CIUDAD_DE_PROVINCIA.has(p.id)).map(
              (p) => (
                <path
                  key={p.id}
                  d={p.d}
                  fill="var(--mapa-provincia)"
                  stroke="var(--mapa-borde)"
                  strokeWidth={0.6}
                  strokeLinejoin="round"
                />
              )
            )}
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
                  stroke={marcada ? "#a99bdc" : "var(--mapa-disponible-borde)"}
                  // Solo las provincias marcadas son de cristal: así se
                  // distinguen a simple vista de las no marcadas.
                  filter={marcada ? `url(#${idVidrio})` : undefined}
                  strokeWidth={marcada ? 1.2 : 1}
                  strokeDasharray={estado === "error" ? "4 3" : undefined}
                  strokeLinejoin="round"
                />
                {/* El reflejo solo en la provincia que tiene el ratón encima. */}
                {marcada && enfocada === c.nombre && (
                  <g pointerEvents="none" clipPath={`url(#${idRecorte})`}>
                    <clipPath id={idRecorte}>
                      <path d={provincia.d} />
                    </clipPath>
                    <g ref={montarSilueta}>
                      <path
                        d={FLECHA_CURSOR}
                        fill="#fff"
                        opacity={0.26}
                        filter={`url(#${idDesenfoque})`}
                      />
                    </g>
                  </g>
                )}
              </g>
            )
          })}
        </svg>

        {/* Etiquetas y tarjeta: HTML encima del SVG, sin capturar el ratón. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {CIUDADES.map((c) => {
            const estado = estados[c.nombre]
            return (
              <EtiquetaCristal
                key={c.nombre}
                ciudad={c.nombre}
                texto={estado === "error" ? `${c.nombre} · error` : c.nombre}
                marcada={seleccionadas.includes(c.nombre)}
                // Con la tarjeta abierta solo se ve la etiqueta de su ciudad,
                // para que ninguna otra quede encima de la tarjeta.
                oculta={enfocada !== null && enfocada !== c.nombre}
                // En móvil la tarjeta ocupa el ancho del mapa: también se
                // aparta la etiqueta de su ciudad.
                bajoTarjetaEnMovil={enfocada === c.nombre}
                captura={captura}
              />
            )
          })}
        </div>
        <TarjetaCiudad
          ciudad={enfocada}
          marcada={enfocada ? seleccionadas.includes(enfocada) : false}
          estado={enfocada ? estados[enfocada] : undefined}
          datos={enfocada ? resumen.get(enfocada) : undefined}
          captura={captura}
        />
      </div>

      <p className="rounded-md solido px-3 py-2 text-sm text-muted-foreground">
        Pulsa una provincia resaltada para añadirla o quitarla de la descarga.
        Pasa el ratón por encima para ver su resumen.
      </p>
    </div>
  )
}

// Cristal ahumado de las lentes del mapa: oscurece lo que refractan para que
// el texto blanco se lea bien encima.
const TINTE_MAPA = "rgba(22, 18, 38, 0.6)"

/** Posición en % del contenedor del mapa a partir de coordenadas del SVG. */
// Sin transform: un transform crearía un contexto de apilamiento y el texto
// quedaría por debajo del lienzo de liquidGL. Por eso se ancla con
// left/right/top/bottom.
const pctX = (x: number) => (x / MAPA_ANCHO) * 100
const pctY = (y: number) => (y / MAPA_ALTO) * 100

/**
 * Lente de cristal (liquidGL) que refracta el mapa, con su contenido encima.
 * El contenido lleva data-liquid-ignore para no aparecer dentro de la lente.
 */
function LenteMapa({
  captura,
  redondeo,
  plana = false,
  className,
  children,
  ...resto
}: {
  captura: string
  redondeo: string
  /** Bisel fino y apenas refracción (ver cristal.tsx). */
  plana?: boolean
  className?: string
  children: React.ReactNode
} & Omit<React.ComponentProps<"span">, "children">) {
  const id = "l" + React.useId().replace(/[^a-zA-Z0-9]/g, "")
  return (
    <span className={cn("absolute", className)} {...resto}>
      <span
        data-cristal={id}
        data-captura={captura}
        data-tinte={TINTE_MAPA}
        data-plana={plana || undefined}
        className={cn("absolute inset-0 bg-background", redondeo)}
        style={{ zIndex: Z_CRISTAL }}
      />
      <span
        data-liquid-ignore=""
        className={cn("relieve-cristal relative block", redondeo)}
        style={{ zIndex: Z_CRISTAL + 1 }}
      >
        {children}
      </span>
    </span>
  )
}

/** Nombre de la ciudad sobre el mapa, en una píldora de cristal. */
function EtiquetaCristal({
  ciudad,
  texto,
  marcada,
  oculta,
  bajoTarjetaEnMovil,
  captura,
}: {
  ciudad: string
  texto: string
  marcada: boolean
  /** Se oculta con una transición (sin desmontarla: su lente se conserva). */
  oculta: boolean
  bajoTarjetaEnMovil: boolean
  captura: string
}) {
  const { x, y } = POSICION_CIUDADES[ciudad]
  // Barcelona queda pegada al borde derecho: su etiqueta va a la izquierda.
  // Bizkaia es pequeña: la etiqueta de Bilbao se aparta para no taparla.
  const izquierda = x > MAPA_ANCHO - 120
  const desplazamiento = ciudad === "Bilbao" ? 30 : 0
  const ancla = izquierda ? x + 8 : x - 8 + desplazamiento
  return (
    <LenteMapa
      captura={captura}
      redondeo="rounded-md"
      // Al ocultarse, el cristal se encoge y el texto se desvanece (ver
      // .etiqueta-mapa en globals.css) en lugar de desaparecer de golpe.
      className="etiqueta-mapa whitespace-nowrap"
      data-oculta={oculta}
      data-bajo-tarjeta={bajoTarjetaEnMovil}
      // Centrada en vertical (la píldora mide 24 px de alto).
      style={{
        ...(izquierda
          ? { right: `${100 - pctX(ancla)}%` }
          : { left: `${pctX(ancla)}%` }),
        top: `calc(${pctY(y)}% - 12px)`,
      }}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 text-sm font-semibold",
          marcada ? "text-white" : "text-zinc-400"
        )}
      >
        <span
          aria-hidden
          className="size-2 rounded-full"
          style={{ background: colorCiudad(ciudad) }}
        />
        {texto}
      </span>
    </LenteMapa>
  )
}

/**
 * Resumen de la ciudad bajo el ratón (o el foco) en una tarjeta de cristal que
 * refracta el mapa. Siempre está montada para que su lente no se rehaga en
 * cada provincia; sin ciudad se aparta fuera de la vista.
 */
function TarjetaCiudad({
  ciudad,
  marcada,
  estado,
  datos,
  captura,
}: {
  ciudad: string | null
  marcada: boolean
  estado?: EstadoPeticion
  datos?: ResumenCiudad
  captura: string
}) {
  const pos = ciudad ? POSICION_CIUDADES[ciudad] : null
  // Debajo de la etiqueta, salvo en el sur del mapa (encima); hacia la
  // izquierda en el borde derecho (Barcelona).
  const encima = pos ? pos.y > MAPA_ALTO * 0.6 : false
  const izquierda = pos ? pos.x > MAPA_ANCHO - 200 : false
  return (
    <LenteMapa
      captura={captura}
      redondeo="rounded-lg"
      // En el móvil la tarjeta es ancha y baja: con el bisel normal, su borde
      // deformaba las provincias de debajo (Sevilla salía duplicada).
      plana
      className={cn(
        "pointer-events-none w-64",
        // En pantallas estrechas no cabe junto a la provincia: va a lo ancho
        // en la parte baja del mapa.
        pos &&
          "max-sm:!top-auto max-sm:!right-2 max-sm:!bottom-2 max-sm:!left-2 max-sm:!w-auto"
      )}
      style={
        pos
          ? {
              ...(izquierda
                ? { right: `${100 - pctX(pos.x + 8)}%` }
                : { left: `${pctX(pos.x - 8)}%` }),
              ...(encima
                ? { bottom: `calc(${100 - pctY(pos.y)}% + 20px)` }
                : { top: `calc(${pctY(pos.y)}% + 20px)` }),
            }
          : { left: "-9999px", top: 0 }
      }
    >
      <span className="block px-3 py-2.5 text-sm" aria-live="polite">
        {ciudad && (
          <>
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-base font-semibold text-white">
                {ciudad}
              </span>
              <span className="text-zinc-300">
                {marcada ? "Incluida" : "No incluida"}
              </span>
            </span>
            {estado && (
              <span className="block text-zinc-300">
                {TEXTO_ESTADO[estado]}
              </span>
            )}
            {datos ? (
              <span className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
                <Dato
                  valor={formatoEntero(datos.registros)}
                  texto="registros"
                />
                <Dato
                  valor={`${formatoDecimal(datos.tempMedia)} °C`}
                  texto={`${formatoDecimal(datos.tempMin)} a ${formatoDecimal(datos.tempMax)} °C`}
                />
                <Dato
                  valor={`${formatoDecimal(datos.humedadMedia)} %`}
                  texto="humedad media"
                />
                <Dato
                  valor={`${formatoDecimal(datos.lluviaTotal)} mm`}
                  texto={`de lluvia, ${datos.horasConLluvia} h`}
                />
              </span>
            ) : (
              <span className="mt-1 block text-zinc-300">
                Pulsa para {marcada ? "quitarla de" : "añadirla a"} la descarga.
              </span>
            )}
          </>
        )}
      </span>
    </LenteMapa>
  )
}

function Dato({ valor, texto }: { valor: string; texto: string }) {
  return (
    <span className="grid">
      <span className="font-semibold text-white">{valor}</span>
      <span className="text-zinc-300">{texto}</span>
    </span>
  )
}
