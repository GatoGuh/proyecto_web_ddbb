"use client"

import * as React from "react"
import {
  comprobarHttp,
  crearLotes,
  enviarHttp,
  procesarLotes,
  verificarEnDestino,
  type Lote,
} from "@/lib/etl/carga"
import type { RegistroValido } from "@/lib/etl/tipos"

export type Verificacion =
  | { estado: "en_curso" }
  | { estado: "completada"; comprobadas: number; faltan: string[] }
  | { estado: "error"; error: string }

export type Carga = {
  /** Copia congelada del conjunto seleccionado, en el orden elegido. */
  congelados: RegistroValido[]
  lotes: Lote[]
  enCurso: boolean
  duracionMs: number
  verificacion?: Verificacion
}

export function useCarga() {
  const [carga, setCarga] = React.useState<Carga | null>(null)
  const [clavesConfirmadas, setClavesConfirmadas] = React.useState<
    ReadonlySet<string>
  >(() => new Set())
  const bloqueo = React.useRef(false)
  const lotesRef = React.useRef<Lote[]>([])

  const ejecutar = React.useCallback(
    async (numeros: number[], simularFalloEn?: number) => {
      const t0 = performance.now()
      setCarga((c) => c && { ...c, enCurso: true, verificacion: undefined })
      const lotes = await procesarLotes(
        lotesRef.current,
        numeros,
        enviarHttp,
        (lote) =>
          setCarga(
            (c) =>
              c && {
                ...c,
                lotes: c.lotes.map((l) =>
                  l.numero === lote.numero ? lote : l
                ),
              }
          ),
        simularFalloEn
      )
      lotesRef.current = lotes

      // Verificación en destino de todo lo que Supabase confirmó.
      const enviados = lotes
        .filter((l) => l.estado === "completado")
        .flatMap((l) => l.registros)
      let verificacion: Verificacion | undefined
      if (enviados.length > 0) {
        setCarga((c) => c && { ...c, verificacion: { estado: "en_curso" } })
        const v = await verificarEnDestino(enviados, comprobarHttp)
        if (v.ok) {
          verificacion = {
            estado: "completada",
            comprobadas: v.comprobadas,
            faltan: v.faltan,
          }
          setClavesConfirmadas((prev) => new Set([...prev, ...v.confirmadas]))
        } else {
          verificacion = { estado: "error", error: v.error }
        }
      }
      setCarga(
        (c) =>
          c && {
            ...c,
            lotes,
            enCurso: false,
            duracionMs: c.duracionMs + (performance.now() - t0),
            verificacion,
          }
      )
    },
    []
  )

  const iniciar = React.useCallback(
    async (registros: RegistroValido[], simularFallo = false) => {
      if (bloqueo.current || registros.length === 0) return
      bloqueo.current = true
      try {
        const lotes = crearLotes(registros)
        lotesRef.current = lotes
        setCarga({
          congelados: lotes.flatMap((l) => l.registros),
          lotes,
          enCurso: true,
          duracionMs: 0,
        })
        const loteFallido = simularFallo ? Math.min(2, lotes.length) : undefined
        await ejecutar(
          lotes.map((l) => l.numero),
          loteFallido
        )
      } finally {
        bloqueo.current = false
      }
    },
    [ejecutar]
  )

  const reintentarFallidos = React.useCallback(async () => {
    if (bloqueo.current) return
    const fallidos = lotesRef.current
      .filter((l) => l.estado === "error")
      .map((l) => l.numero)
    if (fallidos.length === 0) return
    bloqueo.current = true
    try {
      await ejecutar(fallidos)
    } finally {
      bloqueo.current = false
    }
  }, [ejecutar])

  return { carga, clavesConfirmadas, iniciar, reintentarFallidos }
}
