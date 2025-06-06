# Testing Guide for UI Fixes

## Overview
All UI fixes have been implemented in the code. This guide outlines how to test the fixes in the Docker environment.

## Fixed Issues to Test

### 1. Gauge Scaling (>1000 Mbps)
**Fix**: Dynamic gauge scaling with `scaleGaugeIfNeeded()` method
**Test**: Run speed tests on high-speed connections
- Look for speeds >1000 Mbps appearing as single values, not 10 separate segments
- Gauge should scale to 2000→5000→10000→20000 Mbps as needed
- Check console logs for scaling messages

### 2. Live Metrics Bar Latency Updates
**Fix**: Enhanced `updateProgress()` method with ping-specific updates
**Test**: Run ping tests or full network tests
- Latency value in metrics bar should update in real-time during ping phase
- Should show current ping times, not remain static at "-- ms"

### 3. Download Speed During Upload Tests
**Fix**: Phase-based speed updates in `updateProgress()`
**Test**: Run speed tests with both download and upload
- Download speed should remain stable during upload phase
- Upload speed should only update during upload phase
- No cross-contamination between download/upload metrics

### 4. Jitter Calculation
**Fix**: Real-time jitter calculation from ping variance
**Test**: Run ping tests or full network tests
- Jitter should show actual calculated values, not always "-- ms"
- Should update in real-time during ping tests
- Formula: `sqrt(variance)` from ping times array

### 5. Status Labels
**Fix**: Comprehensive status management in `updateProgress()`
**Test**: Run full network tests
- Status should show "Running..." for active phase
- Status should show "Pending" for upcoming phases  
- Status should show "Complete" for finished phases
- No status should remain stuck in wrong state

## Docker Testing Commands

```bash
# Build and start the application
docker-compose up --build

# Access the application
# Open browser to http://localhost:8080

# Test scenarios:
# 1. Add a high-speed iperf3 server
# 2. Run full network tests
# 3. Monitor gauge scaling during speed tests
# 4. Watch metrics bar during ping phase
# 5. Verify jitter calculations appear
# 6. Check status transitions
```

## Key Files Modified
- `src/public/js/ui.js` - Main UI logic with all fixes
- `src/public/js/charts.js` - Gauge rendering (referenced by scaling)
- `src/server/services/network.ts` - Ping times tracking for jitter
- `src/server/services/iperf.ts` - Speed test service integration

## Expected Behavior
All UI elements should now update smoothly and accurately during test execution, with proper real-time metrics and status indicators.
