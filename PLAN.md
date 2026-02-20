# Architecture — Beer Game YNK

## Overview

Turn-based supply chain simulation with two modes:
- **MULTI**: 4 players
- **TEST**: 1 controller who plays all roles

Includes admin panel with real-time monitoring, analytics and exports.

## Supply Chain

```
Consumer → Retailer → Wholesaler → Distributor → Factory → [Production]
         ←(demand)  ←(orders)    ←(orders)     ←(orders)
         →(beer)    →(shipments) →(shipments)   →(shipments)
```

- Orders flow upstream (right to left)
- Shipments flow downstream (left to right)
- Each link has 2-week order delay + 2-week shipping delay = 4 weeks total

## Database Schema

### Game
Main game record. `accessCode` for joining, `demandPattern` as JSON array, `hostSessionId` identifies the creator.

Extended fields:
- `mode` (`MULTI` | `TEST`)
- `controllerSessionId` (only for test mode)
- `demandPresetKey`
- `endedAt`
- `endedReason` (`NATURAL` | `ADMIN_TERMINATED` | `ADMIN_CLOSED`)

### Player
One per participant per game. Identified by `sessionId` (browser cookie). `role` starts empty and is selected in lobby.

### PlayerRound
Immutable snapshot per player per round. Records: inventoryBefore/After, backlogBefore/After, incomingOrder, incomingShipment, orderPlaced, shipmentSent, costs. Used for round history and post-game analytics.

### PipelineItem
The delay buffer. Each item has `type` (ORDER/SHIPMENT/PRODUCTION), `fromRole`, `toRole`, `roundPlaced`, `roundDue`. Items "arrive" when `roundDue == currentRound`.

### Round
Tracks submission status per role for the current round. `processedAt` is null until all 4 submit.

## Game Engine Flow

### Initialization (`initializeGame`)
1. Create round-0 PlayerRound for each player (startInventory, 0 cost)
2. Pre-fill pipeline with steady-state 4-unit flow (2 items per link, arriving rounds 1 & 2)
3. Set currentRound = 1, status = ACTIVE

In `TEST` mode, the game is initialized automatically right after creation.

### Round Processing (`processRound`)
Triggered when all 4 roles submit orders for round N:

1. **Receive shipments**: PipelineItems where `roundDue = N`, `type = SHIPMENT/PRODUCTION`
2. **Receive orders**: For Retailer = `demandPattern[N-1]`; others = PipelineItems `type = ORDER`
3. **Ship**: `shipped = min(inventory, demand + backlog)`, create SHIPMENT pipeline items
4. **Place orders**: Create ORDER pipeline items (or PRODUCTION for Factory)
5. **Costs**: `holding = inventoryAfter × $0.50`, `backlog = backlogAfter × $1.00`
6. **Save** PlayerRound, advance to N+1 or mark COMPLETED (`endedReason = NATURAL`)

### Factory Production
Factory has no upstream supplier. Its "order" creates a PRODUCTION PipelineItem with `roundDue = N + orderDelay + shippingDelay` (full 4-week lead time). Arrives back to Factory as incomingShipment.

## Real-Time Architecture

```
Browser ←→ Socket.io ←→ server.ts ←→ Next.js API routes ←→ Prisma/SQLite
```

- `server.ts`: HTTP server wrapping Next.js + Socket.io
- Socket rooms: one per game (keyed by access code)
- Order submission: REST API (`POST /api/games/[code]/order`) → processes DB → emits socket events
- Socket events: lobby sync, role selection, order submitted (role only), round advanced, game ended
- Admin socket rooms:
  - `admin:dashboard` (summary updates)
  - `admin:game:{code}` (detail updates)

## Session Management

No player auth. UUID cookie (`beer-session`, httpOnly, 30 days). Each browser gets a unique session. Client retrieves session ID via `GET /api/session`.

Admin access uses `ADMIN_PANEL_KEY` and a signed cookie session (`beer-admin`).

## Information Silos

Players see only:
- Their own inventory, backlog, costs
- Incoming order quantity (not who placed it)
- Their pipeline (shipments arriving to them)
- Round submission status (which roles submitted, not what they ordered)

Host sees full operational state, but demand pattern is hidden outside admin/results.

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/games` | POST | Create game |
| `/api/games/[code]` | GET | Get game state (player or host view) |
| `/api/games/[code]/join` | POST | Join game |
| `/api/games/[code]/start` | POST | Start game (host only) |
| `/api/games/[code]/order` | POST | Submit order |
| `/api/games/[code]/test-state` | GET | Get mode test state |
| `/api/games/[code]/test-round` | POST | Submit 4 role orders in mode test |
| `/api/games/[code]/results` | GET | Final results with demand pattern |
| `/api/admin/session` | GET/POST/DELETE | Admin login/session |
| `/api/admin/games` | GET | Admin game list |
| `/api/admin/games/[code]` | GET/DELETE | Admin detail/delete |
| `/api/admin/games/[code]/demand` | PATCH | Update demand preset in lobby |
| `/api/admin/games/[code]/close` | POST | Close game |
| `/api/admin/games/[code]/terminate` | POST | Force terminate game |
| `/api/admin/analytics/overview` | GET | Historical analytics |
| `/api/admin/analytics/games/[code]` | GET | Per-game analytics |
| `/api/admin/exports/overview` | GET | Export overview CSV/XLSX |
| `/api/admin/exports/games/[code]` | GET | Export game CSV/XLSX |
| `/api/session` | GET | Get current session ID |

## Post-Game Analytics

Results page keeps three Chart.js line charts:
1. **Bullwhip Effect**: Orders placed by each role vs consumer demand — shows signal amplification
2. **Inventory/Backlog**: Positive = inventory, negative = backlog per role
3. **Cumulative Cost**: Running total cost per role

## Deployment

Railway with Docker. SQLite stored on persistent volume at `/data`. Template DB created during build, copied to volume on first start. `SCHEMA_V` bump forces DB recreation for schema changes.

Admin analytics now available through APIs and export endpoints (CSV/XLSX).
