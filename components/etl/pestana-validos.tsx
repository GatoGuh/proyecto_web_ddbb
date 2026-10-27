"use client"

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  CheckSquareIcon,
  FilterXIcon,
  SlidersHorizontalIcon,
  SquareIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  FILTROS_INICIALES,
  ordenarRegistros,
  type CampoOrden,
  type Filtros,
  type Orden,
} from "@/lib/etl/filtrar"
import { colorCiudad } from "@/lib/etl/ciudades"
import { claveRegistro, type RegistroValido } from "@/lib/etl/tipos"
import {
  ChipCiudad,
  formatoDecimal,
  formatoEntero,
  formatoFechaUtc,
  Paginador,
  usePaginacion,
} from "./comun"
import { SinDatos } from "./pestanas-datos"

export const COLUMNAS: {
  campo: CampoOrden
  titulo: string
  numerica: boolean
}[] = [
  { campo: "ciudad", titulo: "Ciudad", numerica: false },
  { campo: "fecha_hora", titulo: "Fecha y hora (UTC)", numerica: false },
  { campo: "temperatura_c", titulo: "Temperatura (°C)", numerica: true },
  { campo: "humedad_pct", titulo: "Humedad (%)", numerica: true },
  { campo: "precipitacion_mm", titulo: "Precipitación (mm)", numerica: true },
]

export function CeldasRegistro({ r }: { r: RegistroValido }) {
  return (
    <>
      <TableCell>{r.ciudad}</TableCell>
      <TableCell className="tabular-nums">
        {formatoFechaUtc(r.fecha_hora)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatoDecimal(r.temperatura_c)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatoDecimal(r.humedad_pct)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatoDecimal(r.precipitacion_mm)}
      </TableCell>
    </>
  )
}

type Props = {
  validos: RegistroValido[]
  coinciden: RegistroValido[]
  erroresFiltro: string[]
  filtros: Filtros
  setFiltros: (f: Filtros) => void
  orden: Orden
  setOrden: (o: Orden) => void
  seleccion: ReadonlySet<string>
  setSeleccion: (s: Set<string>) => void
  seleccionFueraDeFiltros: number
  aCargar: number
  ciudadesDisponibles: string[]
  clavesConfirmadas: ReadonlySet<string>
}

