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
exec npx tsx src/server/index.ts