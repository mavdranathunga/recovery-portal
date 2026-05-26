FROM node:20-bookworm-slim AS base

# Install necessary libraries for Oracle Instant Client on Debian/Rocky
RUN apt-get update && apt-get install -y \
    libaio1 \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Download and extract Oracle Instant Client 19.21 (Linux x64)
WORKDIR /opt/oracle
RUN wget https://download.oracle.com/otn_software/linux/instantclient/1921000/instantclient-basiclite-linux.x64-19.21.0.0.0dbru.zip \
    && unzip instantclient-basiclite-linux.x64-19.21.0.0.0dbru.zip \
    && rm -f instantclient-basiclite-linux.x64-19.21.0.0.0dbru.zip \
    && sh -c "echo /opt/oracle/instantclient_19_21 > /etc/ld.so.conf.d/oracle-instantclient.conf" \
    && ldconfig

# Set Oracle environment variable
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_19_21

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy built Next.js artifacts
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Expose the standard Next.js port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
