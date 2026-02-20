# Claude Code Instructions — Beer Game YNK

## Documentation

When making changes, keep these files up to date:

- **`PLAN.md`** — Architecture notes, game engine logic, DB schema, pipeline delay mechanics.
- **`README.md`** — Project overview, setup, game rules, project structure.
- **`DEPLOYMENT.md`** — Railway deployment, volume setup, schema migration process.

## Project Structure

- **Working directory**: repo root (`beer-game-YNK/`)
- **Stack**: Next.js 16 (App Router), React 19, Prisma 6, SQLite, Tailwind CSS v4, Socket.io
- **Language**: TypeScript, all UI text in Spanish
- **Deployment**: Railway via Docker (`Dockerfile` in repo root)

## Key Conventions

### Database
- SQLite via Prisma. Schema at `prisma/schema.prisma`.
- **Schema migration**: No ALTER COLUMN in SQLite. When adding/removing columns, bump `SCHEMA_V` in `Dockerfile` CMD line. This forces DB recreation on deploy (loses data).
- Current `SCHEMA_V=1`.

### No Auth
- No login/signup. Players identified by session cookie (`beer-session`, httpOnly).
- Session ID retrieved client-side via `GET /api/session` (NOT `document.cookie` — the cookie is httpOnly).
- Host = whoever creates the game (`game.hostSessionId`).

### Game Engine
- `src/lib/game-engine.ts` — Core simulation logic.
- `initializeGame()`: Creates round-0 state, pre-fills pipeline with steady-state 4-unit flow.
- `processRound()`: Runs when all 4 players submit. Handles shipments, orders, costs, pipeline items.
- `getPlayerState()`: Returns player-visible data only (information silos enforced).
- `getHostState()`: Returns full game data (no silos).

### Pipeline Delay Buffer
- `PipelineItem` model with `roundPlaced` and `roundDue`.
- Orders: `roundDue = roundPlaced + orderDelay` (2 weeks).
- Shipments: `roundDue = roundPlaced + shippingDelay` (2 weeks).
- Factory production: `roundDue = roundPlaced + orderDelay + shippingDelay` (4 weeks).
- Query `WHERE roundDue = currentRound` to find arriving items.

### Socket.io
- Custom server in `server.ts` wraps Next.js + Socket.io.
- Socket path: `/api/socketio`.
- Global `__io` instance accessed via `getIO()` from `src/lib/socket-server.ts`.
- Rooms scoped by game access code.
- Order submission goes through REST API, which then emits socket events.

### API Routes
- All at `src/app/api/`. No auth middleware — session via `getSessionId()`.
- Return Spanish error messages.
- Game isolation: all queries filter by `gameId` or `accessCode`.

### UI Components
- Custom components in `src/components/ui/` (Button, Card, Input, Select, Badge).
- CVA (class-variance-authority) for Button and Badge variants.
- Icons from `lucide-react`.
- Brand color: `#2c02c6`.

### Information Silos
- Players can only see their own data: inventory, backlog, costs, incoming orders (quantity only), their pipeline.
- Socket events for order submission broadcast role only (not quantity).
- Host view bypasses all silos.

## Commands

```bash
# Dev (Socket.io + Next.js)
npm run dev

# Build (always run before committing)
npm run build

# Prisma
npx prisma db push
npx prisma studio
```

## Git Workflow

- PRs are squash-merged to main.
- Always run `npm run build` before committing.

## Common Gotchas

- Session cookie is `httpOnly` — never read it with `document.cookie`. Use `GET /api/session` instead.
- Socket.io requires the custom server (`server.ts`). Running `next dev` alone won't have socket support.
- `PipelineItem` has no `gameId` relation (just a string field) — queries must always include `gameId` filter.
- Factory production uses `type: "PRODUCTION"` with `toRole: "FACTORY"` — it's a self-referencing pipeline item.
