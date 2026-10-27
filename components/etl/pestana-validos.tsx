"use client"

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  CheckSquareIcon,
  FilterXIcon,
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
import { claveRegistro, type RegistroValido } from "@/lib/etl/tipos"
import {
  Explicacion,
  formatoDecimal,
  formatoEntero,
  formatoFechaUtc,
  Paginador,
  SelectorNativo,
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

  return (
    <div className="grid grid-cols-1 gap-4">
      <Explicacion>
        Orden de operaciones:{" "}
        <strong>
          registros válidos → filtros → ordenación → selección → carga
        </strong>
        . La paginación solo cambia lo que ves. Al cambiar los filtros no se
        selecciona nada automáticamente; solo se subirán las filas seleccionadas
        que <em>sigan cumpliendo</em> los filtros actuales.
      </Explicacion>

      <fieldset className="grid grid-cols-1 gap-4 rounded-xl border p-3">
        <legend className="px-1 text-sm font-medium">Filtros</legend>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm text-muted-foreground">Ciudades:</span>
          {ciudadesDisponibles.map((c) => {
            const marcadas = filtros.ciudades ?? ciudadesDisponibles
            return (
              <Label key={c} className="font-normal">
                <Checkbox
                  checked={marcadas.includes(c)}
                  onCheckedChange={(v) => {
                    const nuevas = ciudadesDisponibles.filter((x) =>
                      x === c ? v : marcadas.includes(x)
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
                {c}
              </Label>
            )
          })}
          {filtros.ciudades?.length === 0 && (
            <span className="text-sm text-destructive">
              Ninguna ciudad marcada: no coincide ningún registro
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid grid-cols-1 gap-1.5">
            <Label htmlFor="f-desde">Desde (UTC)</Label>
            <Input
              id="f-desde"
              type="datetime-local"
              value={filtros.desde}
              onChange={(e) => cambiarFiltros({ desde: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            <Label htmlFor="f-hasta">Hasta (UTC, incluida)</Label>
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
          <Label className="self-end font-normal">
            <Switch
              checked={filtros.soloLluvia}
              onCheckedChange={(v) => cambiarFiltros({ soloLluvia: v })}
            />
            Solo registros con lluvia (precipitación &gt; 0)
          </Label>
          <div className="grid grid-cols-1 gap-1.5">
            <Label htmlFor="orden-campo">Ordenar por</Label>
            <div className="flex gap-2">
              <SelectorNativo
                id="orden-campo"
                className="flex-1"
                value={orden.campo}
                onChange={(e) =>
                  props.setOrden({
                    ...orden,
                    campo: e.target.value as CampoOrden,
                  })
                }
              >
                {COLUMNAS.map((c) => (
                  <option key={c.campo} value={c.campo}>
                    {c.titulo}
                  </option>
                ))}
              </SelectorNativo>
              <SelectorNativo
                aria-label="Dirección"
                value={orden.direccion}
                onChange={(e) =>
                  props.setOrden({
                    ...orden,
                    direccion: e.target.value as Orden["direccion"],
                  })
                }
              >
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </SelectorNativo>
            </div>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                props.setFiltros(FILTROS_INICIALES)
                paginacion.setPagina(1)
              }}
            >
              <FilterXIcon data-icon="inline-start" />
              Restablecer filtros
            </Button>
          </div>
        </div>
        {erroresFiltro.length > 0 && (
          <ul
            role="alert"
            className="list-inside list-disc text-sm text-destructive"
          >
            {erroresFiltro.map((e) => (
              <li key={e}>
                {e} Ese límite no se aplica y la carga queda bloqueada.
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setSeleccion(
              new Set([...seleccion, ...coinciden.map(claveRegistro)])
            )
          }
          disabled={coinciden.length === 0}
        >
          <CheckSquareIcon data-icon="inline-start" />
          Seleccionar las {formatoEntero(coinciden.length)} que cumplen los
          filtros
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSeleccion(new Set())}
          disabled={seleccion.size === 0}
        >
          <SquareIcon data-icon="inline-start" />
          Vaciar selección
        </Button>
        {seleccionFueraDeFiltros > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const claves = new Set(coinciden.map(claveRegistro))
              setSeleccion(new Set([...seleccion].filter((c) => claves.has(c))))
            }}
          >
            Quitar de la selección las {formatoEntero(seleccionFueraDeFiltros)}{" "}
            fuera de filtros
          </Button>
        )}
        <p className="ml-auto text-sm" aria-live="polite">
          <strong className="tabular-nums">
            {formatoEntero(props.aCargar)}
          </strong>{" "}
          seleccionadas para cargar
          {seleccionFueraDeFiltros > 0 && (
            <span className="text-amber-700 dark:text-amber-400">
              {" "}
              · {formatoEntero(seleccionFueraDeFiltros)} seleccionadas quedan
              fuera de los filtros y no se subirán
            </span>
          )}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Registros a mostrar"
        className="flex flex-wrap gap-2"
      >
        <Button
          size="sm"
          role="radio"
          aria-checked={vista === "coinciden"}
          variant={vista === "coinciden" ? "secondary" : "ghost"}
          onClick={() => setVista("coinciden")}
        >
          Coinciden con los filtros ({formatoEntero(coinciden.length)})
        </Button>
        <Button
          size="sm"
          role="radio"
          aria-checked={vista === "excluidos"}
          variant={vista === "excluidos" ? "secondary" : "ghost"}
          onClick={() => setVista("excluidos")}
        >
          Excluidos por los filtros (
          {formatoEntero(validos.length - coinciden.length)})
        </Button>
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
                      <TableCell className="text-xs text-muted-foreground">
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
