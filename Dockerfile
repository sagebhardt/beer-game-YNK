FROM node:22-alpine AS base

# --- deps ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

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

# Build Next.js (standalone output)
RUN npm run build

# Bundle custom server (Socket.io + Next.js wrapper) from TypeScript
RUN npx esbuild server.ts --bundle --platform=node --target=node22 --outfile=custom-server.js \
    --external:next --external:socket.io --external:@prisma/client

# --- runner ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma runtime
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy socket.io and all transitive dependencies for custom server
COPY --from=builder /app/node_modules/socket.io ./node_modules/socket.io
COPY --from=builder /app/node_modules/socket.io-adapter ./node_modules/socket.io-adapter
COPY --from=builder /app/node_modules/socket.io-parser ./node_modules/socket.io-parser
COPY --from=builder /app/node_modules/engine.io ./node_modules/engine.io
COPY --from=builder /app/node_modules/engine.io-parser ./node_modules/engine.io-parser
COPY --from=builder /app/node_modules/ws ./node_modules/ws
COPY --from=builder /app/node_modules/cors ./node_modules/cors
COPY --from=builder /app/node_modules/vary ./node_modules/vary
COPY --from=builder /app/node_modules/debug ./node_modules/debug
COPY --from=builder /app/node_modules/ms ./node_modules/ms
COPY --from=builder /app/node_modules/accepts ./node_modules/accepts
COPY --from=builder /app/node_modules/base64id ./node_modules/base64id
COPY --from=builder /app/node_modules/mime-types ./node_modules/mime-types
COPY --from=builder /app/node_modules/mime-db ./node_modules/mime-db
COPY --from=builder /app/node_modules/negotiator ./node_modules/negotiator

# Copy bundled custom server (Socket.io + Next.js)
COPY --from=builder --chown=nextjs:nodejs /app/custom-server.js ./custom-server.js

# Copy template database
COPY --from=builder --chown=nextjs:nodejs /app/temp.db /app/template.db

# Create data directory for persistent volume
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Database initialization + start
CMD ["sh", "-c", "SCHEMA_V=1; if [ ! -f /app/data/prod.db ] || [ ! -f /app/data/.schema-v$SCHEMA_V ]; then cp /app/template.db /app/data/prod.db; touch /app/data/.schema-v$SCHEMA_V; echo 'DB initialized (schema v'$SCHEMA_V')'; fi && DATABASE_URL='file:/app/data/prod.db' node custom-server.js"]
