# Stage 1: Build dependencies
FROM --platform=$BUILDPLATFORM node:23-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Runtime
FROM node:23-alpine
RUN apk add --no-cache iperf3 iputils traceroute dumb-init

WORKDIR /app

# Copy dependencies from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy app source and scripts
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY package*.json ./

# Permissions
RUN mkdir -p /app/data && \
    chown -R node:node /app && \
    chmod 755 /app/data && \
    chmod +x ./scripts/*.sh

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["./scripts/start.sh"]
