"use client"

import * as React from "react"
import { UploadCloudIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCarga } from "@/hooks/use-carga"
import { useExtraccion } from "@/hooks/use-extraccion"
import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import {
  FILTROS_INICIALES,
  ORDEN_INICIAL,
  prepararConjunto,
  type Filtros,
  type Orden,
} from "@/lib/etl/filtrar"
import { limpiarRegistros } from "@/lib/etl/limpiar"
import { claveRegistro, type RespuestaCiudad } from "@/lib/etl/tipos"
import { transformarRespuestas } from "@/lib/etl/transformar"
import { EstadoEtiqueta, formatoEntero, type EstadoFase } from "./comun"
import { Configuracion } from "./configuracion"
import { PestanaCarga, type EstadoSupabase } from "./pestana-carga"
import { PestanaSupabase } from "./pestana-supabase"
import { PestanaValidos } from "./pestana-validos"
import {
  PestanaJson,
  PestanaRechazados,
  PestanaTransformados,
} from "./pestanas-datos"
import { Contadores, Pipeline, type Fase } from "./pipeline"

/** Ejecuta una función pura y mide su duración real. */
function medir<T>(fn: () => T): { valor: T; duracionMs: number } {
  const t0 = performance.now()
  const valor = fn()
  return { valor, duracionMs: performance.now() - t0 }
}

