# Plan definitivo: Admin en tiempo real + analytics/export + modo Test + control de demanda

## Resumen
Vamos a extender el proyecto en 4 frentes integrados:
1. Quitar la configuración de demanda del flujo público de creación.
2. Crear panel `/admin` protegido por clave para gestionar juegos (`LOBBY`, `ACTIVE`, `COMPLETED`) con acciones `cerrar/terminar` y `eliminar`.
3. Implementar modo `TEST` (1 persona controlando los 4 roles en columnas).
4. Agregar monitoreo admin en tiempo real, analytics (juego + histórico) y exportación en `CSV` y `XLSX`.

## Alcance funcional acordado
- Admin con clave en `/admin`.
- `cerrar` y `terminar` funcionan como finalización administrativa.
- Modo test manual: un usuario ingresa pedidos de los 4 roles por ronda.
- Demanda editable por admin solo en `LOBBY`.
- Panel admin lista también juegos `LOBBY`.
- Demanda oculta durante juego para usuarios normales; visible al final.
- Monitoreo en tiempo real: dashboard global + detalle por juego.
- Analytics: por juego individual y agregado histórico.
- Exportación: `CSV` + `XLSX` desde el inicio.

## Cambios de datos y tipos públicos
- `Game.mode`: `MULTI | TEST` (default `MULTI`).
- `Game.controllerSessionId`: `string | null` (obligatorio lógico en `TEST`).
- `Game.demandPresetKey`: `string` (default `classic`).
- `Game.endedAt`: `DateTime | null`.
- `Game.endedReason`: `NATURAL | ADMIN_TERMINATED | ADMIN_CLOSED | null`.
- `Game.status` se mantiene en `LOBBY | ACTIVE | COMPLETED`.

## Backend (API + sockets)
1. Admin auth:
- `POST /api/admin/session` valida clave (`ADMIN_PANEL_KEY`) y setea cookie httpOnly.
- `GET /api/admin/session` estado de sesión admin.
- `DELETE /api/admin/session` logout.
- Guard central para todo `/api/admin/*`.

2. Gestión de juegos admin:
- `GET /api/admin/games` con filtros por `status`, `mode`, búsqueda por código/nombre.
- `PATCH /api/admin/games/[code]/demand` permitido solo en `LOBBY`.
- `POST /api/admin/games/[code]/close` finaliza juego con `endedReason=ADMIN_CLOSED`.
- `POST /api/admin/games/[code]/terminate` finaliza juego con `endedReason=ADMIN_TERMINATED`.
- `DELETE /api/admin/games/[code]` elimina juego (cascade).

3. Creación pública y visibilidad:
- `POST /api/games` ignora cualquier demanda enviada desde cliente público.
- En estado activo/lobby para no-admin, no devolver `demandPattern` completo.
- `GET /api/games/[code]/results` devuelve resultados finales con demanda completa.

4. Modo TEST:
- `POST /api/games` acepta `mode`.
- En `TEST`, bloquear joins de terceros.
- `GET /api/games/[code]/test-state` solo para `controllerSessionId`.
- `POST /api/games/[code]/test-round` recibe los 4 pedidos y procesa ronda en una transacción.

5. Monitoreo real-time admin:
- Reusar Socket.IO y agregar canal admin con sala `admin:dashboard` y `admin:game:{code}`.
- Emitir eventos admin en: creación, join, selección de rol, start, envío de pedido, avance de ronda, finalización, eliminación.
- Eventos nuevos:
- `admin-game-upsert` (snapshot resumido por juego).
- `admin-game-removed` (cuando se elimina).
- `admin-game-detail` (snapshot detallado de un juego).

## Frontend
1. `/crear`:
- Quitar selector de demanda.
- Agregar selector `Multijugador` / `Test (1 persona)`.

2. `/admin`:
- Login por clave.
- Dashboard en vivo con tabla de juegos y filtros.
- Acciones por fila: `Cerrar`, `Terminar`, `Eliminar`.
- Indicadores en vivo: estado, ronda, roles enviados, modo, última actividad.

3. `/admin/juegos/[code]`:
- Vista detalle en vivo.
- Sección Monitor: estado ronda a ronda, submissions, inventario/backlog/costo por rol, pipeline.
- Sección Configuración: editar demanda solo si `LOBBY`.
- Sección Analytics: KPIs y gráficos de ese juego.
- Sección Exportación: botones `CSV` y `Excel`.

4. `/juego/[code]/test`:
- 4 columnas (Retailer, Wholesaler, Distributor, Factory).
- Cada columna con stats y input de pedido.
- Botón único de procesar ronda.
- Redirección a resultados al completar.

## Analytics (definición cerrada)
1. KPIs por juego:
- Costo total cadena.
- Costo total por rol.
- Backlog máximo por rol y cadena.
- Inventario promedio por rol.
- Índice bullwhip por rol: `stddev(orderPlacedRol) / stddev(demand)`.

2. Analytics históricos admin:
- Totales de juegos por estado y modo.
- Costo promedio/mediana por juego.
- Bullwhip promedio por rol.
- Top peores/mejores juegos por costo total.
- Serie temporal diaria por fecha de finalización.

3. Endpoints:
- `GET /api/admin/analytics/overview?from=&to=&mode=`.
- `GET /api/admin/analytics/games/[code]`.

## Exportación CSV/XLSX (definición cerrada)
1. Endpoints:
- `GET /api/admin/exports/games/[code]?format=csv`.
- `GET /api/admin/exports/games/[code]?format=xlsx`.
- `GET /api/admin/exports/overview?format=csv|xlsx&from=&to=&mode=`.

2. Contenido exportado por juego:
- Resumen del juego.
- Serie por ronda y rol (orders, shipments, inventory, backlog, costs).
- Submissions por ronda.
- Pipeline relevante por ronda.

3. Formato:
- CSV con UTF-8 BOM, delimitador coma.
- XLSX con hojas: `Resumen`, `Rondas`, `Submissions`, `Pipeline`.
- Nombres de archivo con código y fecha (`BEER-123_2026-02-20.xlsx`).

## Pruebas y criterios de aceptación
- Crear juego sin campo de demanda en UI pública.
- Admin puede editar demanda solo en `LOBBY`.
- Dashboard admin recibe actualizaciones en vivo sin refresh manual.
- Detalle admin refleja en vivo envíos de pedidos y avance de ronda.
- `cerrar`/`terminar` pasan el juego a `COMPLETED` y expulsan flujo activo correctamente.
- `eliminar` remueve todo y notifica en tiempo real al dashboard.
- Modo TEST permite jugar end-to-end una partida completa con 1 usuario.
- Analytics por juego e histórico retornan valores coherentes con datos reales.
- Export CSV y XLSX descargan archivos válidos y completos.
- Usuarios no admin no pueden acceder a APIs admin ni ver demanda durante juego.
- `npm run build` debe pasar y documentación actualizada (`README.md`, `PLAN.md`, `DEPLOYMENT.md`).

## Supuestos explícitos
- `cerrar` y `terminar` comparten efecto de finalizar, diferenciados por `endedReason`.
- No se implementa sistema de usuarios, solo clave admin por entorno.
- Export de Excel se implementa con librería `xlsx`.
- Se mantiene compatibilidad total del flujo multijugador actual.
