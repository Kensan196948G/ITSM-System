# ITSM-Sec Nexus Dockerfile
# Multi-stage build for optimal security and image size

# ============================================================
# Stage 1: Builder
# ============================================================
FROM node:20-alpine AS builder

LABEL maintainer="ITSM-Sec Nexus Team"
LABEL description="ISO 20000 (ITSM) と NIST CSF 2.0 (Security) 統合管理システム"

WORKDIR /build

# Copy package files for dependency installation
COPY package*.json ./

# Install production dependencies only
# --ignore-scripts: Skip potential malicious scripts
# --omit=dev: Exclude devDependencies
RUN npm ci --production --ignore-scripts --omit=dev && \
    npm cache clean --force

# ============================================================
# Stage 2: Runtime
# ============================================================
FROM node:20-alpine

# Install runtime dependencies for SQLite3 native module
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Create non-root user and group
RUN addgroup -g 1001 -S itsm && \
    adduser -S -u 1001 -G itsm itsm

WORKDIR /app

# Copy node_modules from builder stage
COPY --from=builder --chown=itsm:itsm /build/node_modules ./node_modules

# Copy application source code
COPY --chown=itsm:itsm backend ./backend
COPY --chown=itsm:itsm WebUI-Sample ./WebUI-Sample
COPY --chown=itsm:itsm package*.json ./

# Rebuild sqlite3 for the runtime architecture
RUN npm rebuild sqlite3 && \
    apk del python3 make g++ && \
    rm -rf /var/cache/apk/*

# Create necessary directories with proper permissions
RUN mkdir -p /app/backend/backups /app/logs && \
    chown -R itsm:itsm /app/backend /app/logs

# Environment variables (can be overridden by docker-compose or runtime)
ENV NODE_ENV=production \
    PORT=5000 \
    HOST=0.0.0.0

# Expose application port
EXPOSE 5000

# Health check endpoint
# Checks every 30 seconds, timeout 10 seconds, start after 10 seconds, max 3 retries
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/api/v1/health',(r)=>{process.exit(r.statusCode===200?0:1)})"

# Switch to non-root user
USER itsm

# Start the application
CMD ["node", "backend/server.js"]
