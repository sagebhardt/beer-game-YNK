# Beer Game YNK

Simulación web del **Beer Distribution Game** en dos modos:
- **Multijugador** (4 participantes)
- **Test** (1 participante controlando los 4 roles)

Incluye panel de administración para monitoreo en tiempo real, analytics y exportación CSV/Excel.

## Descripción

Cuatro roles (Minorista, Mayorista, Distribuidor y Fábrica) gestionan inventario y pedidos por turnos. El objetivo es minimizar el costo total de la cadena mientras enfrentan retrasos de 4 semanas entre pedidos y entregas.

En modo **Test**, una sola persona toma las decisiones de los cuatro roles en una vista por columnas.

## Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4
- **Backend**: Node.js + Socket.io (servidor personalizado para sincronización en tiempo real)
- **Base de datos**: SQLite via Prisma 6
- **Gráficos**: Chart.js + react-chartjs-2
- **Deployment**: Railway via Docker con volumen persistente

## Reglas del juego

| Concepto | Valor |
|---|---|
| Roles | Minorista → Mayorista → Distribuidor → Fábrica |
| Costo de inventario | $0.50/unidad/semana |
| Costo de backlog | $1.00/unidad/semana |
| Inventario inicial | 12 unidades por jugador |
| Retraso de pedidos | 2 semanas |
| Retraso de envío | 2 semanas |
| Lead time total | 4 semanas |

## Setup local

```bash
# Clonar
git clone https://github.com/sagebhardt/beer-game-YNK.git
cd beer-game-YNK

# Instalar dependencias
npm install

# Configurar base de datos
echo 'DATABASE_URL="file:./dev.db"' > .env
echo 'ADMIN_PANEL_KEY="cambia-esta-clave"' >> .env
npx prisma db push

# Correr en desarrollo (con Socket.io)
npm run dev
```

Abrir http://localhost:3000

## Comandos

```bash
npm run dev          # Dev server (Next.js + Socket.io)
npm run build        # Build de producción
npm run start        # Server de producción
npx prisma studio    # Visual DB browser
npx prisma db push   # Aplicar schema a la DB local
```

## Patrones de demanda

| Preset | Descripción |
|---|---|
| Clásico (Escalón) | 4 uds × 4 semanas, luego 8 uds |
| Estable | Constante 4 uds |
| Gradual | +1 ud cada 4 semanas |
| Pico | Pico a 16 en semana 5, luego vuelve a 4 |
| Estacional | Oscila entre 2 y 10 |

La demanda no se configura en la creación pública del juego. Se gestiona desde `/admin` y solo mientras la partida esté en `LOBBY`.

## Flujo del juego

1. **Creación de partida** en modo multijugador o test
2. **Multijugador**: participantes se unen por código, seleccionan rol y el anfitrión inicia
3. **Test**: el juego inicia automáticamente y un solo usuario carga pedidos para los 4 roles
4. **Cada ronda**: se procesan pedidos, envíos, inventario y backlog
5. **Fin del juego**: resultados y gráficos (Bullwhip, inventario, costos)

## Panel admin

Ruta: `/admin`

Funciones principales:
- Login por clave (`ADMIN_PANEL_KEY`)
- Listado en vivo de juegos `LOBBY`, `ACTIVE` y `COMPLETED`
- Acciones: `Cerrar`, `Terminar`, `Eliminar`
- Edición de demanda por preset (solo en `LOBBY`)
- Analytics por juego y agregados históricos
- Exportación de datos en CSV y Excel (`.xlsx`)

## Deployment en Railway

Ver [DEPLOYMENT.md](DEPLOYMENT.md) para instrucciones detalladas.

Resumen rápido:
1. Conectar repo en Railway
2. Crear Volume (1GB) montado en `/app/data`
3. Configurar `DATA_DIR=/app/data` y dejar `Start Command` vacío en Railway (usar `CMD` del Dockerfile)
4. Deploy automático desde Dockerfile

## Estructura del proyecto

```
├── prisma/schema.prisma        # Schema: Game, Player, PlayerRound, PipelineItem, Round
├── server.ts                   # Servidor: Next.js + Socket.io
├── src/
│   ├── app/
│   │   ├── page.tsx            # Landing: Crear / Unirse
│   │   ├── crear/              # Crear partida
│   │   ├── unirse/             # Unirse a partida
│   │   ├── admin/              # Panel admin + detalle por juego
│   │   ├── juego/[code]/
│   │   │   ├── lobby/          # Sala de espera + selección de rol
│   │   │   ├── jugar/          # Tablero del jugador
│   │   │   ├── test/           # Modo test (4 columnas, 1 persona)
│   │   │   ├── host/           # Vista del anfitrión
│   │   │   └── resultados/     # Gráficos post-juego
│   │   └── api/
│   │       ├── games/          # Juego normal + test + resultados
│   │       ├── admin/          # Auth, gestión, analytics, export
│   │       └── session/        # Obtener session ID
│   ├── components/
│   │   ├── ui/                 # Button, Card, Input, Select, Badge
│   │   └── game/               # ResultsCharts (Chart.js)
│   └── lib/
│       ├── game-engine.ts      # Motor de simulación
│       ├── socket-handlers.ts  # Handlers de Socket.io
│       ├── types.ts            # Roles, presets de demanda
│       └── session.ts          # Sesiones via cookie
├── Dockerfile                  # Multi-stage build para Railway
└── railway.toml                # Config de Railway
```

## Licencia

MIT
