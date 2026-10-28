# Primer pipeline ETL: Open-Meteo → Supabase

Práctica de Big Data. La aplicación extrae datos meteorológicos horarios de la
[API histórica de Open-Meteo](https://open-meteo.com/en/docs/historical-weather-api),
los transforma, limpia y filtra, y carga en Supabase solo los registros que tú
seleccionas. La página se organiza en tres pasos (descarga, visualización y
subida a la base de datos) y la cabecera muestra el estado de cada uno. El
detalle técnico de cada fase está en la «Vista avanzada» del paso 3.

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui (Base UI)
y `@supabase/supabase-js`. El efecto de cristal líquido de los botones y del
mapa usa [liquidGL](https://github.com/naughtyduk/liquidGL) (`liquid-gl`, MIT);
si el navegador no tiene WebGL, se muestra un cristal hecho solo con CSS.

## Instalación

```bash
npm install
cp .env.example .env.local   # y rellena los valores
```

### Variables de entorno

| Variable | Dónde se usa | Notas |
| --- | --- | --- |
| `SUPABASE_URL` | servidor | URL del proyecto. Si no existe, se usa `NEXT_PUBLIC_SUPABASE_URL`. |
| `SUPABASE_SECRET_KEY` | **solo servidor** | Clave `sb_secret_…` (o `service_role`). Si no existe, se usa `NEXT_SECRET_SUPABASE_SERVICE_KEY`. |
| `ETL_PERMITIR_EN_PRODUCCION` | servidor | Ponla a `true` solo cuando hayas añadido autenticación. |

La clave secreta omite RLS, así que **nunca** debe llevar el prefijo
`NEXT_PUBLIC_`, porque eso la incluiría en el JavaScript del navegador.

### Migración de la base de datos

Ejecuta
[`supabase/migrations/20261026120000_crear_mediciones_meteorologicas.sql`](supabase/migrations/20261026120000_crear_mediciones_meteorologicas.sql)
en el **SQL Editor** de Supabase, o con `supabase db push` si usas la CLI.
La migración:

- crea `mediciones_meteorologicas` con la clave única `(ciudad, fecha_hora)`;
- añade restricciones: humedad entre 0 y 100, precipitación ≥ 0, valores finitos;
- activa RLS **sin políticas**, de modo que `anon` y `authenticated` no tienen acceso;
- concede `select, insert, update` únicamente a `service_role`. Desde el 30-10-2026,
  Supabase ya no expone a la Data API las tablas nuevas sin un `GRANT` explícito.

## Ejecución

```bash
npm run dev                # http://localhost:3000
npm test                   # pruebas unitarias con fixtures controlados
ETL_URL_BASE=http://localhost:3000 npm run test:integracion   # requiere `npm run dev`
npm run typecheck && npm run lint && npm run build
npm run generar:mapa       # regenera lib/etl/mapa-espana.ts (provincias del IGN)
```

## El pipeline

1. **Extracción**: se hace una petición `GET` por ciudad, con `timezone=GMT`,
   °C y mm. Las peticiones van una detrás de otra y se puede ver qué ciudades
   ya se han procesado. El JSON original se guarda en memoria mientras la página
   esté abierta y se puede descargar. Si una ciudad falla, puedes reintentar
   solo esa ciudad. El reintento **sustituye** su respuesta, así que no se
   duplican datos. Cada extracción admite como máximo 31 días.
2. **Transformación**: los arrays paralelos de `hourly` se convierten en un
   registro por ciudad y hora. La hora `2026-09-01T13:00` se interpreta
   explícitamente como UTC. Si los arrays tienen longitudes distintas, se avisa
   y las posiciones sin valor quedan como «ausentes».
3. **Limpieza**: se rechazan los registros que no tienen ciudad o fecha válida,
   y los que tienen alguna medición ausente, `null`, vacía, no numérica o no
   finita. También se rechazan una humedad fuera de 0–100 y una precipitación
   negativa. Cada rechazo indica su motivo. **Ningún nulo se convierte en 0**,
   y las temperaturas extremas no se descartan. **Duplicados**: se conserva la
   primera aparición válida en el orden de extracción (ciudad y posición en el
   array), y las siguientes se rechazan indicando qué posición se conservó.
4. **Filtrado y selección**: el orden es válidos → filtros → ordenación →
   selección. La paginación solo afecta a lo que se ve en pantalla. Se suben
   únicamente las filas seleccionadas que **siguen** cumpliendo los filtros, y
   la aplicación indica cuántas seleccionadas quedan fuera de ellos. Los
   descartes por calidad (en «Rechazados») se muestran aparte de los registros
   excluidos por los filtros.
5. **Carga**: al pulsar el botón se congela una copia del conjunto en el orden
   elegido. Se envía al servidor en lotes de 500 como máximo. El servidor vuelve
   a validar cada registro y el tamaño de la petición, y después hace un
   `upsert` con `onConflict: ciudad,fecha_hora`. Un lote que falla no afecta a
   los anteriores y se puede reintentar. Después se comprueba, también por
   lotes, que las claves enviadas existen en la tabla. Supabase no distingue
   entre inserciones y actualizaciones, así que la aplicación no inventa esos
   recuentos. `importado_en` guarda la fecha de la primera inserción.

> Una base de datos no conserva el orden de inserción. Para leer los datos en un
> orden concreto, la consulta necesita `ORDER BY`. La pestaña «Datos en
> Supabase» siempre ordena de forma explícita.

En modo desarrollo hay una casilla de práctica para **simular el fallo** de un
lote, de modo que puedas probar el reintento. El servidor responde 503 sin tocar
la base de datos.

## Seguridad

- Todas las escrituras y lecturas en Supabase pasan por los route handlers de
  `app/api/supabase/*`. Esos handlers usan `lib/supabase/servidor.ts`, que lleva
  la marca `server-only`.
- La aplicación **no tiene autenticación**. Por eso, en producción esos
  endpoints responden 403, salvo que actives `ETL_PERMITIR_EN_PRODUCCION=true`.
  **Antes de publicarla, protege los endpoints**, por ejemplo con Supabase Auth.
- La aplicación no escribe credenciales en los logs.

## Estructura

```
lib/etl/          lógica pura del pipeline (transformar, limpiar, filtrar, carga)
lib/supabase/     cliente de servidor y utilidades
app/api/supabase/ estado, cargar, verificar, registros
components/etl/   interfaz (pipeline, configuración y pestañas)
hooks/            estado de la extracción y de la carga
tests/            fixtures controlados, pruebas unitarias e integración
```
