# Guía de desarrollo y ejecución local

Guía práctica para ejecutar PayGrid en una máquina local. Audiencia: compañero del equipo con Windows + Docker Desktop; se indican alternativas Linux/macOS cuando son directas.

## 6.1 Requisitos

- Git.
- Docker Desktop (Windows/macOS) o Docker Engine (Linux) con el plugin de Docker Compose.

No se necesita Node.js, pnpm, PostgreSQL ni RabbitMQ en el host: todo corre en contenedores.

Verificación:

```powershell
docker --version
docker compose version
docker info
```

`docker info` debe responder sin error; si falla, el demonio de Docker no está corriendo.

## 6.2 Clone y entorno

```powershell
git clone https://github.com/DanielMarchenaMatarrita/Content-moderation-queue.git
cd Content-moderation-queue
Copy-Item .env.example .env
```

En Linux/macOS: `cp .env.example .env`.

`.env.example` trae las contraseñas **vacías**; hay que editar `.env` y definir valores no vacíos para:

| Variable | Uso |
| --- | --- |
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL (obligatoria: Compose aborta si está vacía) |
| `RABBITMQ_PASSWORD` | Contraseña de RabbitMQ (obligatoria: Compose aborta si está vacía) |

Variables opcionales verificadas en `.env.example`: `POSTGRES_DB` (`paygrid`), `POSTGRES_USER` (`paygrid`), `RABBITMQ_USER` (`paygrid`), `RABBITMQ_MANAGEMENT_PORT` (`15672`), `PAYGRID_BACKEND_IMAGE` y `PAYGRID_FRONTEND_IMAGE` (tags por defecto de Docker Hub).

`.env` está en `.gitignore`; **nunca** se commitéa. No hay archivo `.env` versionado en el repositorio.

## 6.3 Arranque completo

```powershell
docker compose up -d --build
docker compose ps
```

- `--build` fuerza la construcción de las imágenes desde el código fuente actual (obligatorio para trabajar con el código local).
- `-d` ejecuta los servicios en segundo plano.

Servicios esperados en `docker compose ps` (nombres exactos de `compose.yaml`): `postgres`, `rabbitmq`, `api`, `order-processor`, `frontend`.

Estado saludable: `postgres`, `rabbitmq`, `api` y `frontend` con healthcheck `healthy`; `order-processor` no define healthcheck (se valida por sus logs).

## 6.4 Migraciones de base de datos

Al arrancar, el servicio `api` ejecuta antes que NestJS:

```sh
./node_modules/.bin/prisma migrate deploy && node dist/apps/api/main.js
```

(definido en `compose.yaml`, servicio `api`). Por lo tanto:

- Las migraciones commiteadas en `backend/prisma/migrations/` se aplican automáticamente a cualquier base de datos nueva o existente.
- No es necesario ejecutar `prisma migrate dev` ni crear migraciones manualmente para usar el proyecto.
- Migraciones actuales: `20260922144756_init` (modelos históricos más las tablas compartidas `OutboxEvent` y `ProcessedMessage`), `20261003120000_add_paygrid_models`, `20261004120000_add_processing_attempt_order_attempt_unique`, `20261004130000_add_payment_order_reprocess_scenario`.
- `order-processor` **no** ejecuta migraciones: solo consume.

La creación de migraciones solo se necesita como recuperación real (por ejemplo, modificar `schema.prisma` y consolidar el cambio).

## 6.5 URLs locales

| Servicio | URL | Credenciales |
| --- | --- | --- |
| Frontend | <http://localhost:8080> | — |
| API | <http://localhost:3000> | — |
| Swagger | <http://localhost:3000/docs> | — |
| RabbitMQ Management | <http://localhost:15672> | `RABBITMQ_USER` (por defecto `paygrid`) y `RABBITMQ_PASSWORD` de `.env` |

Notas verificadas:

- El frontend llama a la API mediante el prefijo `/api`, que Nginx reescribe hacia `http://api:3000/` (`frontend/nginx.conf`). La API en sí **no** tiene prefijo de ruta global.
- RabbitMQ Management está publicado solo en `127.0.0.1` y su puerto se cambia con `RABBITMQ_MANAGEMENT_PORT` en `.env`.

## 6.6 Procedimiento de demo

