# Use a patched Node image (Debian-based for Temporal core bridge compatibility)
ARG NODE_IMAGE=public.ecr.aws/docker/library/node:24.15.0-trixie-slim

########## Builder stage ##########
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

# Reduce noisy npm warnings in logs
ENV NPM_CONFIG_LOGLEVEL=error \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

# Update OS packages to pull the latest distro point fixes available at build time
RUN apt-get update && apt-get dist-upgrade -y && \
    apt-get install -y --no-install-recommends procps && \
    rm -rf /var/lib/apt/lists/*

# Copy package files first for better layer caching
COPY package*.json .npmrc ./

# Install dependencies
RUN npm ci --workspaces=false && \
    npm cache clean --force

# Copy source and build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

########## Runtime stage ##########
FROM ${NODE_IMAGE} AS runtime

# Reduce noisy npm warnings in logs
ENV NODE_ENV=production \
    NPM_CONFIG_LOGLEVEL=error \
    HEALTHCHECK_PORT=3000

WORKDIR /app

# Update OS packages to pull the latest distro point fixes available at build time.
# Remove rarely used IBM1390/IBM1399 gconv modules as a mitigation for CVE-2026-4046.
RUN apt-get update && apt-get dist-upgrade -y && \
    apt-get install -y --no-install-recommends procps && \
    find /usr/lib -type f \( -name 'IBM1390.so' -o -name 'IBM1399.so' \) -delete && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -g 1001 -r nodejs && \
    useradd -r -u 1001 -g nodejs -m -s /usr/sbin/nologin sqsworker

# Copy package files and install production deps
COPY package*.json .npmrc ./
RUN npm ci --workspaces=false --omit=dev --ignore-scripts && \
    npm cache clean --force && \
    rm -rf ~/.npm

# Copy built application
COPY --from=builder /app/dist ./dist

# Create logs directory
RUN mkdir -p /app/logs && \
    chown -R sqsworker:nodejs /app && \
    chmod 755 /app/logs

USER sqsworker

# Simple health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "process.exit(0)" || exit 1

EXPOSE 3000

# Run event consumer (spawns worker when enabled)
CMD ["node", "dist/main.js"]
