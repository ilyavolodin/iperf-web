# iPerf3 Containerized Network Testing Application

## Project Overview
A lightweight Docker container that provides iPerf3 network testing capabilities with auto-discovery and a modern web interface. The application runs iPerf3 in server mode as a background service while providing a single-page application for discovering other instances, managing hosts, and running network tests.

## Key Requirements
- **Auto-discovery**: Automatic discovery of other instances using mDNS/Bonjour
- **Web Interface**: Single-page application with slick, modern UI
- **Network Testing**: Upload/download speed testing, ping, and traceroute
- **History**: Test result history against different hosts
- **Compatibility**: Backwards compatible with standard iPerf3 hardware installations
- **Lightweight**: Minimal container footprint
- **Testing**: Playwright automated verification

## Architecture

### Core Components
1. **iPerf3 Service**: Background daemon running in server mode (port 5201)
2. **Web Server**: HTTP server serving the SPA and API endpoints (port 8080)
3. **Auto-discovery Service**: mDNS advertisement and discovery
4. **Test History Database**: JSON file storage for storing test results
5. **Network Tools**: Ping and traceroute utilities

### Technology Stack
- **Backend**: Node.js with Express
- **Frontend**: Vanilla JavaScript with modern CSS (no heavy frameworks for lightness)
- **Auto-discovery**: Bonjour/mDNS using `bonjour-service` npm package
- **Database**: JSON file storage for test history
- **Container**: Alpine Linux base for minimal size
- **Testing**: Playwright for automated verification

### Directory Structure
```
/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── src/
│   ├── server/
│   │   ├── index.js              # Main server application
│   │   ├── routes/
│   │   │   ├── api.js            # API endpoints
│   │   │   └── discovery.js      # Auto-discovery endpoints
│   │   ├── services/
│   │   │   ├── iperf.js          # iPerf3 service management
│   │   │   ├── discovery.js      # mDNS service
│   │   │   ├── network.js        # Ping/traceroute utilities
│   │   │   └── jsonDatabase.js    # JSON file database operations
│   │   └── models/
│   │       └── testResult.js     # Test result data model
│   ├── public/
│   │   ├── index.html            # Single page application
│   │   ├── css/
│   │   │   └── styles.css        # Modern, responsive CSS
│   │   ├── js/
│   │   │   ├── app.js            # Main application logic
│   │   │   ├── api.js            # API client
│   │   │   ├── ui.js             # UI components and interactions
│   │   │   └── charts.js         # Chart visualization
│   │   └── assets/
│   └── scripts/
│       ├── start.sh              # Container startup script
│       └── healthcheck.sh        # Container health check
├── tests/
│   ├── playwright/
│   │   ├── discovery.spec.js     # Auto-discovery tests
│   │   ├── iperf.spec.js         # iPerf testing functionality
│   │   ├── ui.spec.js            # UI interaction tests
│   │   └── compatibility.spec.js # Backwards compatibility tests
│   └── unit/
└── docs/
    └── API.md                    # API documentation
```

## Implementation Plan

### Phase 1: Project Setup and Core Infrastructure
1. **Project Structure**: Create directory structure and core files
2. **Package Configuration**: Set up package.json with dependencies
3. **Docker Setup**: Create Dockerfile and docker-compose.yml
4. **Basic Server**: Implement Express server with static file serving

### Phase 2: iPerf3 Service Integration
1. **iPerf3 Installation**: Add iPerf3 to container and configure as service
2. **Service Management**: Create service wrapper for starting/stopping iPerf3
3. **API Endpoints**: Create REST endpoints for running tests
4. **Error Handling**: Implement robust error handling for iPerf3 operations

### Phase 3: Auto-discovery Implementation
1. **mDNS Service**: Implement Bonjour/mDNS advertisement
2. **Discovery API**: Create endpoints for discovering other instances
3. **Host Management**: API for adding/removing manual hosts
4. **Service Registration**: Auto-register on container startup

### Phase 4: Web Interface Development
1. **HTML Structure**: Create responsive single-page application
2. **CSS Styling**: Implement modern, slick UI with animations
3. **JavaScript Logic**: Core application functionality
4. **Real-time Updates**: WebSocket or SSE for live test results
5. **Charts/Visualization**: Display speed test results graphically

### Phase 5: Enhanced Network Testing
1. **Ping Integration**: Add ping functionality with API endpoints
2. **Traceroute Integration**: Implement traceroute capabilities
3. **Combined Testing**: Orchestrate ping + iPerf3 + traceroute tests
4. **Result Processing**: Parse and format all test results

### Phase 6: History and Data Management
1. **Database Setup**: JSON file storage for test history
2. **Data Models**: Define schemas for test results
3. **History API**: Endpoints for retrieving historical data
4. **Data Visualization**: Charts showing performance trends

### Phase 7: Testing and Validation
1. **Playwright Setup**: Configure Playwright testing environment
2. **UI Tests**: Automated tests for web interface
3. **Discovery Tests**: Verify auto-discovery functionality
4. **Compatibility Tests**: Test with standard iPerf3 installations
5. **Integration Tests**: End-to-end workflow testing

### Phase 8: Optimization and Documentation
1. **Container Optimization**: Minimize image size and resource usage
2. **Performance Tuning**: Optimize application performance
3. **Documentation**: Complete API documentation and usage guides
4. **Health Checks**: Implement container health monitoring

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
- `DELETE /api/history/:id` - Delete specific test result

### Status
- `GET /api/status` - Application status and health
- `GET /api/iperf/status` - iPerf3 service status

## Configuration

### Environment Variables
- `IPERF_PORT`: iPerf3 server port (default: 5201)
- `WEB_PORT`: Web server port (default: 8080)
- `HOSTNAME`: Custom hostname for auto-discovery
- `DISCOVERY_INTERVAL`: Auto-discovery refresh interval (default: 30s)
- `HISTORY_RETENTION`: Days to retain test history (default: 30)

### Docker Compose Example
```yaml
version: '3.8'
services:
  iperf-web:
    build: .
    ports:
      - "8080:8080"
      - "5201:5201"
    environment:
      - HOSTNAME=iperf-node-1
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

## Testing Strategy

### Automated Tests
1. **Unit Tests**: Core functionality testing
2. **Integration Tests**: API endpoint testing
3. **UI Tests**: Playwright browser automation
4. **Compatibility Tests**: Standard iPerf3 interoperability
5. **Performance Tests**: Load and stress testing

### Manual Testing Scenarios
1. **Multi-node Discovery**: Deploy multiple containers and verify discovery
2. **Cross-platform Testing**: Test with various iPerf3 implementations
3. **Network Conditions**: Test under different network scenarios
4. **Container Lifecycle**: Verify startup, shutdown, and restart behavior

## Security Considerations
- No authentication required (assumes trusted network)
- Rate limiting on API endpoints
- Input validation for all user inputs
- Secure defaults for network configurations
- Container runs as non-root user

## Performance Targets
- Container startup time: < 10 seconds
- Web interface load time: < 2 seconds
- Auto-discovery refresh: < 5 seconds
- Memory usage: < 100MB
- CPU usage: < 5% idle, < 50% during tests

This plan provides a comprehensive roadmap for implementing a lightweight, feature-rich iPerf3 container with modern web interface and auto-discovery capabilities.