# Beer Game YNK

Simulación web multijugador del **Beer Distribution Game** — un modelo clásico de cadena de suministro que demuestra el **Efecto Látigo (Bullwhip Effect)** a través de retrasos temporales e información limitada.

## Descripción

Cuatro jugadores (Minorista, Mayorista, Distribuidor y Fábrica) gestionan inventario y pedidos por turnos. El objetivo es minimizar el costo total de la cadena mientras enfrentan retrasos de 4 semanas entre pedidos y entregas.

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

## Flujo del juego

1. **Anfitrión crea partida** → recibe código de acceso (ej: `BEER-123`)
2. **Jugadores se unen** con código + nombre → seleccionan rol en el lobby
3. **Anfitrión inicia** cuando los 4 roles están asignados
4. **Cada ronda**: jugadores ven pedidos entrantes, inventario, backlog → envían pedido
5. **Ronda avanza** automáticamente cuando los 4 envían → pipeline se actualiza
6. **Fin del juego** → gráficos de análisis (Bullwhip, inventario, costos)

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
│   │   ├── juego/[code]/
│   │   │   ├── lobby/          # Sala de espera + selección de rol
│   │   │   ├── jugar/          # Tablero del jugador
│   │   │   ├── host/           # Vista del anfitrión
│   │   │   └── resultados/     # Gráficos post-juego
│   │   └── api/
│   │       ├── games/          # CRUD de partidas
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
