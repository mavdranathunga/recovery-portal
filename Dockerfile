# Dependencies stage
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build and static files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy external packages required at runtime (oracledb, ssh2 + dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/oracledb ./node_modules/oracledb
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ssh2 ./node_modules/ssh2
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/cpu-features ./node_modules/cpu-features

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
