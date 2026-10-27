"use client"

import * as React from "react"
import { extraerCiudad } from "@/lib/etl/extraer"

export type EstadoPeticion = "pendiente" | "en_curso" | "completada" | "error"

export type PeticionCiudad = {
  ciudad: string
  estado: EstadoPeticion
  url?: string
  error?: string
  /** JSON original tal como llegó de Open-Meteo. */
  json?: unknown
  duracionMs?: number
  intentos: number
}

export type Extraccion = {
  inicio: string
  fin: string
  ciudades: string[]
  peticiones: Record<string, PeticionCiudad>
}

export function useExtraccion() {
  const [extraccion, setExtraccion] = React.useState<Extraccion | null>(null)
  const [enCurso, setEnCurso] = React.useState(false)
  const bloqueo = React.useRef(false)

  const actualizar = React.useCallback(
    (ciudad: string, cambios: Partial<PeticionCiudad>) =>
      setExtraccion((e) =>
        e
          ? {
              ...e,
              peticiones: {
                ...e.peticiones,
                [ciudad]: { ...e.peticiones[ciudad], ...cambios },
              },
            }
          : e
      ),
    []
  )

  const pedir = React.useCallback(
    async (ciudad: string, inicio: string, fin: string, intentos: number) => {
      actualizar(ciudad, { estado: "en_curso", error: undefined, intentos })
      const r = await extraerCiudad(ciudad, inicio, fin)
      // Un reintento SUSTITUYE la respuesta de la ciudad: nunca se acumula,
      // por lo que no puede duplicar registros.
      actualizar(
        ciudad,
        r.ok
          ? {
              estado: "completada",
              url: r.url,
              json: r.json,
              duracionMs: r.duracionMs,
            }
          : {
              estado: "error",
              url: r.url,
              error: r.error,
              json: undefined,
              duracionMs: r.duracionMs,
            }
      )
    },
    [actualizar]
  )

  const extraer = React.useCallback(
    async (ciudades: string[], inicio: string, fin: string) => {
      if (bloqueo.current) return
      bloqueo.current = true
      setEnCurso(true)
      setExtraccion({
        inicio,
        fin,
        ciudades,
        peticiones: Object.fromEntries(
          ciudades.map((c) => [
            c,
            { ciudad: c, estado: "pendiente", intentos: 0 },
          ])
        ),
      })
      try {
        // En secuencia: se ve qué ciudad se procesa y se respeta la API pública.
        for (const ciudad of ciudades) await pedir(ciudad, inicio, fin, 1)
      } finally {
        bloqueo.current = false
        setEnCurso(false)
      }
    },
    [pedir]
  )

  const reintentar = React.useCallback(
    async (ciudad: string) => {
      if (bloqueo.current || !extraccion) return
      const peticion = extraccion.peticiones[ciudad]
      if (!peticion) return
      bloqueo.current = true
      setEnCurso(true)
      try {
        await pedir(
          ciudad,
          extraccion.inicio,
          extraccion.fin,
          peticion.intentos + 1
        )
      } finally {
        bloqueo.current = false
        setEnCurso(false)
      }
    },
    [extraccion, pedir]
  )

  return { extraccion, enCurso, extraer, reintentar }
}
