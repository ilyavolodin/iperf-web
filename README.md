# iPerf3 Web

Containerized iPerf3 with automatic host discovery and a small web interface.

## Quick start

Pull the image and run a single instance:

```bash
docker pull ivolodin/iperf-web:latest
docker run -d --name iperf-web \
  --restart unless-stopped \
  -p 8080:8080 \
  -p 5201:5201 \
  -p 5353:5353/udp \
  -v $(pwd)/data:/app/data \
  ivolodin/iperf-web:latest
```

Open `http://localhost:8080` in your browser. Mapping `5353/udp` is required for
mDNS discovery when not using host networking.

Set environment variables to customise ports or the advertised hostname:

- `WEB_PORT` (default `8080`)
- `IPERF_PORT` (default `5201`)
- `HOSTNAME` (used for discovery)

## Docker Compose

Sample compose files are provided:

- `docker-compose.yml` – two instances on the same host for testing
- `docker-compose.host-network.yml` – production deployment using host networking

Launch with:

```bash
docker-compose -f docker-compose.host-network.yml up -d
```

## Building from source

```bash
git clone https://github.com/ilyavolodin/iperf-web.git
cd iperf-web
docker build -t iperf-web .
```

## Development

Node.js 22 is required.

```bash
npm install
npm run dev
```

Run tests with:

```bash
npm test
```

## Architecture support

Images are published for `linux/amd64` and `linux/arm64`.

## License

MIT License. See `LICENSE` for details.
