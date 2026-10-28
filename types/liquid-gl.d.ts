// Tipos mínimos de liquid-gl (el paquete no incluye declaraciones).
declare module "liquid-gl" {
  type Lente = {
    el: HTMLElement
    destroy: () => void
    setTint: (color: string | null) => void
    setDraggable: (activo: boolean) => void
  }

  type Opciones = {
    target: string
    snapshot?: string
    resolution?: number
    engine?: "auto" | "webgpu" | "webgl2" | "webgl"
    zIndex?: number
    content?: string | false
    refraction?: number
    aberration?: number
    bevelDepth?: number
    bevelWidth?: number
    frost?: number
    shadow?: boolean
    specular?: boolean
    reveal?: "none" | "fade"
    tilt?: boolean
    tiltFactor?: number
    tiltEase?: number
    draggable?: boolean
    magnify?: number
    interaction?: "none" | "fluid"
    interactionStrength?: number
    interactionRadius?: number
    interactionViscosity?: number
    tint?: string | null
    on?: { init?: (lente: Lente) => void }
  }

  // En el servidor el módulo exporta undefined.
  const liquidGL:
    ((opciones: Opciones) => Lente | Lente[] | undefined) | undefined
  export default liquidGL
}
