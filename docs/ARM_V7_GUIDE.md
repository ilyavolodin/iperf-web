# ARM v7 Development Guide

This guide covers the special setup and considerations for ARM v7 architecture support in the iPerf3 Web project.

## Background

ARM v7 architecture (ARMv7l) presents unique challenges due to compatibility issues between modern Node.js versions and the older ARM v7 instruction set. This project addresses these challenges with a dedicated build pipeline.

## Architecture Differences

### Standard Images (AMD64, ARM64)
- **Node.js Version**: 22
- **TypeScript**: Native `--experimental-strip-types` support
- **Runtime**: Direct execution of TypeScript files
- **Dockerfile**: `Dockerfile` (standard)

### ARM v7 Images
- **Node.js Version**: 16 (latest stable version with ARM v7 support)
- **TypeScript**: Pre-compiled to JavaScript during build
- **Runtime**: Execution of compiled JavaScript files
- **Dockerfile**: `Dockerfile.armv7` (specialized)

## Build Process

### ARM v7 Build Steps

1. **Base Image**: `node:16-alpine`
2. **TypeScript Compilation**: Uses `tsconfig.armv7.json` configuration
3. **Output**: Compiled JavaScript in `dist/` directory
4. **Runtime**: Node.js executes compiled JavaScript

### TypeScript Configuration

The ARM v7 build uses a specialized TypeScript configuration (`tsconfig.armv7.json`) that:

- Targets ES2020 instead of ESNext
- Uses Node16 module resolution
- Disables experimental TypeScript features
- Removes comments for smaller output
- Excludes test files from compilation

## File Structure

```
├── Dockerfile              # Standard build (AMD64, ARM64)
├── Dockerfile.armv7        # ARM v7 specific build
├── tsconfig.json           # Standard TypeScript config
├── tsconfig.armv7.json     # ARM v7 TypeScript config
├── docker-compose.yml      # Standard multi-platform
└── docker-compose.armv7.yml # ARM v7 testing
```

## Development Workflow

### Local Development

For standard development (AMD64/ARM64):
```bash
npm run dev
```

For ARM v7 compatible development:
```bash
# Compile TypeScript
npm run build

# Run compiled version
npm run start:compiled
```

### Testing ARM v7 Build

```bash
# Build ARM v7 image locally
docker buildx build --platform linux/arm/v7 -f Dockerfile.armv7 -t iperf-web:armv7 .

# Test with docker-compose
docker-compose -f docker-compose.armv7.yml up -d

# Test manually
docker run --rm -p 8080:8080 -p 5201:5201 iperf-web:armv7
```

### CI/CD Pipeline

The GitHub Actions workflow (`docker-image.yml`) handles ARM v7 builds separately:

1. **Standard Job** (`build-standard`): Builds AMD64 and ARM64 using standard Dockerfile
2. **ARM v7 Job** (`build-armv7`): Builds ARM v7 using specialized Dockerfile

#### Image Tagging Strategy

- **Standard Images**: `latest`, `main`, `<sha>`
- **ARM v7 Images**: `armv7`, `main-armv7`, `<sha>-armv7`

## Troubleshooting

### Common ARM v7 Issues

1. **Node.js Compatibility**
   - Symptom: Container fails to start or crashes
   - Solution: Ensure using Node.js 16 or earlier

2. **TypeScript Compilation Errors**
   - Symptom: Build fails during TypeScript compilation
   - Solution: Check `tsconfig.armv7.json` for compatibility settings

3. **Module Resolution Issues**
   - Symptom: Runtime errors about missing modules
   - Solution: Verify module resolution in ARM v7 config

### Debugging ARM v7 Builds

```bash
# Build with verbose output
docker buildx build --platform linux/arm/v7 -f Dockerfile.armv7 --progress=plain .

# Run with shell access
docker run --rm -it --entrypoint /bin/sh iperf-web:armv7

# Check compiled output
docker run --rm iperf-web:armv7 ls -la dist/src/server/
```

## Performance Considerations

### ARM v7 Optimizations

1. **Smaller Runtime**: Pre-compilation eliminates TypeScript overhead
2. **Faster Startup**: No runtime compilation step
3. **Memory Efficient**: Compiled JavaScript uses less memory than TypeScript

### Trade-offs

1. **Build Time**: Longer build time due to compilation step
2. **Debug Experience**: Source maps not included in production builds
3. **File Size**: Slightly larger image due to compiled output

## Maintenance

### Updating Dependencies

When updating dependencies, test on ARM v7:

```bash
# Update package.json
npm update

# Test ARM v7 compilation
npm run build

# Test ARM v7 container
docker buildx build --platform linux/arm/v7 -f Dockerfile.armv7 .
```

### Node.js Version Updates

ARM v7 Node.js version updates require careful testing:

1. Update base image in `Dockerfile.armv7`
2. Test compilation with new version
3. Verify runtime compatibility
4. Update documentation if needed

## Future Considerations

### Potential Improvements

1. **Multi-stage Builds**: Optimize ARM v7 build size
2. **Source Maps**: Optional source map generation for debugging
3. **Automated Testing**: ARM v7 specific test suite
4. **Performance Monitoring**: ARM v7 performance metrics

### Migration Path

If Node.js ARM v7 support improves:
1. Test latest Node.js versions on ARM v7
2. Gradually migrate to standard build process
3. Maintain backward compatibility during transition
