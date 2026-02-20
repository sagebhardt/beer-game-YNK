# Beer Game YNK — Multi-stage Docker build
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

# Copy all node_modules (Prisma, socket.io, and all transitive deps)
# Using full copy instead of cherry-picking to avoid missing transitive dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

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
