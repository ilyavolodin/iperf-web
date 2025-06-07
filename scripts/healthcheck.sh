#!/bin/sh

# Check if iPerf3 server is running
if ! pgrep -f "iperf3 -s" > /dev/null; then
    echo "UNHEALTHY: iPerf3 server not running"
    exit 1
fi

# Check if web server is responding
if ! wget -q --spider http://localhost:${WEB_PORT:-8080}/api/status; then
    echo "UNHEALTHY: Web server not responding"
    exit 1
fi

echo "HEALTHY: All services running"
exit 0
