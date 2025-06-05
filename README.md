# iPerf3 Web - Containerized Network Testing

A lightweight Docker container that provides iPerf3 network testing capabilities with auto-discovery and a modern web interface.

## Features

- **Auto-discovery**: Automatic discovery of other instances using mDNS/Bonjour
- **Modern Web Interface**: Single-page application with responsive, slick UI
- **Comprehensive Testing**: Upload/download speed testing, ping, and traceroute
- **Test History**: Persistent storage and visualization of test results
- **Backwards Compatible**: Works with standard iPerf3 hardware installations
- **Lightweight**: Minimal container footprint using Alpine Linux
- **TypeScript**: Built with TypeScript and Node.js 22 native type stripping

## Installation

### Pre-built Docker Images

#### Option 1: Docker Hub
```bash
# Pull the latest image
docker pull ivolodin/iperf-web:latest

# Run a single instance with auto-restart
docker run -d \
  --name iperf-web \
  --restart unless-stopped \
  -p 8080:8080 \
  -p 5201:5201 \
  -e HOSTNAME=my-iperf-node \
  -v ./data:/app/data \
  ivolodin/iperf-web:latest
```

#### Option 2: GitHub Container Registry
```bash
# Pull the latest image
docker pull ghcr.io/ilyavolodin/iperf-web:latest

# Run a single instance with auto-restart
docker run -d \
  --name iperf-web \
  --restart unless-stopped \
  -p 8080:8080 \
  -p 5201:5201 \
  -e HOSTNAME=my-iperf-node \
  -v ./data:/app/data \
  ghcr.io/ilyavolodin/iperf-web:latest
```

#### Docker Restart Policies

The `--restart unless-stopped` flag ensures the container:
- **Automatically starts** when the Docker daemon starts (system boot)
- **Restarts** if the container crashes or exits unexpectedly
- **Stays stopped** if you manually stop it with `docker stop`

Other restart policy options:
- `--restart no` - Never restart (default)
- `--restart always` - Always restart, even if manually stopped
- `--restart on-failure` - Restart only on failure (non-zero exit code)
- `--restart on-failure:3` - Restart up to 3 times on failure

#### Ensuring Docker Starts on Boot

To guarantee the container starts on system boot, ensure Docker daemon is enabled:

**Linux (systemd):**
```bash
sudo systemctl enable docker
sudo systemctl start docker
```

**Linux (other init systems):**
```bash
sudo service docker enable
sudo service docker start
```

**Windows/macOS:**
- Docker Desktop automatically starts on boot by default
- Check "Start Docker Desktop when you log in" in Docker Desktop settings

**Verify auto-start:**
```bash
# Check if container will restart
docker inspect iperf-web | grep RestartPolicy -A 3

# Test restart behavior
docker restart iperf-web
docker ps  # Should show the container running
```

### Available Tags

Both registries provide the following tags:
- `latest` - Latest stable release
- `main` - Latest from main branch
- `<version>` - Specific version tags (e.g., `v1.0.0`)
- `main-<sha>` - Specific commit builds

## Quick Start

### Building from Source

```bash
# Clone the repository
git clone https://github.com/ilyavolodin/iperf.git
cd iperf

# Build the image
docker build -t iperf-web .

# Run a single instance with auto-restart
docker run -d \
  --name iperf-web \
  --restart unless-stopped \
  -p 8080:8080 \
  -p 5201:5201 \
  -e HOSTNAME=my-iperf-node \
  -v ./data:/app/data \
  iperf-web
```

## Production Deployment

**⚠️ Important: For production deployments, use the pre-built images from Docker Hub or GitHub Container Registry. Docker Compose is only recommended for development and testing.**

### Single Node Setup
```bash
# Using Docker Hub image
docker run -d \
  --name iperf-web \
  --restart unless-stopped \
  -p 8080:8080 \
  -p 5201:5201 \
  -v /opt/iperf-data:/app/data \
  -e HOSTNAME=$(hostname) \
  ivolodin/iperf-web:latest

# Access the web interface at http://your-server:8080
```

### Multi-Node Production Setup
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  iperf-web:
    image: ivolodin/iperf-web:latest
    hostname: ${HOSTNAME:-iperf-node}
    restart: unless-stopped
    ports:
      - "${WEB_PORT:-8080}:8080"
      - "${IPERF_PORT:-5201}:5201"
    volumes:
      - /opt/iperf-data:/app/data
    environment:
      - HOSTNAME=${HOSTNAME:-iperf-node}
      - IPERF_PORT=5201
      - WEB_PORT=8080
      - DISCOVERY_INTERVAL=${DISCOVERY_INTERVAL:-30}
      - HISTORY_RETENTION=${HISTORY_RETENTION:-30}
```

Deploy with:
```bash
HOSTNAME=node-1 WEB_PORT=8080 IPERF_PORT=5201 docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: iperf-web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: iperf-web
  template:
    metadata:
      labels:
        app: iperf-web
    spec:
      containers:
      - name: iperf-web
        image: ivolodin/iperf-web:latest
        ports:
        - containerPort: 8080
        - containerPort: 5201
        env:
        - name: HOSTNAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        volumeMounts:
        - name: data
          mountPath: /app/data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: iperf-data
