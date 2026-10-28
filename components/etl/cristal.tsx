"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Cristal líquido con liquidGL (https://github.com/naughtyduk/liquidGL, MIT).
 *
 * liquidGL refracta lo que hay DETRÁS de la lente y su tinte se multiplica
 * por ello, así que sobre el fondo negro de la web el cristal se vería oscuro.
 * Por eso cada botón lleva tres capas:
 *   1. un fondo morado (`fondo-lente`), que es lo que el cristal refracta;
 *   2. la lente de liquidGL (pone `pointer-events: none` en su elemento);
 *   3. el botón, encima, transparente y clicable.
 * Antes de que cargue WebGL (o si no está disponible) la lente muestra el
 * degradado CSS de `fondo-morado`.
 */

type Lente = {
  el: HTMLElement
  destroy: () => void
  setTint: (color: string | null) => void
}

// La capa de cristal y el botón tienen que quedar por encima del lienzo de
// liquidGL; todas las lentes deben compartir el mismo z-index.
export const Z_CRISTAL = 10

// El tinte solo se usa para apagar el cristal cuando el botón está desactivado.
const TINTE_APAGADO = "rgba(70, 66, 90, 0.6)"

let lentes: Lente[] = []
let temporizador: ReturnType<typeof setTimeout> | undefined
let generacion = 0

// Tinte de cada lente: apagado si su botón está desactivado; si no, el que
// indique su atributo data-tinte (p. ej. cristal ahumado sobre el mapa).
const tinteDe = (el: HTMLElement) =>
  el.dataset.apagado === "true" ? TINTE_APAGADO : (el.dataset.tinte ?? null)

/*
 * Las vetas de luz del cristal se deslizan al hacer scroll, como el reflejo de
 * una lámpara que recorre un vidrio al moverlo. El desplazamiento de la página
 * se publica en la variable CSS --desplazamiento-pagina (una vez por
 * fotograma). Con «reducir movimiento» no se escucha el scroll.
 */
let escuchandoScroll = false
function escucharScroll() {
  if (escuchandoScroll) return
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return
  escuchandoScroll = true
  let pendiente = false
  const publicar = () => {
    pendiente = false
    document.documentElement.style.setProperty(
      "--desplazamiento-pagina",
      String(Math.round(window.scrollY))
    )
  }
  window.addEventListener(
    "scroll",
    () => {
      if (pendiente) return
      pendiente = true
      requestAnimationFrame(publicar)
    },
    { passive: true }
  )
  publicar()
}

/**
 * Rehace todas las lentes: cuando aparecen o desaparecen capas de cristal, o
 * cuando cambia lo que tienen detrás (p. ej. las provincias marcadas).
 */
export function programar() {
  clearTimeout(temporizador)
  temporizador = setTimeout(() => void reconstruir(), 150)
}

async function reconstruir() {
  const esta = ++generacion
  const { default: liquidGL } = await import("liquid-gl")
  if (esta !== generacion || !liquidGL) return

  for (const lente of lentes) lente.destroy()
  lentes = []
  if (!document.querySelector("[data-cristal]")) return
  // La ondulación que sigue al ratón se desactiva si se pide menos movimiento.
  const conMovimiento = !matchMedia("(prefers-reduced-motion: reduce)").matches

  // Cada botón captura solo SU fondo, no la página entera: así el bisel no
  // arrastra el negro de alrededor y la captura es pequeña, lo que permite una
  // resolución alta sin coste. Las lentes del mapa capturan el mapa
  // (data-captura) para refractar las provincias que tienen detrás; las que
  // comparten captura comparten también un único lienzo WebGL.
  for (const el of document.querySelectorAll<HTMLElement>("[data-cristal]")) {
    const id = el.dataset.cristal
    // Las lentes del mapa refractan líneas finas: sin aberración (deja bordes
    // irisados), menos refracción y sin ondulación.
    const enMapa = el.dataset.captura !== undefined
    const resultado = liquidGL({
      target: `[data-cristal="${id}"]`,
      snapshot: el.dataset.captura ?? `[data-fondo-cristal="${id}"]`,
      zIndex: Z_CRISTAL,
      resolution: 3,
      content: false,
      // Bisel contenido (más profundo partía en trozos lo que refracta) y un
      // poco de aberración cromática, con bordes irisados como un prisma.
      refraction: enMapa ? 0.02 : 0.035,
      bevelDepth: 0.28,
      bevelWidth: 0.3,
      aberration: enMapa ? 0 : 0.06,
      frost: 0,
      // El brillo lo dan el relieve CSS y el reflejo del ratón; el
      // especular animado de liquidGL dejaba una mancha en el centro.
      specular: false,
      shadow: false,
      // Sin fundido: al rehacer las lentes (p. ej. al marcar una provincia)
      // los botones no parpadean.
      reveal: "none",
      interaction: conMovimiento && !enMapa ? "fluid" : "none",
      interactionStrength: 0.6,
      interactionRadius: 0.45,
    })
    for (const lente of [resultado].flat()) {
      if (!lente) continue
      lente.setTint(tinteDe(lente.el))
      lentes.push(lente)
    }
  }
}