1. Abra <http://localhost:8080> (Dashboard).
2. Pulse **Create order** (o vaya a `/orders/new`).
3. Cree una orden con escenario `SUCCESS` (por ejemplo: amount `15000`, currency `CRC`).
4. En el detalle verifique estado `SUCCESS`, `Retry count` 0 y un intento (`Initial attempt`, `SUCCESS`).
5. Cree una segunda orden con escenario `FAIL_TWICE`.
6. Observe el `Processing journey`: `Initial attempt` `ERROR` y `Retry 1` `ERROR` (hay ~5 s entre reintentos).
7. Verifique el resultado final: `SUCCESS` con `Retry count` 2 (tres intentos persistidos).
8. Cree una tercera orden con escenario `ALWAYS_FAIL`.
9. Observe los cuatro errores: `Initial attempt`, `Retry 1`, `Retry 2`, `Retry 3`.
10. Verifique estado `FAILED`, `Retry count` 3 y el aviso `Retry limit exhausted after 3 retries`.
11. Abra RabbitMQ Management (<http://localhost:15672>), entre a **Queues** y confirme que `payment-orders.dlq.v1` recibió el mensaje agotado.
12. Vuelva al detalle de la orden y pulse **Reprocess order** (la interfaz envía `scenario: "SUCCESS"`).
13. Tras el sondeo, verifique `SUCCESS` con el intento 5 etiquetado **Manual reprocess**, y confirme que `Original scenario` sigue siendo `ALWAYS_FAIL` y `Recovery scenario` muestra `SUCCESS`, con los intentos 1–4 intactos.

La recuperación **no** es un replay del mensaje de la DLQ: crea un evento nuevo y reutiliza la cola principal.

## 6.7 Comandos útiles

| Comando | Utilidad |
| --- | --- |
| `docker compose ps` | Estado de los cinco servicios y healthchecks |
| `docker compose logs -f` | Logs de todos los servicios en vivo |
| `docker compose logs -f api` | Logs de la API: migraciones, ciclo del Outbox Publisher |
| `docker compose logs -f order-processor` | Logs del consumidor: entrega, retry, dead-letter |
| `docker compose logs -f rabbitmq` | Logs del broker: conexiones, declaraciones |
| `docker compose restart` | Reinicia servicios sin reconstruir imágenes |
| `docker compose down` | Detiene y elimina los contenedores (conserva volúmenes) |

## 6.8 Actualizar código local

```powershell
git switch main
git pull --ff-only origin main
docker compose up -d --build
```

- `--ff-only` evita merges sorpresos si su rama local divergió.
- El archivo `.env` local se conserva sin cambios; no hay que regenerarlo.
- En una rama de documentación o feature, sustituya `main` por el nombre de la rama y ejecute igualmente `docker compose up -d --build`.

## 6.9 Solución de problemas

| Síntoma | Causa probable | Acción |
| --- | --- | --- |
| `docker: command not found` | Docker no instalado o fuera de PATH | Instale Docker Desktop y reinicie la terminal |
| `Docker daemon is not available` | Docker Desktop detenido | Inicie Docker Desktop y repita `docker info` |
| Compose aborta con `Set POSTGRES_PASSWORD in .env` | `.env` con contraseñas vacías | Edite `.env` y defina `POSTGRES_PASSWORD` y `RABBITMQ_PASSWORD` no vacíos; vuelva a ejecutar `docker compose up -d --build` |
| Puerto ocupado (`8080`, `3000`, `15672`) | Otro proceso usando el puerto | `docker compose ps`; libere el puerto o cambie `RABBITMQ_MANAGEMENT_PORT` en `.env` para la consola de RabbitMQ |
| El contenedor `api` falla al arrancar | Fallo en `prisma migrate deploy` | `docker compose logs api`; verifique credenciales de `.env` y que la migración exista en `backend/prisma/migrations/` |
| `api`/`order-processor` reintentan conexión a RabbitMQ | Broker aún arrancando o credenciales incorrectas | `docker compose logs rabbitmq`; verifique `RABBITMQ_PASSWORD` y el healthcheck (`healthy`) |
| Servicio marcado `unhealthy` en `docker compose ps` | Healthcheck fallando | `docker compose logs <servicio>`; el healthcheck de `api` hace un `fetch` a `http://127.0.0.1:3000` |
| Se ejecuta código antiguo | Imagen previa en lugar de build local | `docker compose up -d --build`; evite `run.ps1`/`deploy.sh` (hacen `pull` + `--no-build`) y evite `docker compose pull` |
| Frontend muestra recursos desactualizados | Build de frontend viejo o caché del navegador | `docker compose build frontend && docker compose up -d frontend`; recargue con hard refresh |

## 6.10 Persistencia de datos

Los datos viven en volúmenes con nombre: `postgres_data` (PostgreSQL) y `rabbitmq_data` (RabbitMQ).

```powershell
docker compose down      # conserva los volúmenes: órdenes e intentos persisten
docker compose down -v   # ELIMINA los volúmenes: borra los datos de PostgreSQL y RabbitMQ
```

> **Advertencia:** `-v` borra de forma permanente todas las órdenes, intentos, eventos outbox, mensajes procesados y la configuración de RabbitMQ.

## 6.11 Docker Hub vs Docker Compose

- **Docker Compose** orquesta y ejecuta los servicios localmente; puede construir desde el código fuente (`--build`) o usar una imagen ya existente.
- **Docker Hub** almacena y distribuye imágenes; es un registro, no un orquestador.
- El flujo de incorporación por código fuente (`docker compose up -d --build`) **no** requiere publicar ni descargar nada de Docker Hub.
- Tags referenciados por defecto: `danieleng96/paygrid-backend:1.0.0` y `danieleng96/paygrid-frontend:1.0.0` (en `compose.yaml` y `.env.example`). Este repositorio **no** contiene ningún workflow que los publique; la publicación no está verificada aquí.
- Los tags se prepararon en el commit `44c332e` (`chore(paygrid): prepare Docker Hub and deployment runtime`), **anterior** a los cambios de observabilidad de frontend (`e25e576`) y de recuperación manual (`4d4520f`). Cualquier imagen `1.0.0` publicada en esa preparación es más antigua que el código actual.
- Por eso **no** se recomienda `docker compose pull` ni `docker compose up --no-build` para incorporarse al proyecto: pueden ejecutar imágenes antiguas sin la implementación actual de frontend y recuperación.

Detalle mecánico: Compose declara `build` e `image` a la vez, de modo que `--build` crea la imagen local con el nombre `danieleng96/...:1.0.0`. Un `docker compose pull` posterior sobrescribiría esa etiqueta local con la versión del registro.

## 6.12 Colaboración Git

- `main` = integración compartida: cambios revisados mediante pull request, sin cambios directos sin revisión.
- Ramas de feature (`feat/...`) para implementación; ramas de documentación (`docs/...`) para entregables de documentación como esta.
- Los PRs se revisan antes de fusionarse (flujo del repositorio: PR #14 es el último integrado).
- No commitear `.env`, imágenes, artefactos de build ni reportes operativos de agentes.

## Referencia de la API

Base: **sin prefijo global**. Rutas servidas directamente por la API en `http://localhost:3000`. El frontend las consume a través del proxy Nginx `/api/` → `http://api:3000/`.

| Método | Ruta | Descripción | Éxito | Errores |
| --- | --- | --- | --- | --- |
| `POST` | `/orders` | Crea una orden de pago para procesamiento asíncrono | `201` | `400` entrada inválida |
| `GET` | `/orders` | Lista órdenes; query `page` (def. 1), `limit` (def. 20, máx. 100), `status` | `200` | `400` |
| `GET` | `/orders/stats` | Conteos: `total`, `pending`, `successful`, `failed`, `retried`, `totalAttempts` | `200` | — |
| `GET` | `/orders/:id` | Detalle de la orden incluyendo `attempts[]` | `200` | `400` UUID inválido, `404` |
| `GET` | `/orders/:id/attempts` | Intentos de procesamiento ordenados por `attemptNumber` | `200` | `400`, `404` |
| `POST` | `/payment-orders/:id/reprocess` | Recuperación manual de una orden `FAILED` | `201` | `400`, `404`, `409` estado distinto de `FAILED` |

La ruta de recuperación usa el prefijo `/payment-orders` (no `/orders`).

### Ejemplos

Crear orden — `POST /orders`:

```json
{
  "amount": 15000,
  "currency": "CRC",
  "simulationScenario": "SUCCESS"
}
```

Respuesta (`201`): la orden con `status` `PENDING`, `retryCount` 0 y `submissionEventId` (UUID del evento Outbox creado).

Recuperación manual — `POST /payment-orders/<id-uuid>/reprocess`:

```json
{
  "scenario": "SUCCESS"
}
```

Respuesta (`201`): la orden con `status` `PENDING`, `reprocessScenario` fijado y `reprocessEventId` (UUID del evento nuevo). `409 Conflict` si la orden no está en `FAILED`; `404 Not Found` si el id no existe.

### Semántica de los campos

- **`status` de la orden:** `PENDING` (esperando o en ciclo de retry), `SUCCESS`, `FAILED`. El enum define también `PROCESSING`, pero el código actual nunca lo escribe.
- **`retryCount`:** reintentos consumidos en el ciclo actual (0–3). 3 significa ciclo agotado.
- **`simulationScenario`:** escenario original, inmutable.
- **`reprocessScenario`:** escenario de la recuperación; `null` si nunca se recuperó.
- **Elegibilidad de recuperación:** solo `FAILED`.
- **`ProcessingAttempt`:** `attemptNumber` 1‑N, `status` `SUCCESS`/`ERROR`, `errorDescription` nullable.

### Swagger

Disponible en <http://localhost:3000/docs>. El título mostrado es `Content Moderation Queue API` (identificador heredado de la iteración histórica; el contenido documentado es el de PayGrid).

El API conserva además rutas históricas de Content Moderation Queue (`/contents`, `/users`, `/internal/outbox-events`, `/internal/processed-messages` y lecturas de moderación) que el flujo actual de PayGrid no utiliza.