export function PestanaValidos(props: Props) {
  const {
    validos,
    coinciden,
    erroresFiltro,
    filtros,
    orden,
    seleccion,
    setSeleccion,
    seleccionFueraDeFiltros,
    ciudadesDisponibles,
    clavesConfirmadas,
  } = props
  const [vista, setVista] = React.useState<"coinciden" | "excluidos">(
    "coinciden"
  )
  const [masFiltros, setMasFiltros] = React.useState(false)

  const excluidos = React.useMemo(() => {
    if (vista !== "excluidos") return []
    const claves = new Set(coinciden.map(claveRegistro))
    return ordenarRegistros(
      validos.filter((r) => !claves.has(claveRegistro(r))),
      orden
    )
  }, [vista, validos, coinciden, orden])

  const filas = vista === "coinciden" ? coinciden : excluidos
  // La paginación se aplica DESPUÉS de filtrar y ordenar, y solo para mostrar.
  const paginacion = usePaginacion(filas.length)
  const visibles = filas.slice(paginacion.inicio, paginacion.fin)

  const cambiarFiltros = (cambios: Partial<Filtros>) => {
    props.setFiltros({ ...filtros, ...cambios })
    paginacion.setPagina(1)
  }

  const alternarFila = (clave: string, marcado: boolean) => {
    const nueva = new Set(seleccion)
    if (marcado) nueva.add(clave)
    else nueva.delete(clave)
    setSeleccion(nueva)
  }

  const clavesPagina = visibles.map(claveRegistro)
  const marcadasPagina = clavesPagina.filter((c) => seleccion.has(c)).length
  const alternarPagina = (marcar: boolean) => {
    const nueva = new Set(seleccion)
    for (const c of clavesPagina) {
      if (marcar) nueva.add(c)
      else nueva.delete(c)
    }
    setSeleccion(nueva)
  }

  const ordenarPor = (campo: CampoOrden) =>
    props.setOrden({
      campo,
      direccion:
        orden.campo === campo && orden.direccion === "asc" ? "desc" : "asc",
    })

  if (validos.length === 0) {
    return <SinDatos texto="No hay registros válidos todavía." />
  }

  const avanzadosActivos = [
    filtros.desde || filtros.hasta,
    filtros.tempMin || filtros.tempMax,
    filtros.humMin || filtros.humMax,
    filtros.precMin || filtros.precMax,
  ].filter(Boolean).length
  const hayFiltros =
    avanzadosActivos > 0 || filtros.soloLluvia || filtros.ciudades !== null
  const marcadasCiudad = filtros.ciudades ?? ciudadesDisponibles
  const todasMarcadas = coinciden.every((r) => seleccion.has(claveRegistro(r)))
  const columnaOrden = COLUMNAS.find((c) => c.campo === orden.campo)?.titulo

  return (
    <div className="grid grid-cols-1 gap-5">
      <ol className="grid gap-2 text-sm sm:grid-cols-3">
        {[
          "Filtra para quedarte con las filas que te interesan.",
          "Marca las filas que quieres subir, una a una o todas las filtradas.",
          "Revisa la lista final en «Revisar y subir» y súbela.",
        ].map((t, i) => (
          <li key={t} className="flex gap-2 rounded-md solido p-2.5">
            <span
              aria-hidden
              className="grid size-6 shrink-0 place-items-center rounded-sm solido-claro text-sm font-bold"
            >
              {i + 1}
            </span>
            <span className="text-muted-foreground">{t}</span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-3 rounded-lg border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-medium">Filtrar</span>
          {ciudadesDisponibles.map((c) => (
            <ChipCiudad
              key={c}
              ciudad={c}
              color={colorCiudad(c)}
              marcada={marcadasCiudad.includes(c)}
              onClick={() => {
                const nuevas = ciudadesDisponibles.filter((x) =>
                  x === c
                    ? !marcadasCiudad.includes(x)
                    : marcadasCiudad.includes(x)
                )
                // Todas marcadas equivale a "sin filtro de ciudad".
                cambiarFiltros({
                  ciudades:
                    nuevas.length === ciudadesDisponibles.length
                      ? null
                      : nuevas,
                })
              }}
            />
          ))}
          <Label className="ml-1 font-normal">
            <Switch
              checked={filtros.soloLluvia}
              onCheckedChange={(v) => cambiarFiltros({ soloLluvia: v })}
            />
            Solo horas con lluvia
          </Label>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-expanded={masFiltros}
              aria-controls="mas-filtros"
              onClick={() => setMasFiltros(!masFiltros)}
            >
              <SlidersHorizontalIcon data-icon="inline-start" />
              Más filtros
              {avanzadosActivos > 0 && ` (${avanzadosActivos} activos)`}
            </Button>
            {hayFiltros && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  props.setFiltros(FILTROS_INICIALES)
                  paginacion.setPagina(1)
                }}
              >
                <FilterXIcon data-icon="inline-start" />
                Restablecer filtros
              </Button>
            )}
          </div>
        </div>
        {filtros.ciudades?.length === 0 && (
          <p className="text-sm text-destructive">
            No hay ninguna ciudad marcada, así que ninguna fila cumple los
            filtros.
          </p>
        )}
        {masFiltros && (
          <div
            id="mas-filtros"
            className="grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            <div className="grid grid-cols-1 gap-1.5">
              <Label htmlFor="f-desde">Desde (fecha y hora UTC)</Label>
              <Input
                id="f-desde"
                type="datetime-local"
                value={filtros.desde}
                onChange={(e) => cambiarFiltros({ desde: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <Label htmlFor="f-hasta">Hasta (incluida)</Label>
              <Input
                id="f-hasta"
                type="datetime-local"
                value={filtros.hasta}
                onChange={(e) => cambiarFiltros({ hasta: e.target.value })}
              />
            </div>
            <RangoNumerico
              id="temp"
              titulo="Temperatura (°C)"
              min={filtros.tempMin}
              max={filtros.tempMax}
              onMin={(v) => cambiarFiltros({ tempMin: v })}
              onMax={(v) => cambiarFiltros({ tempMax: v })}
            />
            <RangoNumerico
              id="hum"
              titulo="Humedad (%)"
              min={filtros.humMin}
              max={filtros.humMax}
              onMin={(v) => cambiarFiltros({ humMin: v })}
              onMax={(v) => cambiarFiltros({ humMax: v })}
            />
            <RangoNumerico
              id="prec"
              titulo="Precipitación (mm)"
              min={filtros.precMin}
              max={filtros.precMax}
              onMin={(v) => cambiarFiltros({ precMin: v })}
              onMax={(v) => cambiarFiltros({ precMax: v })}
            />
          </div>
        )}
        {erroresFiltro.length > 0 && (
          <ul role="alert" className="grid gap-1 text-sm text-destructive">
            {erroresFiltro.map((e) => (
              <li key={e}>
                {e} Ese límite no se aplica y la subida queda bloqueada hasta
                corregirlo.
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg solido p-3">
        <p className="text-sm" aria-live="polite">
          <strong className="text-base tabular-nums">
            {formatoEntero(props.aCargar)}
          </strong>{" "}
          filas marcadas que cumplen los filtros
          {seleccionFueraDeFiltros > 0 && (
            <span className="block text-amber-700 dark:text-amber-400">
              {formatoEntero(seleccionFueraDeFiltros)} marcadas no cumplen los
              filtros y no se subirán.
            </span>
          )}
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setSeleccion(
                new Set([...seleccion, ...coinciden.map(claveRegistro)])
              )
            }
            disabled={coinciden.length === 0 || todasMarcadas}
          >
            <CheckSquareIcon data-icon="inline-start" />
            {todasMarcadas && coinciden.length > 0
              ? `Las ${formatoEntero(coinciden.length)} filtradas ya están marcadas`
              : `Marcar las ${formatoEntero(coinciden.length)} filtradas`}
          </Button>
          {seleccionFueraDeFiltros > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const claves = new Set(coinciden.map(claveRegistro))
                setSeleccion(
                  new Set([...seleccion].filter((c) => claves.has(c)))
                )
              }}
            >
              Desmarcar las que no cumplen
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSeleccion(new Set())}
            disabled={seleccion.size === 0}
          >
            <SquareIcon data-icon="inline-start" />
            Desmarcar todo
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="radiogroup"
          aria-label="Filas a mostrar"
          className="inline-flex gap-0.5 rounded-md bg-muted p-0.5"
        >
          <Button
            size="sm"
            role="radio"
            aria-checked={vista === "coinciden"}
            variant={vista === "coinciden" ? "seleccion" : "ghost"}
            onClick={() => setVista("coinciden")}
          >
            Cumplen los filtros ({formatoEntero(coinciden.length)})
          </Button>
          <Button
            size="sm"
            role="radio"
            aria-checked={vista === "excluidos"}
            variant={vista === "excluidos" ? "seleccion" : "ghost"}
            onClick={() => setVista("excluidos")}
          >
            No los cumplen ({formatoEntero(validos.length - coinciden.length)})
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Ordenado por «{columnaOrden}»,{" "}
          {orden.direccion === "asc" ? "de menor a mayor" : "de mayor a menor"}.
          Pulsa el título de una columna para cambiarlo.
        </p>
      </div>

      {filas.length === 0 ? (
        <SinDatos texto="Ningún registro en esta vista." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Seleccionar las filas de esta página"
                      checked={
                        marcadasPagina > 0 &&
                        marcadasPagina === clavesPagina.length
                      }
                      indeterminate={
                        marcadasPagina > 0 &&
                        marcadasPagina < clavesPagina.length
                      }
                      onCheckedChange={(v) => alternarPagina(v)}
                    />
                  </TableHead>
                  {COLUMNAS.map((c) => (
                    <TableHead
                      key={c.campo}
                      className={c.numerica ? "text-right" : undefined}
                      aria-sort={
                        orden.campo === c.campo
                          ? orden.direccion === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => ordenarPor(c.campo)}
                        className="inline-flex items-center gap-1 font-medium hover:underline"
                      >
                        {c.titulo}
                        {orden.campo !== c.campo ? (
                          <ArrowUpDownIcon
                            aria-hidden
                            className="size-3.5 opacity-50"
                          />
                        ) : orden.direccion === "asc" ? (
                          <ArrowUpIcon aria-hidden className="size-3.5" />
                        ) : (
                          <ArrowDownIcon aria-hidden className="size-3.5" />
                        )}
                      </button>
                    </TableHead>
                  ))}
                  <TableHead>En Supabase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibles.map((r) => {
                  const clave = claveRegistro(r)
                  const marcada = seleccion.has(clave)
                  return (
                    <TableRow
                      key={clave}
                      data-state={marcada ? "selected" : undefined}
                    >
                      <TableCell>
                        <Checkbox
                          aria-label={`Seleccionar ${r.ciudad} ${formatoFechaUtc(r.fecha_hora)}`}
                          checked={marcada}
                          onCheckedChange={(v) => alternarFila(clave, v)}
                        />
                      </TableCell>
                      <CeldasRegistro r={r} />
                      <TableCell className="text-sm text-muted-foreground">
                        {clavesConfirmadas.has(clave)
                          ? "Verificado"
                          : "Solo local"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <Paginador paginacion={paginacion} />
        </>
      )}
    </div>
  )
}

function RangoNumerico({
  id,
  titulo,
  min,
  max,
  onMin,
  onMax,
}: {
  id: string
  titulo: string
  min: string
  max: string
  onMin: (v: string) => void
  onMax: (v: string) => void
}) {
  return (
    <fieldset className="grid grid-cols-1 gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{titulo}</legend>
      <div className="flex gap-2">
        <Input
          id={`${id}-min`}
          inputMode="decimal"
          placeholder="mín."
          aria-label={`${titulo} mínima`}
          value={min}
          onChange={(e) => onMin(e.target.value)}
        />
        <Input
          id={`${id}-max`}
          inputMode="decimal"
          placeholder="máx."
          aria-label={`${titulo} máxima`}
          value={max}
          onChange={(e) => onMax(e.target.value)}
        />
      </div>
    </fieldset>
  )
}
