FROM node:22-alpine

RUN apk add --no-cache iperf3 iputils traceroute dumb-init

WORKDIR /app

# Install dependencies directly per architecture
COPY package*.json ./
RUN echo "📦 Starting npm ci..." && \
    npm ci --omit=dev --loglevel verbose && \
    echo "✅ npm install complete" && \
    npm cache clean --force

# Copy app source and scripts
COPY src/ ./src/
COPY scripts/ ./scripts/

# Permissions
RUN mkdir -p /app/data && \
    chown -R node:node /app && \
    chmod 755 /app/data && \
    chmod +x ./scripts/*.sh

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["./scripts/start.sh"]
