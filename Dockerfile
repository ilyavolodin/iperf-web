FROM node:22-alpine

# Install iPerf3, ping, and traceroute utilities
RUN apk add --no-cache \
    iperf3 \
    iputils \
    traceroute \
    dumb-init \
    && addgroup -g 1001 -S iperf \
    && adduser -S -D -H -u 1001 -s /sbin/nologin -G iperf iperf

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --omit=dev && npm cache clean --force

# Copy application source
COPY src/ ./src/
COPY scripts/ ./scripts/

# No need for symlinks with tsx

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown -R iperf:iperf /app

# Make scripts executable
RUN chmod +x ./scripts/*.sh

# Expose ports
EXPOSE 8080 5201

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD /app/scripts/healthcheck.sh

# Switch to non-root user
USER iperf

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["./scripts/start.sh"]