---
apiVersion: v1
kind: Service
metadata:
  name: iperf-web-service
spec:
  selector:
    app: iperf-web
  ports:
  - name: web
    port: 8080
    targetPort: 8080
  - name: iperf
    port: 5201
    targetPort: 5201
  type: LoadBalancer
```

### Development

**⚠️ Note: The following Docker Compose examples are for development and testing only. Do not use in production.**

#### Local Development Environment

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Type checking
npm run typecheck
```

#### Docker Compose for Testing Auto-Discovery

Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  iperf-web-1:
    image: ivolodin/iperf-web:latest
    # Alternative: image: ghcr.io/ilyavolodin/iperf-web:latest
    hostname: iperf-node-1
    ports:
      - "8080:8080"
      - "5201:5201"
    volumes:
      - ./data1:/app/data
    environment:
      - HOSTNAME=iperf-node-1
      - IPERF_PORT=5201
      - WEB_PORT=8080

  iperf-web-2:
    image: ivolodin/iperf-web:latest
    # Alternative: image: ghcr.io/ilyavolodin/iperf-web:latest
    hostname: iperf-node-2
    ports:
      - "8081:8080"
      - "5202:5201"
    volumes:
      - ./data2:/app/data
    environment:
      - HOSTNAME=iperf-node-2
      - IPERF_PORT=5201
      - WEB_PORT=8080
```

Then run:
```bash
docker-compose up -d
```

This will start two instances for testing auto-discovery:
- Instance 1: http://localhost:8080 (iPerf3 port 5201)
- Instance 2: http://localhost:8081 (iPerf3 port 5202)

#### Building from Source for Development

If you want to build from source:

```bash
docker-compose up -d
```

This will build and start two instances for testing auto-discovery.

## Configuration

### Environment Variables

- `HOSTNAME`: Custom hostname for auto-discovery (default: container hostname)
- `IPERF_PORT`: iPerf3 server port (default: 5201)
- `WEB_PORT`: Web server port (default: 8080)
- `DISCOVERY_INTERVAL`: Auto-discovery refresh interval in seconds (default: 30)
- `HISTORY_RETENTION`: Days to retain test history (default: 30)

### Ports

- `8080`: Web interface (configurable via WEB_PORT)
- `5201`: iPerf3 server (configurable via IPERF_PORT)

## API Endpoints

### Discovery
- `GET /api/discovery/hosts` - Get discovered hosts
- `POST /api/discovery/hosts` - Add manual host
- `DELETE /api/discovery/hosts/:id` - Remove host

### Testing
- `POST /api/test/speed` - Run iPerf3 speed test
- `POST /api/test/ping` - Run ping test  
- `POST /api/test/traceroute` - Run traceroute
- `POST /api/test/full` - Run combined test suite

### History
- `GET /api/history` - Get test history
- `GET /api/history/:hostId` - Get history for specific host
- `DELETE /api/history/:id` - Delete test result

### Status
- `GET /api/status` - Application health status
- `GET /api/iperf/status` - iPerf3 service status

## Architecture

- **Backend**: Node.js 22 with TypeScript (native type stripping)
- **Frontend**: Vanilla JavaScript with modern CSS (no heavy frameworks)
- **Auto-discovery**: mDNS/Bonjour using `bonjour-service`
- **Database**: SQLite3 for test history
- **Container**: Alpine Linux for minimal size
- **Testing**: Playwright for automated verification

## Testing

### Automated Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only Playwright tests
npm run test:playwright
```

### Manual Testing

1. **Multi-node Discovery**: Deploy multiple containers and verify auto-discovery
2. **Standard iPerf3 Compatibility**: Test with existing iPerf3 installations
3. **Network Scenarios**: Test under different network conditions

## Compatibility

This application is designed to be backwards compatible with standard iPerf3 installations:

- Connects to any standard iPerf3 server running on hardware
- Supports standard iPerf3 ports and protocols
- Handles standard iPerf3 JSON output formats
- Compatible with IPv4 and IPv6 addresses
- Supports hostname resolution

## Development

### Project Structure

```
/
├── src/
│   ├── server/          # TypeScript backend
│   ├── public/          # Frontend assets
│   └── types/           # TypeScript type definitions
├── tests/
│   ├── playwright/      # E2E tests
│   └── unit/            # Unit tests
├── scripts/             # Container scripts
└── docs/                # Documentation
```

### Code Style

- ESLint with TypeScript rules
- Strict TypeScript configuration
- Modern ES2022+ features
- Functional programming patterns where appropriate

### Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Security

- Container runs as non-root user
- Input validation on all endpoints  
- Rate limiting on API endpoints
- No authentication (assumes trusted network environment)

## Performance

- Container startup: < 10 seconds
- Web interface load: < 2 seconds
- Auto-discovery refresh: < 5 seconds
- Memory usage: < 100MB
- CPU usage: < 5% idle, < 50% during tests

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please use the GitHub issue tracker.