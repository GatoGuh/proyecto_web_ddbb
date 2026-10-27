// Fixtures CONTROLADOS para las pruebas. No se usan nunca en la aplicación ni
// se mezclan con extracciones reales.

const horas = (dia: string, n = 24) =>
  Array.from({ length: n }, (_, h) => `${dia}T${String(h).padStart(2, "0")}:00`)

/** Misma forma que una respuesta real de un día (Barcelona, 2026-09-01). */
export const respuestaUnDia = {
  latitude: 41.441124,
  longitude: 2.2014387,
  utc_offset_seconds: 0,
  timezone: "GMT",
  timezone_abbreviation: "GMT",
  hourly_units: {
    time: "iso8601",
    temperature_2m: "°C",
    relative_humidity_2m: "%",
    precipitation: "mm",
  },
  hourly: {
    time: horas("2026-09-01"),
    temperature_2m: [
      24.2, 23.6, 23.0, 22.6, 22.2, 21.8, 22.0, 24.7, 27.0, 28.2, 28.8, 28.4,
      28.8, 29.0, 28.1, 28.5, 28.1, 27.5, 27.1, 26.6, 26.2, 25.6, 25.2, 24.6,
    ],
    relative_humidity_2m: [
      77, 80, 81, 81, 82, 84, 83, 70, 58, 53, 52, 56, 58, 58, 59, 56, 57, 58,
      59, 61, 64, 67, 69, 73,
    ],
    precipitation: Array.from({ length: 24 }, () => 0),
  },
}

/** Respuesta con problemas de calidad deliberados. */
export const respuestaConProblemas = {
  utc_offset_seconds: 0,
  hourly: {
    time: [
      "2026-09-02T00:00", // 0 válido
      "2026-09-02T01:00", // 1 temperatura null
      "2026-09-02T02:00", // 2 humedad ""
      "2026-09-02T03:00", // 3 válido
      "2026-09-02T04:00", // 4 humedad 101
      "2026-09-02T05:00", // 5 precipitación negativa
      "2026-09-02T06:00", // 6 temperatura extrema (se conserva)
      "2026-09-31T07:00", // 7 fecha imposible
      "2026-09-02T08:00", // 8 precipitación como cadena
      "2026-09-02T00:00", // 9 duplicado de la posición 0
    ],
    temperature_2m: [20, null, 21, 22, 23, 24, 55.3, 25, 26, 99],
    relative_humidity_2m: [50, 50, "", 50, 101, 50, 50, 50, 50, 50],
    precipitation: [0, 0, 0, 0, 0, -0.1, 0, 0, "0.2", 0],
  },
}

/** Arrays con longitudes incoherentes: la humedad tiene un valor menos. */
export const respuestaLongitudesIncoherentes = {
  utc_offset_seconds: 0,
  hourly: {
    time: horas("2026-09-03", 3),
    temperature_2m: [10, 11, 12],
    relative_humidity_2m: [40, 41],
    precipitation: [0, 0, 0],
  },
}
