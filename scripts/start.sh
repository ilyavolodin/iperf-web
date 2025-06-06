#!/bin/sh

echo "Starting iPerf3 Web Container..."

# Set defaults
export IPERF_PORT=${IPERF_PORT:-5201}
export WEB_PORT=${WEB_PORT:-8080}
export HOSTNAME=${HOSTNAME:-$(hostname)}
export DISCOVERY_INTERVAL=${DISCOVERY_INTERVAL:-30}
export HISTORY_RETENTION=${HISTORY_RETENTION:-30}

echo "Configuration:"
echo "  Hostname: $HOSTNAME"
echo "  iPerf3 Port: $IPERF_PORT"
echo "  Web Port: $WEB_PORT"
echo "  Discovery Interval: ${DISCOVERY_INTERVAL}s"
echo "  History Retention: ${HISTORY_RETENTION} days"

# Ensure data directory exists and has correct permissions
echo "Initializing data directory..."
mkdir -p /app/data
if [ "$(id -u)" -eq 0 ]; then
    # Running as root, fix ownership
    chown -R iperf:iperf /app/data
    chmod 755 /app/data
else
    # Running as non-root, just ensure it's writable
    chmod 755 /app/data 2>/dev/null || true
fi

# Test if we can write to the data directory
if ! touch /app/data/.write_test 2>/dev/null; then
    echo "ERROR: Cannot write to /app/data directory"
    echo "Please ensure the volume is mounted with correct permissions:"
    echo "  docker run -v /host/path:/app/data ..."
    echo "Or create the directory on the host first:"
    echo "  mkdir -p /host/path && chown 1001:1001 /host/path"
    exit 1
fi
rm -f /app/data/.write_test

echo "Data directory initialized successfully"

# Start iPerf3 server in background
echo "Starting iPerf3 server on port $IPERF_PORT..."
iperf3 -s -p $IPERF_PORT -D

# Wait a moment for iPerf3 to start
sleep 2

# Verify iPerf3 is running
if ! pgrep -f "iperf3 -s" > /dev/null; then
    echo "ERROR: Failed to start iPerf3 server"
    exit 1
fi

echo "iPerf3 server started successfully"

# Start the Node.js web application
echo "Starting web application on port $WEB_PORT..."
exec node --experimental-strip-types src/server/index.ts
