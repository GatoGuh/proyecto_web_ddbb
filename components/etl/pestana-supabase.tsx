"use client"

import * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DatabaseIcon,
  RefreshCwIcon,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import {
  EstadoEtiqueta,
  Explicacion,
  formatoDecimal,
  formatoEntero,
  formatoFechaUtc,
  SelectorNativo,
  TAMANOS_PAGINA,
} from "./comun"

type Fila = {
  id: number
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
  importado_en: string
}

type Consulta = {
  ciudad: string
  desde: string
  hasta: string
  orden: string
  direccion: "asc" | "desc"
  pagina: number
  tamano: number
}

type Resultado =
  | { estado: "cargando" }
  | { estado: "ok"; filas: Fila[]; total: number; leidoEn: string }
  | { estado: "error"; error: string }

const CAMPOS = [
  ["fecha_hora", "Fecha y hora"],
  ["ciudad", "Ciudad"],
  ["temperatura_c", "Temperatura"],
  ["humedad_pct", "Humedad"],
  ["precipitacion_mm", "Precipitación"],
  ["importado_en", "Importado en"],
] as const

export function PestanaSupabase({
  pendientesLocales,
  confirmadosSesion,
}: {
  pendientesLocales: number
  confirmadosSesion: number
}) {
  const [consulta, setConsulta] = React.useState<Consulta>({
    ciudad: "",
    desde: "",
    hasta: "",
    orden: "fecha_hora",
    direccion: "asc",
    pagina: 1,
    tamano: 25,
  })
  const [resultado, setResultado] = React.useState<Resultado>({
    estado: "cargando",
  })
  const [recarga, setRecarga] = React.useState(0)

  React.useEffect(() => {
    const control = new AbortController()
    const params = new URLSearchParams({
      pagina: String(consulta.pagina),
      tamano: String(consulta.tamano),
      orden: consulta.orden,
      direccion: consulta.direccion,
    })
    if (consulta.ciudad) params.set("ciudad", consulta.ciudad)
    if (consulta.desde) params.set("desde", consulta.desde)
    if (consulta.hasta) params.set("hasta", consulta.hasta)
    fetch(`/api/supabase/registros?${params}`, { signal: control.signal })
      .then(async (r) => {
        const cuerpo = await r.json()
        if (!r.ok) throw new Error(cuerpo.error ?? `HTTP ${r.status}`)
        setResultado({
          estado: "ok",
          filas: cuerpo.filas,
          total: cuerpo.total,
          leidoEn: new Date().toLocaleTimeString("es-ES"),
        })
      })
      .catch((e: unknown) => {
        if (control.signal.aborted) return
        setResultado({
          estado: "error",
          error: e instanceof Error ? e.message : "Error desconocido",
        })
      })
    return () => control.abort()
  }, [consulta, recarga])

  const cambiar = (cambios: Partial<Consulta>) => {
    setResultado({ estado: "cargando" })
    setConsulta((c) => ({ ...c, pagina: 1, ...cambios }))
  }

  const total = resultado.estado === "ok" ? resultado.total : 0
  const totalPaginas = Math.max(1, Math.ceil(total / consulta.tamano))

  return (
    <div className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-xl border-2 border-dashed p-3 text-sm">
          <p className="font-medium">Datos locales (navegador)</p>
          <p className="text-muted-foreground">
            <strong className="text-foreground tabular-nums">
              {formatoEntero(pendientesLocales)}
            </strong>{" "}
            registros seleccionados aún no verificados en Supabase. Existen solo
            en esta sesión y se pierden al recargar la página.
          </p>
        </div>
        <div className="rounded-xl border-2 solido-acento p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <DatabaseIcon aria-hidden className="size-4" />
            Datos persistidos (Supabase)
          </p>
          <p className="text-muted-foreground">
            Lectura real de la tabla <code>mediciones_meteorologicas</code>:{" "}
            <strong className="text-foreground tabular-nums">
              {resultado.estado === "ok" ? formatoEntero(total) : "…"}
            </strong>{" "}
            filas con estos filtros. En esta sesión se han verificado{" "}
            {formatoEntero(confirmadosSesion)} claves.
          </p>
        </div>
      </div>

      <Explicacion>
        Esta tabla se lee del servidor en cada consulta, con paginación, filtros
        y <code>ORDER BY</code> aplicados por la base de datos (con desempate
        por ciudad y fecha). Sin ese ORDER BY el orden no estaría garantizado.
      </Explicacion>

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid grid-cols-1 gap-1.5">
          <Label htmlFor="sb-ciudad">Ciudad</Label>
          <SelectorNativo
            id="sb-ciudad"
            value={consulta.ciudad}
            onChange={(e) => cambiar({ ciudad: e.target.value })}
          >
            <option value="">Todas</option>
            {NOMBRES_CIUDADES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectorNativo>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          <Label htmlFor="sb-desde">Desde (UTC)</Label>
          <Input
            id="sb-desde"
            type="datetime-local"
            value={consulta.desde}
            onChange={(e) => cambiar({ desde: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          <Label htmlFor="sb-hasta">Hasta (UTC)</Label>
          <Input
            id="sb-hasta"
            type="datetime-local"
            value={consulta.hasta}
            onChange={(e) => cambiar({ hasta: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          <Label htmlFor="sb-orden">Ordenar por</Label>
          <div className="flex gap-2">
            <SelectorNativo
              id="sb-orden"
              value={consulta.orden}
              onChange={(e) => cambiar({ orden: e.target.value })}
            >
              {CAMPOS.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </SelectorNativo>
            <SelectorNativo
              aria-label="Dirección"
              value={consulta.direccion}
              onChange={(e) =>
                cambiar({ direccion: e.target.value as "asc" | "desc" })
              }
            >
              <option value="asc">Ascendente</option>
              <option value="desc">Descendente</option>
            </SelectorNativo>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setResultado({ estado: "cargando" })
            setRecarga((n) => n + 1)
          }}
        >
          <RefreshCwIcon data-icon="inline-start" />
          Actualizar
        </Button>
        {resultado.estado === "cargando" && (
          <EstadoEtiqueta estado="en_curso" texto="Consultando…" />
        )}
        {resultado.estado === "ok" && (
          <span className="text-sm text-muted-foreground">
            Leído a las {resultado.leidoEn}
          </span>
        )}
      </div>

      {resultado.estado === "error" && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo leer Supabase</AlertTitle>
          <AlertDescription>{resultado.error}</AlertDescription>
        </Alert>
      )}

      {resultado.estado === "ok" && (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">id</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Fecha y hora (UTC)</TableHead>
                  <TableHead className="text-right">Temperatura (°C)</TableHead>
                  <TableHead className="text-right">Humedad (%)</TableHead>
                  <TableHead className="text-right">
                    Precipitación (mm)
                  </TableHead>
                  <TableHead>Importado en (UTC)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.filas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-muted-foreground"
                    >
                      La tabla no tiene filas con estos filtros.
                    </TableCell>
                  </TableRow>
                ) : (
                  resultado.filas.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-right tabular-nums">
                        {f.id}
                      </TableCell>
                      <TableCell>{f.ciudad}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatoFechaUtc(f.fecha_hora)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatoDecimal(f.temperatura_c)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatoDecimal(f.humedad_pct)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatoDecimal(f.precipitacion_mm)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatoFechaUtc(f.importado_en)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>
              Página {consulta.pagina} de {totalPaginas} ·{" "}
              {formatoEntero(total)} filas
            </p>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5">
                Filas por página
                <SelectorNativo
                  value={String(consulta.tamano)}
                  onChange={(e) => cambiar({ tamano: Number(e.target.value) })}
                >
                  {TAMANOS_PAGINA.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </SelectorNativo>
              </label>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Página anterior"
                disabled={consulta.pagina <= 1}
                onClick={() => {
                  setResultado({ estado: "cargando" })
                  setConsulta((c) => ({ ...c, pagina: c.pagina - 1 }))
                }}
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Página siguiente"
                disabled={consulta.pagina >= totalPaginas}
                onClick={() => {
                  setResultado({ estado: "cargando" })
                  setConsulta((c) => ({ ...c, pagina: c.pagina + 1 }))
                }}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
