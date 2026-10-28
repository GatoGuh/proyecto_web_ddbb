"use client"

import * as React from "react"
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
import {
  mediaDiariaHumedad,
  mediaDiariaTemperatura,
  resumirPorCiudad,
} from "@/lib/etl/resumen"
import { claveRegistro, type RespuestaCiudad } from "@/lib/etl/tipos"
import { transformarRespuestas } from "@/lib/etl/transformar"
import { ChevronDownIcon, SlidersHorizontalIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatoEntero, type EstadoFase } from "./comun"
import { Configuracion } from "./configuracion"
import { GraficoHumedad, GraficoLluvia, GraficoTemperatura } from "./graficos"
import { PanelSubida } from "./panel-subida"
import { PestanaCarga, type EstadoSupabase } from "./pestana-carga"
import { PestanaSupabase } from "./pestana-supabase"
import { PestanaValidos } from "./pestana-validos"
import {
  PestanaJson,
  PestanaRechazados,
  PestanaTransformados,
} from "./pestanas-datos"
import { Cabecera, type Destino, type Fase } from "./pipeline"
import { Seccion } from "./seccion"

const DETALLES = [
  { id: "rechazados", titulo: "Rechazados" },
  { id: "transformados", titulo: "Transformados" },
  { id: "json", titulo: "JSON original" },
] as const
type Detalle = (typeof DETALLES)[number]["id"]

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
  const [pestana, setPestana] = React.useState("validos")
  const [detalle, setDetalle] = React.useState<Detalle>("rechazados")
  const [simularFallo, setSimularFallo] = React.useState(false)
  // Filtros, tablas, informe y datos técnicos: ocultos hasta que se piden.
  const [avanzada, setAvanzada] = React.useState(false)
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
  const resumen = React.useMemo(() => resumirPorCiudad(validos), [validos])
  const temperaturaDiaria = React.useMemo(
    () => mediaDiariaTemperatura(validos),
    [validos]
  )
  const humedadDiaria = React.useMemo(
    () => mediaDiariaHumedad(validos),
    [validos]
  )

  // Abre una pestaña de la zona de datos y la lleva a la vista. Las vistas
  // técnicas viven dentro de la pestaña «Detalles técnicos».
  const irA = (p: string) => {
    const tecnica = DETALLES.find((d) => d.id === p)
    if (tecnica) setDetalle(tecnica.id)
    setPestana(tecnica ? "tecnicos" : p)
    setAvanzada(true)
    document
      .getElementById("paso-eleccion")
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const nuevaExtraccion = () => {
    setSeleccion(new Set())
    setFiltros(FILTROS_INICIALES)
    setPestana("validos")
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
      explicacion: "Descarga una respuesta JSON por ciudad desde Open-Meteo.",
      estado: estadoExtraccion,
      entrada: {
        valor: extraccion ? peticiones.length : null,
        etiqueta: "ciudades pedidas",
      },
      salida: {
        valor: extraccion ? respuestas.length : null,
        etiqueta: "respuestas correctas",
      },
      duracionMs: extraccion
        ? terminadas.reduce((n, p) => n + (p.duracionMs ?? 0), 0) || undefined
        : undefined,
      nota:
        extraccion && terminadas.length < peticiones.length
          ? `${terminadas.length} procesadas, ${peticiones.length - terminadas.length} pendientes`
          : conError.length > 0
            ? `${conError.length} con error: reinténtalas en el paso 1`
            : undefined,
      pestana: "json",
    },
    {
      id: "transformacion",
      titulo: "Transformación",
      explicacion:
        "Convierte las listas de cada respuesta en una fila por ciudad y hora (UTC).",
      estado: !hayDatos
        ? "pendiente"
        : transformacion.valor.erroresEstructurales.length > 0
          ? "error"
          : "completada",
      entrada: {
        valor: hayDatos ? respuestas.length : null,
        etiqueta: "respuestas JSON",
      },
      salida: { valor: hayDatos ? totalExtraido : null, etiqueta: "filas" },
      duracionMs: hayDatos ? transformacion.duracionMs : undefined,
      nota:
        transformacion.valor.avisos.length > 0
          ? `${transformacion.valor.avisos.length} aviso(s) de estructura`
          : undefined,
      pestana: "transformados",
    },
    {
      id: "limpieza",
      titulo: "Limpieza",
      explicacion:
        "Descarta filas con valores ausentes, nulos o imposibles, y los duplicados.",
      estado: totalExtraido === 0 ? "pendiente" : "completada",
      entrada: { valor: hayDatos ? totalExtraido : null, etiqueta: "filas" },
      salida: { valor: hayDatos ? validos.length : null, etiqueta: "válidas" },
      duracionMs: hayDatos ? limpieza.duracionMs : undefined,
      nota: hayDatos
        ? `${formatoEntero(limpieza.valor.rechazados.length)} rechazadas por calidad`
        : undefined,
      pestana: "rechazados",
    },
    {
      id: "filtrado",
      titulo: "Filtrado y selección",
      explicacion:
        "Tú decides qué filas se suben, con filtros y casillas de selección.",
      estado:
        validos.length === 0
          ? "pendiente"
          : erroresFiltro.length > 0
            ? "error"
            : "completada",
      entrada: { valor: hayDatos ? validos.length : null, etiqueta: "válidas" },
      salida: {
        valor: hayDatos ? aCargar.length : null,
        etiqueta: "elegidas para subir",
      },
      duracionMs: validos.length > 0 ? conjunto.duracionMs : undefined,
      nota: hayDatos
        ? `${formatoEntero(coinciden.length)} cumplen los filtros`
        : undefined,
      pestana: "validos",
    },
    {
      id: "carga",
      titulo: "Carga",
      explicacion:
        "Guarda las filas elegidas en Supabase, en lotes de 500, y comprueba que llegaron.",
      estado: estadoCarga,
      entrada: {
        valor: carga ? carga.congelados.length : null,
        etiqueta: "enviadas",
      },
      salida: { valor: confirmadosCarga, etiqueta: "confirmadas" },
      duracionMs: carga?.duracionMs || undefined,
      nota:
        carga?.verificacion?.estado === "completada"
          ? `${formatoEntero(carga.verificacion.comprobadas - carga.verificacion.faltan.length)} verificadas en la tabla`
          : undefined,
      pestana: "carga",
    },
  ]

  const destino: Destino =
    estadoSupabase === null
      ? { estado: "en_curso", texto: "Comprobando Supabase…" }
      : estadoSupabase.tablaDisponible
        ? { estado: "completada", texto: "Supabase conectado" }
        : {
            estado: "error",
            texto: estadoSupabase.bloqueado
              ? "Bloqueado en producción"
              : estadoSupabase.configurado
                ? "Falta la tabla"
                : "Sin credenciales",
            detalle: estadoSupabase.mensaje,
          }

  // Mismas condiciones que el botón de la pestaña de subida.
  const motivoBloqueo = carga?.enCurso
    ? "Hay una subida en curso."
    : estadoSupabase !== null && !estadoSupabase.configurado
      ? estadoSupabase.mensaje
      : erroresFiltro.length > 0
        ? "Hay filtros no válidos: corrígelos antes de subir."
        : aCargar.length === 0
          ? "Pulsa «Marcar todos» para elegir los registros que se subirán."
          : null
  const avisoSubida =
    estadoSupabase?.configurado && !estadoSupabase.tablaDisponible
      ? "La tabla de destino no existe todavía: aplica la migración o la subida fallará."
      : null

  const hayFiltros =
    JSON.stringify(filtros) !== JSON.stringify(FILTROS_INICIALES)
  const todosMarcados =
    coinciden.length > 0 &&
    coinciden.every((r) => seleccion.has(claveRegistro(r)))

  const pendientesLocales = aCargar.filter(
    (r) => !clavesConfirmadas.has(claveRegistro(r))
  ).length

  return (
    <>
      <Cabecera fases={fases} destino={destino} onInspeccionar={irA} />

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <Configuracion
          ciudades={ciudades}
          setCiudades={setCiudades}
          inicio={inicio}
          setInicio={setInicio}
          fin={fin}
          setFin={setFin}
          extraccion={extraccion}
          enCurso={extrayendo}
          resumen={resumen}
          onExtraer={nuevaExtraccion}
          onReintentar={(c) => void reintentar(c)}
        />

        {hayDatos && (
          <Seccion
            id="paso-datos"
            numero={2}
            titulo="Así son los datos"
            descripcion="Cómo se comportan la temperatura, la humedad y la lluvia en las ciudades descargadas."
          >
            <div className="grid grid-cols-1 gap-10">
              <GraficoTemperatura
                datos={temperaturaDiaria}
                ciudades={ciudadesDisponibles}
              />
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
                <GraficoHumedad
                  datos={humedadDiaria}
                  ciudades={ciudadesDisponibles}
                />
                <GraficoLluvia resumen={[...resumen.values()]} />
              </div>
            </div>
          </Seccion>
        )}

        <Seccion
          id="paso-eleccion"
          numero={hayDatos ? 3 : 2}
          titulo="Sube los datos a Supabase"
          descripcion="Marca los registros y súbelos. En la vista avanzada puedes filtrarlos, revisarlos uno a uno y ver el informe."
        >
          {validos.length > 0 ? (
            <PanelSubida
              marcados={aCargar.length}
              total={coinciden.length}
              hayFiltros={hayFiltros}
              todosMarcados={todosMarcados}
              fueraDeFiltros={seleccionFueraDeFiltros}
              motivoBloqueo={motivoBloqueo}
              aviso={avisoSubida}
              carga={carga}
              onMarcarTodos={() =>
                setSeleccion(
                  new Set([...seleccion, ...coinciden.map(claveRegistro)])
                )
              }
              onDesmarcarTodo={() => setSeleccion(new Set())}
              onSubir={() => void iniciar(aCargar, simularFallo)}
              onReintentar={() => void reintentarFallidos()}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Descarga los datos en el paso 1 para poder subirlos.
            </p>
          )}

          <Button
            variant="ghost"
            className="mt-4 justify-self-start"
            aria-expanded={avanzada}
            aria-controls="vista-avanzada"
            onClick={() => setAvanzada(!avanzada)}
          >
            <SlidersHorizontalIcon data-icon="inline-start" />
            {avanzada ? "Ocultar vista avanzada" : "Vista avanzada"}
            <ChevronDownIcon
              data-icon="inline-end"
              className={avanzada ? "rotate-180" : undefined}
            />
          </Button>

          {avanzada && (
            <div id="vista-avanzada" className="mt-4 border-t pt-4">
              <Tabs
                value={pestana}
                onValueChange={(v) => setPestana(String(v))}
              >
                <div className="-mx-1 overflow-x-auto px-1 pb-1">
                  <TabsList className="h-auto flex-wrap justify-start gap-y-1">
                    <TabsTrigger value="validos">
                      Elegir registros ({formatoEntero(validos.length)})
                    </TabsTrigger>
                    <TabsTrigger value="carga">
                      Revisar y subir ({formatoEntero(aCargar.length)})
                    </TabsTrigger>
                    <TabsTrigger value="supabase">
                      Guardado en Supabase
                    </TabsTrigger>
                    <TabsTrigger value="tecnicos">
                      Detalles técnicos
                    </TabsTrigger>
                  </TabsList>
                </div>
                <div className="pt-4">
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
                      ciudadesDisponibles={ciudadesDisponibles}
                      clavesConfirmadas={clavesConfirmadas}
                    />
                  </TabsContent>
                  <TabsContent value="carga">
                    <PestanaCarga
                      aCargar={aCargar}
                      bloqueoFiltros={erroresFiltro.length > 0}
                      carga={carga}
                      estadoSupabase={estadoSupabase}
                      simularFallo={simularFallo}
                      setSimularFallo={setSimularFallo}
                      onReintentar={() => void reintentarFallidos()}
                    />
                  </TabsContent>
                  <TabsContent value="supabase">
                    <PestanaSupabase
                      pendientesLocales={pendientesLocales}
                      confirmadosSesion={clavesConfirmadas.size}
                    />
                  </TabsContent>
                  <TabsContent value="tecnicos">
                    <div
                      role="radiogroup"
                      aria-label="Vista técnica"
                      className="mb-4 inline-flex flex-wrap gap-0.5 rounded-md bg-muted p-0.5"
                    >
                      {DETALLES.map((d) => (
                        <Button
                          key={d.id}
                          size="sm"
                          role="radio"
                          aria-checked={detalle === d.id}
                          variant={detalle === d.id ? "seleccion" : "ghost"}
                          onClick={() => setDetalle(d.id)}
                        >
                          {d.titulo}
                          {d.id === "rechazados" &&
                            ` (${formatoEntero(limpieza.valor.rechazados.length)})`}
                          {d.id === "transformados" &&
                            ` (${formatoEntero(totalExtraido)})`}
                        </Button>
                      ))}
                    </div>
                    {detalle === "rechazados" && (
                      <PestanaRechazados
                        rechazados={limpieza.valor.rechazados}
                        excluidosPorFiltros={validos.length - coinciden.length}
                      />
                    )}
                    {detalle === "transformados" && (
                      <PestanaTransformados resultado={transformacion.valor} />
                    )}
                    {detalle === "json" && (
                      <PestanaJson extraccion={extraccion} />
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          )}
        </Seccion>

        <footer className="text-sm text-muted-foreground">
          Datos meteorológicos de{" "}
          <a
            className="underline"
            href="https://open-meteo.com/"
            target="_blank"
            rel="noreferrer"
          >
            Open-Meteo.com
          </a>{" "}
          (CC BY 4.0). Mapa: Instituto Geográfico Nacional. Herramienta
          didáctica sin autenticación.
        </footer>
      </div>
    </>
  )
}
