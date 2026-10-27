// Genera lib/etl/mapa-espana.ts: trazados SVG de las provincias de la
// península y Baleares (datos del IGN vía es-atlas) y la posición de las
// ciudades ya proyectada. Se ejecuta con: npm run generar:mapa
import { readFileSync, writeFileSync } from "node:fs"
import { geoConicConformal, geoPath } from "d3-geo"
import { feature, mesh } from "topojson-client"
import { presimplify, quantile, simplify } from "topojson-simplify"

const ANCHO = 600
const ALTO = 470
// Fuera del recuadro: Canarias (35, 38), Ceuta (51) y Melilla (52).
const EXCLUIDAS = new Set(["35", "38", "51", "52"])
// Provincia de cada ciudad del pipeline.
const CIUDADES = {
  Barcelona: { provincia: "08", coord: [2.1686, 41.3874] },
  Madrid: { provincia: "28", coord: [-3.7038, 40.4168] },
  Sevilla: { provincia: "41", coord: [-5.9845, 37.3891] },
  Bilbao: { provincia: "48", coord: [-2.935, 43.263] },
  Valencia: { provincia: "46", coord: [-0.3763, 39.4699] },
}

const original = JSON.parse(
  readFileSync(
    new URL("../node_modules/es-atlas/es/provinces.json", import.meta.url)
  )
)
// Simplificación topológica: conserva los bordes compartidos entre provincias.
const conPesos = presimplify(original)
const topo = simplify(conPesos, quantile(conPesos, 0.12))
const provincias = feature(topo, topo.objects.provinces).features.filter(
  (f) => !EXCLUIDAS.has(f.id)
)
const proyeccion = geoConicConformal()
  .rotate([3.5, 0])
  .parallels([36, 43.5])
  .fitExtent(
    [
      [8, 8],
      [ANCHO - 8, ALTO - 8],
    ],
    { type: "FeatureCollection", features: provincias }
  )
const ruta = geoPath(proyeccion).digits(1)

const salida = provincias.map((f) => ({
  id: f.id,
  nombre: f.properties.name,
  d: ruta(f),
}))
// Contorno exterior del conjunto (solo bordes que no se comparten).
const contorno = ruta(
  mesh(topo, topo.objects.provinces, (a, b) => a === b && !EXCLUIDAS.has(a.id))
)
const ciudades = Object.fromEntries(
  Object.entries(CIUDADES).map(([nombre, c]) => {
    const [x, y] = proyeccion(c.coord)
    return [
      nombre,
      { provincia: c.provincia, x: Math.round(x), y: Math.round(y) },
    ]
  })
)

const ts = `// Archivo generado por scripts/generar-mapa.mjs. No editar a mano.
// Fuente: Instituto Geográfico Nacional (es-atlas). Proyección cónica conforme.

export const MAPA_ANCHO = ${ANCHO}
export const MAPA_ALTO = ${ALTO}

export const PROVINCIAS: { id: string; nombre: string; d: string }[] = ${JSON.stringify(salida)}

export const CONTORNO = ${JSON.stringify(contorno)}

export const POSICION_CIUDADES: Record<
  string,
  { provincia: string; x: number; y: number }
> = ${JSON.stringify(ciudades, null, 2)}
`
writeFileSync(new URL("../lib/etl/mapa-espana.ts", import.meta.url), ts)
console.log(
  `Provincias: ${salida.length} · tamaño: ${(ts.length / 1024).toFixed(1)} KB`
)
console.log(ciudades)
