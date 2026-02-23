# Beer Game YNK - Multi-stage Docker build
FROM node:22-alpine AS base

# --- deps ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit

# --- builder ---
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create template database with schema
RUN DATABASE_URL="file:/app/temp.db" npx prisma db push --skip-generate && \
    ls -la /app/temp.db

# Ensure public dir exists (Next.js standalone expects it)
RUN mkdir -p public

# Build Next.js standalone and custom server bundle
RUN npm run build

# Remove baked .env from standalone (DATABASE_URL is set at runtime via CMD)
RUN rm -f /app/.next/standalone/.env

# --- prod-deps ---
FROM deps AS prod-deps
RUN npm prune --omit=dev

# --- runner ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy prod deps FIRST (socket.io, chart.js, etc.)
COPY --from=prod-deps /app/node_modules ./node_modules

# Copy standalone build ON TOP — its traced node_modules take priority over prod-deps
# (Next.js traces exact files needed for next, react, @swc, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Overlay Prisma generated client (generated in builder, not in prod-deps)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy bundled custom server
COPY --from=builder --chown=nextjs:nodejs /app/custom-server.js ./custom-server.js

# Copy template database
COPY --from=builder --chown=nextjs:nodejs /app/temp.db /app/template.db

# Create data directory for persistent volume
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

EXPOSE 3000
ENV DATA_DIR="/app/data"

# Database initialization + start
CMD ["sh", "-c", "SCHEMA_V=5; DATA_DIR=${DATA_DIR:-/app/data}; PORT=${PORT:-3000}; mkdir -p \"$DATA_DIR\"; if [ ! -f \"$DATA_DIR/prod.db\" ] || [ ! -f \"$DATA_DIR/.schema-v$SCHEMA_V\" ]; then cp /app/template.db \"$DATA_DIR/prod.db\"; touch \"$DATA_DIR/.schema-v$SCHEMA_V\"; echo 'DB initialized (schema v'$SCHEMA_V')'; fi; echo \"[boot] Effective PORT=$PORT DATA_DIR=$DATA_DIR\"; DATABASE_URL=\"file:$DATA_DIR/prod.db\" PORT=\"$PORT\" node custom-server.js"]