/**
 * Hace que un reflejo siga al ratón sin retardo. `mover` aplica la última
 * posición en el siguiente fotograma (como mucho una vez por fotograma, aunque
 * lleguen varios eventos); `saltar` la aplica en el acto.
 */
export function useSeguimientoRaton(aplicar: (x: number, y: number) => void) {
  const posicion = React.useRef({ x: 0, y: 0 })
  const fotograma = React.useRef<number | null>(null)

  React.useEffect(
    () => () => {
      if (fotograma.current !== null) cancelAnimationFrame(fotograma.current)
    },
    []
  )

  const saltar = (x: number, y: number) => {
    posicion.current = { x, y }
    aplicar(x, y)
  }
  const mover = (x: number, y: number) => {
    posicion.current = { x, y }
    if (fotograma.current !== null) return
    fotograma.current = requestAnimationFrame(() => {
      fotograma.current = null
      aplicar(posicion.current.x, posicion.current.y)
    })
  }
  return { mover, saltar }
}

/** Silueta de la flecha del ratón (13 × 19 px), para su reflejo. */
export const FLECHA_CURSOR =
  "M0 0 L0 16 L4.2 12.2 L7 18.5 L9.6 17.4 L6.9 11.2 L12.4 11.2 Z"

/** Envuelve un botón para ponerle detrás una lente de cristal líquido. */
export function Cristal({
  apagado = false,
  tono = "morado",
  className,
  children,
}: {
  /** Cristal desaturado, para cuando el botón está desactivado. */
  apagado?: boolean
  /** Morado (acción principal) o transparente sin tinte (secundaria). */
  tono?: "morado" | "claro"
  className?: string
  children: React.ReactNode
}) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const refEnvoltura = React.useRef<HTMLSpanElement>(null)

  // Reflejo de luz que sigue al cursor sobre el cristal.
  const reflejo = useSeguimientoRaton((x, y) => {
    refEnvoltura.current?.style.setProperty("--reflejo-x", `${x}px`)
    refEnvoltura.current?.style.setProperty("--reflejo-y", `${y}px`)
  })
  const posicion = (e: React.PointerEvent<HTMLSpanElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }
  // Identificador válido en un selector CSS (useId devuelve p. ej. «:r1:»).
  const id = "c" + React.useId().replace(/[^a-zA-Z0-9]/g, "")

  React.useEffect(() => {
    escucharScroll()
    programar()
    return programar
  }, [])

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    el.dataset.apagado = String(apagado)
    lentes.find((l) => l.el === el)?.setTint(tinteDe(el))
  }, [apagado])

  return (
    <span
      ref={refEnvoltura}
      onPointerEnter={(e) => reflejo.saltar(...posicion(e))}
      onPointerMove={(e) => reflejo.mover(...posicion(e))}
      className={cn("group/cristal relative grid", className)}
    >
      <span
        aria-hidden
        data-fondo-cristal={id}
        className={cn(
          "pointer-events-none absolute inset-0 rounded-lg",
          tono === "claro" ? "fondo-lente-claro" : "fondo-lente"
        )}
      />
      <span
        ref={ref}
        aria-hidden
        data-cristal={id}
        className="pointer-events-none absolute inset-0 rounded-lg fondo-morado"
        style={{ zIndex: Z_CRISTAL }}
      />
      {/* data-liquid-ignore: el texto del botón no entra en la captura que
          refracta el cristal (si no, aparecería duplicado y deformado). */}
      <span
        data-liquid-ignore=""
        // Filo de luz arriba y contorno sutil: lo que hace que se lea como
        // cristal (son sombras internas, no un borde).
        className="relieve-cristal relative grid rounded-lg"
        style={{ zIndex: Z_CRISTAL + 1 }}
      >
        <span
          aria-hidden
          className={cn(
            "reflejo-cristal pointer-events-none absolute inset-0 overflow-hidden rounded-lg opacity-0 transition-opacity duration-300",
            !apagado && "group-hover/cristal:opacity-100"
          )}
        >
          {/* Silueta del cursor reflejada en el vidrio: tenue, desenfocada y
              algo desplazada respecto al puntero. */}
          <svg
            viewBox="0 0 13 19"
            className="silueta-cursor absolute top-0 left-0 h-[19px] w-[13px]"
          >
            <path d={FLECHA_CURSOR} fill="#fff" />
          </svg>
        </span>
        {/* El texto, por encima del reflejo. */}
        <span className="relative grid">{children}</span>
      </span>
    </span>
  )
}
