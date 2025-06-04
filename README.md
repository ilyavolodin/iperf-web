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

## Quick Start

### Using Docker Compose

```bash
docker-compose up -d
```

This will start two instances for testing auto-discovery:
- Instance 1: http://localhost:8080 (iPerf3 port 5201)
- Instance 2: http://localhost:8081 (iPerf3 port 5202)

### Using Docker

```bash
# Build the image
docker build -t iperf3-web .

# Run a single instance
docker run -d \
  -p 8080:8080 \
  -p 5201:5201 \
  -e HOSTNAME=my-iperf-node \
  -v ./data:/app/data \
  iperf3-web
```

### Development

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