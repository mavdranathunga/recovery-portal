# Dependencies stage
FROM node:20-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Builder stage
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Runner stage (100% offline-ready: NO apt-get, NO downloads)
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Copy libaio directly from the host into the container's library path
COPY libaio.so.1* /usr/lib/x86_64-linux-gnu/

# Copy the extracted Oracle Instant Client from project root
COPY instantclient_21_14 /opt/oracle/instantclient_21_14

# Register libraries with ldconfig
RUN echo "/opt/oracle/instantclient_21_14" > /etc/ld.so.conf.d/oracle-instantclient.conf && ldconfig

ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_21_14:$LD_LIBRARY_PATH
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 -g nodejs nextjs

# Copy standalone build and static files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy runtime node_modules
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy SSH directory with restricted permissions
COPY --from=builder --chown=nextjs:nodejs /app/ssh ./ssh
RUN chmod 700 ./ssh && chmod 600 ./ssh/* || true

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
