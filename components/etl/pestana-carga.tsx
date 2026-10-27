"use client"

import * as React from "react"
import { RotateCcwIcon, UploadCloudIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Carga } from "@/hooks/use-carga"
import { TAMANO_LOTE } from "@/lib/etl/carga"
import { claveRegistro, type RegistroValido } from "@/lib/etl/tipos"
import {
  EstadoEtiqueta,
  Explicacion,
  formatoDuracion,
  formatoEntero,
  Paginador,
  usePaginacion,
  type EstadoFase,
} from "./comun"
import { CeldasRegistro, COLUMNAS } from "./pestana-validos"
import { SinDatos } from "./pestanas-datos"

export type EstadoSupabase = {
  configurado: boolean
  tablaDisponible: boolean
  /** El servidor rechaza el acceso (403), p. ej., en producción sin permiso. */
  bloqueado?: boolean
  mensaje: string
} | null

const ESTADO_LOTE: Record<string, EstadoFase> = {
  pendiente: "pendiente",
  en_curso: "en_curso",
  completado: "completada",
  error: "error",
}

export function PestanaCarga({
  aCargar,
  bloqueoFiltros,
  carga,
  estadoSupabase,
  onSubir,
  onReintentar,
}: {
  aCargar: RegistroValido[]
  bloqueoFiltros: boolean
  carga: Carga | null
  estadoSupabase: EstadoSupabase
  onSubir: (simularFallo: boolean) => void
  onReintentar: () => void
}) {
  const [simularFallo, setSimularFallo] = React.useState(false)
  const enCurso = carga?.enCurso ?? false
  const sinCredenciales = estadoSupabase !== null && !estadoSupabase.configurado
  const desactivado =
    aCargar.length === 0 || bloqueoFiltros || enCurso || sinCredenciales

  return (
    <div className="grid grid-cols-1 gap-5">
      <section className="grid grid-cols-1 gap-3">
        <Explicacion>
          Esta es la lista <strong>exacta</strong> que se enviará, en el orden
          elegido, dividida en lotes de {TAMANO_LOTE}. Al pulsar el botón se
          congela una copia: cambiar después los filtros no altera una carga en
          curso. Ojo: una base de datos{" "}
          <strong>no conserva el orden de inserción</strong>; para leer los
          datos en un orden concreto, la consulta necesita <code>ORDER BY</code>
          .
        </Explicacion>
        {sinCredenciales && (
          <Alert variant="destructive">
            <AlertTitle>
              {estadoSupabase?.bloqueado
                ? "La carga está bloqueada en este entorno"
                : "Supabase no está configurado"}
            </AlertTitle>
            <AlertDescription>{estadoSupabase?.mensaje}</AlertDescription>
          </Alert>
        )}
        {estadoSupabase?.configurado && !estadoSupabase.tablaDisponible && (
          <Alert variant="destructive">
            <AlertTitle>La tabla de destino no está disponible</AlertTitle>
            <AlertDescription>{estadoSupabase.mensaje}</AlertDescription>
          </Alert>
        )}
        {bloqueoFiltros && (
          <p role="alert" className="text-sm text-destructive">
            Hay filtros no válidos: corrígelos antes de subir.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            className="fondo-atardecer h-10 border-0 px-4 text-white shadow-sm disabled:opacity-50"
            onClick={() => onSubir(simularFallo)}
            disabled={desactivado}
          >
            <UploadCloudIcon data-icon="inline-start" />
            {enCurso
              ? "Subiendo…"
              : `Subir ${formatoEntero(aCargar.length)} registros a Supabase`}
          </Button>
          {process.env.NODE_ENV === "development" && (
            <Label className="font-normal text-muted-foreground">
              <Checkbox
                checked={simularFallo}
                onCheckedChange={setSimularFallo}
                disabled={enCurso}
              />
              Práctica: simular un fallo del servidor en el lote 2 (o el 1 si
              solo hay uno). Solo en desarrollo.
            </Label>
          )}
        </div>
      </section>

      {carga && (
        <InformeCarga
          carga={carga}
          aCargar={aCargar}
          onReintentar={onReintentar}
        />
      )}

      <section className="grid grid-cols-1 gap-2">
        <h3 className="font-semibold">
          Vista previa: {formatoEntero(aCargar.length)} registros a enviar
        </h3>
        <TablaOrdenada
          registros={aCargar}
          vacio="No hay filas seleccionadas que cumplan los filtros."
        />
      </section>
    </div>
  )
}

function InformeCarga({
  carga,
  aCargar,
  onReintentar,
}: {
  carga: Carga
  aCargar: RegistroValido[]
  onReintentar: () => void
}) {
  const sumar = (estado: string) =>
    carga.lotes
      .filter((l) => l.estado === estado)
      .reduce((n, l) => n + l.registros.length, 0)
  const correctos = sumar("completado")
  const fallidos = sumar("error")
  const pendientes = sumar("pendiente") + sumar("en_curso")
  const lotesFallidos = carga.lotes.filter((l) => l.estado === "error").length
  const completados = carga.lotes.filter((l) => l.estado === "completado")
  // Solo se suma si Supabase devolvió el recuento en todos los lotes.
  const afectadas = completados.every(
    (l) => typeof l.filasAfectadas === "number"
  )
    ? completados.reduce((n, l) => n + (l.filasAfectadas ?? 0), 0)
    : null
  const coincideConVista =
    carga.congelados.length === aCargar.length &&
    carga.congelados.every(
      (r, i) => claveRegistro(r) === claveRegistro(aCargar[i])
    )
  const v = carga.verificacion

  return (
    <section
      className="grid grid-cols-1 gap-3 rounded-xl border p-3"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Informe de la carga</h3>
        <EstadoEtiqueta
          estado={
            carga.enCurso
              ? "en_curso"
              : lotesFallidos > 0
                ? "error"
                : "completada"
          }
        />
        <span className="text-sm text-muted-foreground">
          Duración: {formatoDuracion(carga.duracionMs || undefined)}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Dato titulo="Conjunto congelado" valor={carga.congelados.length} />
        <Dato titulo="Procesados correctamente" valor={correctos} />
        <Dato titulo="Fallidos" valor={fallidos} />
        <Dato titulo="Pendientes" valor={pendientes} />
      </dl>
      <p className="text-sm text-muted-foreground">
        {completados.length === 0
          ? "Supabase todavía no ha confirmado ningún lote. "
          : `Supabase confirma ${
              afectadas === null
                ? `${completados.length} lote(s)`
                : `${formatoEntero(afectadas)} filas afectadas`
            } mediante upsert por (ciudad, fecha_hora). `}
        Su respuesta <strong>no distingue</strong> cuántas filas fueron
        inserciones nuevas y cuántas actualizaciones de filas existentes, así
        que no se muestran por separado.
      </p>
      <p className="text-sm">
        {coincideConVista
          ? "La copia congelada coincide (mismas filas y mismo orden) con la vista previa actual."
          : "La vista previa ha cambiado desde que se inició esta carga: lo enviado es la copia congelada, no la vista actual."}
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lote</TableHead>
              <TableHead className="text-right">Registros</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Intentos</TableHead>
              <TableHead className="text-right">Filas afectadas</TableHead>
              <TableHead className="text-right">Duración</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carga.lotes.map((l) => (
              <TableRow key={l.numero}>
                <TableCell>#{l.numero}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {l.registros.length}
                </TableCell>
                <TableCell>
                  <EstadoEtiqueta estado={ESTADO_LOTE[l.estado]} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {l.intentos}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {l.filasAfectadas ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatoDuracion(l.duracionMs)}
                </TableCell>
                <TableCell className="whitespace-normal text-destructive">
                  {l.error}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {lotesFallidos > 0 && !carga.enCurso && (
        <div>
          <Button variant="outline" onClick={onReintentar}>
            <RotateCcwIcon data-icon="inline-start" />
            Reintentar {lotesFallidos} lote{lotesFallidos > 1 ? "s" : ""}{" "}
            fallido
            {lotesFallidos > 1 ? "s" : ""}
          </Button>
        </div>
      )}

      <div className="text-sm">
        <p className="font-medium">Verificación en destino</p>
        {!v && (
          <p className="text-muted-foreground">
            Sin lotes confirmados que verificar.
          </p>
        )}
        {v?.estado === "en_curso" && (
          <EstadoEtiqueta
            estado="en_curso"
            texto="Consultando claves en Supabase…"
          />
        )}
        {v?.estado === "error" && (
          <p className="text-destructive">No se pudo verificar: {v.error}</p>
        )}
        {v?.estado === "completada" && (
          <p>
            Se consultaron {formatoEntero(v.comprobadas)} claves (ciudad,
            fecha_hora) enviadas en lotes correctos:{" "}
            <strong>{formatoEntero(v.comprobadas - v.faltan.length)}</strong>{" "}
            existen en la tabla
            {v.faltan.length > 0 ? (
              <span className="text-destructive">
                {" "}
                y {formatoEntero(v.faltan.length)} NO se encontraron (p. ej.{" "}
                {v.faltan.slice(0, 3).join(", ")}).
              </span>
            ) : (
              "; no falta ninguna."
            )}
          </p>
        )}
      </div>
    </section>
  )
}

function Dato({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <dt className="text-xs text-muted-foreground">{titulo}</dt>
      <dd className="text-lg font-semibold tabular-nums">
        {formatoEntero(valor)}
      </dd>
    </div>
  )
}

function TablaOrdenada({
  registros,
  vacio,
}: {
  registros: RegistroValido[]
  vacio: string
}) {
  const paginacion = usePaginacion(registros.length)
  if (registros.length === 0) return <SinDatos texto={vacio} />
  const visibles = registros.slice(paginacion.inicio, paginacion.fin)
  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">Orden de envío</TableHead>
              <TableHead className="text-right">Lote</TableHead>
              {COLUMNAS.map((c) => (
                <TableHead
                  key={c.campo}
                  className={c.numerica ? "text-right" : undefined}
                >
                  {c.titulo}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.map((r, i) => {
              const posicion = paginacion.inicio + i
              return (
                <TableRow key={claveRegistro(r)}>
                  <TableCell className="text-right tabular-nums">
                    {formatoEntero(posicion + 1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Math.floor(posicion / TAMANO_LOTE) + 1}
                  </TableCell>
                  <CeldasRegistro r={r} />
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <Paginador paginacion={paginacion} />
    </>
  )
}