export function BancoEtl() {
  const [ciudades, setCiudades] = React.useState<string[]>([
    ...NOMBRES_CIUDADES,
  ])
  const [inicio, setInicio] = React.useState("2026-09-01")
  const [fin, setFin] = React.useState("2026-09-30")
  const [pestana, setPestana] = React.useState("json")
  const [filtros, setFiltros] = React.useState<Filtros>(FILTROS_INICIALES)
  const [orden, setOrden] = React.useState<Orden>(ORDEN_INICIAL)
  const [seleccionBruta, setSeleccion] = React.useState<Set<string>>(
    () => new Set()
  )
  const [estadoSupabase, setEstadoSupabase] =
    React.useState<EstadoSupabase>(null)

  const {
    extraccion,
    enCurso: extrayendo,
    extraer,
    reintentar,
  } = useExtraccion()
  const { carga, clavesConfirmadas, iniciar, reintentarFallidos } = useCarga()

  React.useEffect(() => {
    fetch("/api/supabase/estado")
      .then(async (r) => {
        const e = await r.json()
        setEstadoSupabase(
          "configurado" in e
            ? e
            : {
                configurado: false,
                tablaDisponible: false,
                // 403: hay credenciales, pero el servidor bloquea el acceso.
                bloqueado: r.status === 403,
                mensaje: e.error ?? `HTTP ${r.status}`,
              }
        )
      })
      .catch(() =>
        setEstadoSupabase({
          configurado: false,
          tablaDisponible: false,
          mensaje: "No se pudo consultar el estado del servidor.",
        })
      )
  }, [carga?.enCurso])

  // --- Pipeline derivado: cada fase se recalcula solo si cambia su entrada ---
  const respuestas = React.useMemo<RespuestaCiudad[]>(
    () =>
      extraccion
        ? extraccion.ciudades
            .map((c) => extraccion.peticiones[c])
            .filter((p) => p.estado === "completada")
            .map((p) => ({ ciudad: p.ciudad, json: p.json }))
        : [],
    [extraccion]
  )
  const transformacion = React.useMemo(
    () => medir(() => transformarRespuestas(respuestas)),
    [respuestas]
  )
  const limpieza = React.useMemo(
    () => medir(() => limpiarRegistros(transformacion.valor.registros)),
    [transformacion]
  )
  const validos = limpieza.valor.validos

  // La selección solo puede contener claves de registros válidos actuales.
  const seleccion = React.useMemo(() => {
    const claves = new Set(validos.map(claveRegistro))
    return new Set([...seleccionBruta].filter((c) => claves.has(c)))
  }, [validos, seleccionBruta])

  const conjunto = React.useMemo(
    () => medir(() => prepararConjunto(validos, filtros, orden, seleccion)),
    [validos, filtros, orden, seleccion]
  )
  const {
    coinciden,
    aCargar,
    errores: erroresFiltro,
    seleccionFueraDeFiltros,
  } = conjunto.valor

  const ciudadesDisponibles = React.useMemo(
    () => [...new Set(validos.map((r) => r.ciudad))],
    [validos]
  )

  const nuevaExtraccion = () => {
    setSeleccion(new Set())
    setFiltros(FILTROS_INICIALES)
    setPestana("json")
    void extraer(ciudades, inicio, fin)
  }

  // --- Estado de cada fase (siempre a partir de contadores reales) ---
  const peticiones = extraccion
    ? extraccion.ciudades.map((c) => extraccion.peticiones[c])
    : []
  const terminadas = peticiones.filter(
    (p) => p.estado === "completada" || p.estado === "error"
  )
  const conError = peticiones.filter((p) => p.estado === "error")
  const totalExtraido = transformacion.valor.registros.length
  const hayDatos = respuestas.length > 0

  const estadoExtraccion: EstadoFase = !extraccion
    ? "pendiente"
    : extrayendo
      ? "en_curso"
      : conError.length > 0
        ? "error"
        : "completada"

  const estadoCarga: EstadoFase = !carga
    ? "pendiente"
    : carga.enCurso
      ? "en_curso"
      : carga.lotes.some((l) => l.estado === "error") ||
          (carga.verificacion?.estado === "completada" &&
            carga.verificacion.faltan.length > 0) ||
          carga.verificacion?.estado === "error"
        ? "error"
        : "completada"
  const confirmadosCarga = carga
    ? carga.lotes
        .filter((l) => l.estado === "completado")
        .reduce((n, l) => n + l.registros.length, 0)
    : null

  const fases: Fase[] = [
    {
      id: "extraccion",
      titulo: "Extracción",
      explicacion:
        "Una petición GET por ciudad a la API histórica de Open-Meteo (UTC, °C, mm). Se guarda el JSON original.",
      estado: estadoExtraccion,
      entrada: {
        valor: extraccion ? peticiones.length : null,
        etiqueta: "ciudades solicitadas",
      },
      salida: {
        valor: extraccion ? respuestas.length : null,
        etiqueta: "respuestas JSON correctas",
      },
      duracionMs: extraccion
        ? terminadas.reduce((n, p) => n + (p.duracionMs ?? 0), 0) || undefined
        : undefined,
      nota: extraccion && (
        <span className="text-muted-foreground">
          {terminadas.length} procesadas ·{" "}
          {peticiones.length - terminadas.length} pendientes
          {conError.length > 0 && ` · ${conError.length} con error`}
        </span>
      ),
      pestana: "json",
    },
    {
      id: "transformacion",
      titulo: "Transformación",
      explicacion:
        "Convierte los arrays paralelos de «hourly» en un registro por ciudad y hora, e interpreta la hora como UTC.",
      estado: !hayDatos
        ? "pendiente"
        : transformacion.valor.erroresEstructurales.length > 0
          ? "error"
          : "completada",
      entrada: {
        valor: hayDatos ? respuestas.length : null,
        etiqueta: "respuestas JSON",
      },
      salida: { valor: hayDatos ? totalExtraido : null, etiqueta: "registros" },
      duracionMs: hayDatos ? transformacion.duracionMs : undefined,
      nota:
        transformacion.valor.avisos.length > 0 ? (
          <span className="text-amber-700 dark:text-amber-400">
            {transformacion.valor.avisos.length} aviso(s) de estructura
          </span>
        ) : undefined,
      pestana: "transformados",
    },
    {
      id: "limpieza",
      titulo: "Limpieza",
      explicacion:
        "Valida ciudad, fecha y mediciones (sin convertir nulos en 0), rangos de humedad y precipitación, y elimina duplicados.",
      estado: totalExtraido === 0 ? "pendiente" : "completada",
      entrada: {
        valor: hayDatos ? totalExtraido : null,
        etiqueta: "registros",
      },
      salida: { valor: hayDatos ? validos.length : null, etiqueta: "válidos" },
      duracionMs: hayDatos ? limpieza.duracionMs : undefined,
      nota: hayDatos ? (
        <span className="text-muted-foreground">
          {formatoEntero(limpieza.valor.rechazados.length)} rechazados por
          calidad
        </span>
      ) : undefined,
      pestana: "rechazados",
    },
    {
      id: "filtrado",
      titulo: "Filtrado y selección",
      explicacion:
        "Aplica tus filtros y orden a los válidos; tú eliges qué filas subir. Solo cuentan las seleccionadas que cumplen los filtros.",
      estado:
        validos.length === 0
          ? "pendiente"
          : erroresFiltro.length > 0
            ? "error"
            : "completada",
      entrada: { valor: hayDatos ? validos.length : null, etiqueta: "válidos" },
      salida: {
        valor: hayDatos ? aCargar.length : null,
        etiqueta: "seleccionados para cargar",
      },
      duracionMs: validos.length > 0 ? conjunto.duracionMs : undefined,
      nota: hayDatos ? (
        <span className="text-muted-foreground">
          {formatoEntero(coinciden.length)} coinciden con los filtros
        </span>
      ) : undefined,
      pestana: "validos",
    },
    {
      id: "carga",
      titulo: "Carga",
      explicacion:
        "Upsert en Supabase por (ciudad, fecha_hora) en lotes de 500, desde el servidor. Después verifica que las claves existen.",
      estado: estadoCarga,
      entrada: {
        valor: carga ? carga.congelados.length : null,
        etiqueta: "registros congelados",
      },
      salida: { valor: confirmadosCarga, etiqueta: "confirmados por Supabase" },
      duracionMs: carga?.duracionMs || undefined,
      nota:
        carga?.verificacion?.estado === "completada" ? (
          <span className="text-muted-foreground">
            {formatoEntero(
              carga.verificacion.comprobadas - carga.verificacion.faltan.length
            )}{" "}
            verificados en destino
          </span>
        ) : undefined,
      pestana: "carga",
    },
  ]

  // Mismas condiciones que el botón de la pestaña «Vista previa de la carga».
  const motivoNoSubir = carga?.enCurso
    ? "Hay una carga en curso."
    : estadoSupabase !== null && !estadoSupabase.configurado
      ? estadoSupabase.mensaje
      : erroresFiltro.length > 0
        ? "Hay filtros no válidos: corrígelos antes de subir."
        : aCargar.length === 0
          ? "Selecciona filas en la pestaña «Válidos» para poder subirlas."
          : estadoSupabase?.configurado && !estadoSupabase.tablaDisponible
            ? "Aviso: la tabla de destino no existe todavía; aplica la migración o la carga fallará."
            : null
  const puedeSubir =
    !carga?.enCurso &&
    !(estadoSupabase !== null && !estadoSupabase.configurado) &&
    erroresFiltro.length === 0 &&
    aCargar.length > 0

  const pendientesLocales = aCargar.filter(
    (r) => !clavesConfirmadas.has(claveRegistro(r))
  ).length

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Primer pipeline ETL: Open-Meteo → Supabase
          </h1>
          <p className="text-sm text-muted-foreground">
            Extrae datos horarios, observa cómo cambian en cada fase y decide
            exactamente qué registros se guardan.
          </p>
        </div>
        <div className="grid max-w-md justify-items-end gap-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Destino:</span>
            {estadoSupabase === null ? (
              <EstadoEtiqueta estado="en_curso" texto="Comprobando Supabase" />
            ) : estadoSupabase.tablaDisponible ? (
              <EstadoEtiqueta estado="completada" texto="Supabase listo" />
            ) : (
              <EstadoEtiqueta
                estado="error"
                texto={
                  estadoSupabase.bloqueado
                    ? "Bloqueado en producción"
                    : estadoSupabase.configurado
                      ? "Tabla no disponible"
                      : "Sin credenciales"
                }
              />
            )}
          </div>
          {estadoSupabase && !estadoSupabase.tablaDisponible && (
            <p className="text-right text-xs text-destructive">
              {estadoSupabase.mensaje}
            </p>
          )}
        </div>
      </header>

      <Configuracion
        ciudades={ciudades}
        setCiudades={setCiudades}
        inicio={inicio}
        setInicio={setInicio}
        fin={fin}
        setFin={setFin}
        extraccion={extraccion}
        enCurso={extrayendo}
        onExtraer={nuevaExtraccion}
        onReintentar={(c) => void reintentar(c)}
      />

      <Pipeline fases={fases} onInspeccionar={setPestana} />

      <Contadores
        contadores={[
          {
            etiqueta: "Total extraído",
            valor: totalExtraido,
            detalle: "registros horarios",
          },
          {
            etiqueta: "Válidos",
            valor: validos.length,
            detalle: "superan la limpieza",
          },
          {
            etiqueta: "Rechazados",
            valor: limpieza.valor.rechazados.length,
            detalle: "por calidad",
          },
          {
            etiqueta: "Coinciden con los filtros",
            valor: coinciden.length,
            detalle: `${formatoEntero(validos.length - coinciden.length)} excluidos por filtros`,
          },
          {
            etiqueta: "Seleccionados para cargar",
            valor: aCargar.length,
            detalle:
              seleccionFueraDeFiltros > 0
                ? `${formatoEntero(seleccionFueraDeFiltros)} seleccionados fuera de filtros`
                : "seleccionados y dentro de filtros",
            destacado: true,
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
        <Button
          size="lg"
          disabled={!puedeSubir}
          onClick={() => {
            // Se muestra el informe por lotes mientras se sube.
            setPestana("carga")
            void iniciar(aCargar)
          }}
        >
          <UploadCloudIcon data-icon="inline-start" />
          {carga?.enCurso
            ? "Subiendo…"
            : `Subir ${formatoEntero(aCargar.length)} registros a Supabase`}
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {motivoNoSubir ??
            "Se enviarán las filas seleccionadas que cumplen los filtros, en el orden elegido."}
        </p>
      </div>

      <section
        aria-labelledby="titulo-inspeccion"
        className="grid grid-cols-1 gap-3"
      >
        <h2 id="titulo-inspeccion" className="text-base font-semibold">
          3. Inspección de datos
        </h2>
        <Tabs value={pestana} onValueChange={(v) => setPestana(String(v))}>
          <div className="overflow-x-auto pb-1">
            <TabsList>
              <TabsTrigger value="json">JSON original</TabsTrigger>
              <TabsTrigger value="transformados">
                Transformados ({formatoEntero(totalExtraido)})
              </TabsTrigger>
              <TabsTrigger value="validos">
                Válidos ({formatoEntero(validos.length)})
              </TabsTrigger>
              <TabsTrigger value="rechazados">
                Rechazados ({formatoEntero(limpieza.valor.rechazados.length)})
              </TabsTrigger>
              <TabsTrigger value="carga">
                Vista previa de la carga ({formatoEntero(aCargar.length)})
              </TabsTrigger>
              <TabsTrigger value="supabase">Datos en Supabase</TabsTrigger>
            </TabsList>
          </div>
          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <TabsContent value="json">
              <PestanaJson extraccion={extraccion} />
            </TabsContent>
            <TabsContent value="transformados">
              <PestanaTransformados resultado={transformacion.valor} />
            </TabsContent>
            <TabsContent value="validos">
              <PestanaValidos
                validos={validos}
                coinciden={coinciden}
                erroresFiltro={erroresFiltro}
                filtros={filtros}
                setFiltros={setFiltros}
                orden={orden}
                setOrden={setOrden}
                seleccion={seleccion}
                setSeleccion={setSeleccion}
                seleccionFueraDeFiltros={seleccionFueraDeFiltros}
                aCargar={aCargar.length}
                ciudadesDisponibles={ciudadesDisponibles}
                clavesConfirmadas={clavesConfirmadas}
              />
            </TabsContent>
            <TabsContent value="rechazados">
              <PestanaRechazados
                rechazados={limpieza.valor.rechazados}
                excluidosPorFiltros={validos.length - coinciden.length}
              />
            </TabsContent>
            <TabsContent value="carga">
              <PestanaCarga
                aCargar={aCargar}
                bloqueoFiltros={erroresFiltro.length > 0}
                carga={carga}
                estadoSupabase={estadoSupabase}
                onSubir={(simular) => void iniciar(aCargar, simular)}
                onReintentar={() => void reintentarFallidos()}
              />
            </TabsContent>
            <TabsContent value="supabase">
              <PestanaSupabase
                pendientesLocales={pendientesLocales}
                confirmadosSesion={clavesConfirmadas.size}
              />
            </TabsContent>
          </div>
        </Tabs>
      </section>

      <footer className="text-xs text-muted-foreground">
        Datos meteorológicos:{" "}
        <a
          className="underline"
          href="https://open-meteo.com/"
          target="_blank"
          rel="noreferrer"
        >
          Open-Meteo.com
        </a>{" "}
        (CC BY 4.0). Herramienta didáctica sin autenticación: solo para
        desarrollo local.
      </footer>
    </div>
  )
}
