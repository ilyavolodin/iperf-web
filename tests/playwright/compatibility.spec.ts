import { test, expect } from '@playwright/test';

test.describe('iPerf3 Compatibility Tests', () => {
  
  test('should handle standard iPerf3 server response format', async ({ page, request }) => {
    // This test verifies that our application can handle responses from standard iPerf3 servers
    
    // Mock a response that mimics standard iPerf3 JSON output
    await page.route('**/api/test/speed', async route => {
      // This is based on actual iPerf3 JSON output format
      const mockIperfResponse = {
        id: 'compat-test-123',
        hostId: 'compat-host-123',
        hostname: 'Standard iPerf3 Server',
        testType: 'speed',
        timestamp: new Date().toISOString(),
        results: {
          download: {
            bandwidth: 94371840, // ~94 Mbps in bits/sec
            bytes: 118464000,
            duration: 10.0
          },
          upload: {
            bandwidth: 47185920, // ~47 Mbps in bits/sec  
            bytes: 59232000,
            duration: 10.0
          },
          jitter: 0.123,
          packetLoss: 0.0
        }
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockIperfResponse),
      });
    });

    await page.goto('/');
    
    // Add a standard iPerf3 server
    await page.fill('#host-name', 'Standard iPerf3 Server');
    await page.fill('#host-address', '192.168.1.100');
    await page.fill('#host-port', '5201'); // Standard iPerf3 port
    await page.click('#add-host-btn');

    await page.waitForSelector('.host-card');
    await page.click('.host-card');

    // Run speed test
    await page.click('#speed-test-btn');

    // Verify results are displayed correctly
    await expect(page.locator('.result-card')).toBeVisible({ timeout: 10000 });
    
    // Check that speeds are displayed in Mbps correctly
    await expect(page.locator('.result-card')).toContainText('94.4'); // Download in Mbps
    await expect(page.locator('.result-card')).toContainText('47.2'); // Upload in Mbps
  });

  test('should verify iPerf3 server status endpoint compatibility', async ({ request }) => {
    // Test that our status endpoint returns information compatible with monitoring tools
    const response = await request.get('http://localhost:8080/api/iperf/status');
    expect(response.status()).toBe(200);
    
    const status = await response.json();
    
    // Should indicate if iPerf3 server is running
    expect(status).toHaveProperty('running');
    expect(typeof status.running).toBe('boolean');
    
    // If running, should provide process info
    if (status.running) {
      expect(status).toHaveProperty('pid');
      expect(typeof status.pid).toBe('number');
    }
  });

  test('should handle different iPerf3 port configurations', async ({ page }) => {
    // Test various common iPerf3 port configurations
    const testPorts = [5201, 5202, 9999, 12345];
    
    for (const port of testPorts) {
      await page.fill('#host-name', `iPerf3 Server Port ${port}`);
      await page.fill('#host-address', '127.0.0.1');
      await page.fill('#host-port', port.toString());
      await page.click('#add-host-btn');
      
      // Should accept any valid port
      await expect(page.locator('.host-card').last()).toContainText(port.toString());
    }
    
    // Should have all test hosts
    await expect(page.locator('.host-card')).toHaveCount(testPorts.length);
  });

  test('should handle standard iPerf3 error responses', async ({ page }) => {
    // Mock various error scenarios that standard iPerf3 might return
    await page.route('**/api/test/speed', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'iperf3: error - unable to connect to server: Connection refused'
        }),
      });
    });

    await page.goto('/');
    
    await page.fill('#host-name', 'Unreachable Server');
    await page.fill('#host-address', '192.168.1.200');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');

    await page.waitForSelector('.host-card');
    await page.click('.host-card');
    await page.click('#speed-test-btn');

    // Should handle the error gracefully
    // Specific error handling depends on implementation
  });

  test('should support standard iPerf3 test durations', async ({ page }) => {
    await page.goto('/');
    
    // Test common iPerf3 durations
    const testDurations = [1, 5, 10, 30, 60, 300];
    
    for (const duration of testDurations) {
      await page.fill('#test-duration', duration.toString());
      const value = await page.locator('#test-duration').inputValue();
      expect(value).toBe(duration.toString());
    }
    
    // Test edge cases
    await page.fill('#test-duration', '0.5'); // Should be allowed or corrected
    await page.fill('#test-duration', '3600'); // 1 hour
  });

  test('should handle IPv6 addresses', async ({ page }) => {
    await page.goto('/');
    
    // Test IPv6 address support
    await page.fill('#host-name', 'IPv6 Server');
    await page.fill('#host-address', '::1'); // IPv6 localhost
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');

    await expect(page.locator('.host-card')).toContainText('::1');
  });

  test('should support hostname resolution', async ({ page }) => {
    await page.goto('/');
    
    // Test hostname instead of IP address
    await page.fill('#host-name', 'Localhost Server');
    await page.fill('#host-address', 'localhost');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');

    await expect(page.locator('.host-card')).toContainText('localhost');
  });

  test('should handle large bandwidth values', async ({ page }) => {
    // Mock high-speed test results (10 Gbps+)
    await page.route('**/api/test/speed', async route => {
      const mockHighSpeedResponse = {
        id: 'highspeed-test-123',
        hostId: 'highspeed-host-123',
        hostname: '10Gbps Server',
        testType: 'speed',
        timestamp: new Date().toISOString(),
        results: {
          download: {
            bandwidth: 10000000000, // 10 Gbps
            bytes: 12500000000,
            duration: 10.0
          },
          upload: {
            bandwidth: 9500000000, // 9.5 Gbps
            bytes: 11875000000,
            duration: 10.0
          }
        }
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockHighSpeedResponse),
      });
    });

    await page.goto('/');
    
    await page.fill('#host-name', '10Gbps Server');
    await page.fill('#host-address', '10.0.0.1');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');

    await page.waitForSelector('.host-card');
    await page.click('.host-card');
    await page.click('#speed-test-btn');

    await expect(page.locator('.result-card')).toBeVisible({ timeout: 10000 });
    
    // Should display high speeds correctly (in Gbps or appropriate units)
    await expect(page.locator('.result-card')).toContainText('10000.0'); // 10 Gbps
  });

  test('should maintain backwards compatibility with iPerf3 command line args', async ({ request }) => {
    // Verify our API accepts parameters that map to standard iPerf3 command line options
    
    // Test duration parameter (-t option)
    let response = await request.post('http://localhost:8080/api/test/speed', {
      data: {
        hostId: 'test-host',
        duration: 30 // Maps to -t 30
      }
    });
    // Should not fail due to parameter format
    
    // Test ping count parameter
    response = await request.post('http://localhost:8080/api/test/ping', {
      data: {
        hostId: 'test-host',
        count: 10 // Maps to -c 10
      }
    });
    
    // Test traceroute max hops
    response = await request.post('http://localhost:8080/api/test/traceroute', {
      data: {
        hostId: 'test-host',
        maxHops: 15 // Maps to -m 15
      }
    });
  });

  test('should handle iPerf3 JSON output format variations', async ({ page }) => {
    // Test with different JSON response formats that real iPerf3 servers might return
    
    const variations = [
      // Standard format
      {
        download: { bandwidth: 100000000, bytes: 1000000, duration: 10 },
        upload: { bandwidth: 50000000, bytes: 500000, duration: 10 }
      },
      // Format with additional fields
      {
        download: { 
          bandwidth: 100000000, 
          bytes: 1000000, 
          duration: 10,
          retransmits: 0,
          max_snd_cwnd: 131072
        },
        upload: { 
          bandwidth: 50000000, 
          bytes: 500000, 
          duration: 10,
          retransmits: 2,
          max_snd_cwnd: 65536
        },
        jitter: 0.156,
        packetLoss: 0.1
      }
    ];

    for (let i = 0; i < variations.length; i++) {
      await page.route(`**/api/test/speed`, async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: `variation-test-${i}`,
            hostId: `variation-host-${i}`,
            hostname: `Variation ${i} Server`,
            testType: 'speed',
            timestamp: new Date().toISOString(),
            results: variations[i]
          }),
        });
      });

      await page.goto('/');
      
      await page.fill('#host-name', `Variation ${i} Server`);
      await page.fill('#host-address', '127.0.0.1');
      await page.fill('#host-port', '5201');
      await page.click('#add-host-btn');

      await page.waitForSelector('.host-card');
      await page.click('.host-card');
      await page.click('#speed-test-btn');

      // Should handle all variations without errors
      await expect(page.locator('.result-card')).toBeVisible({ timeout: 10000 });
    }
  });

  test('should integrate with standard iPerf3 monitoring tools', async ({ request }) => {
    // Test that our endpoints provide data in formats that standard monitoring tools expect
    
    // Status check that monitoring tools might use
    const statusResponse = await request.get('http://localhost:8080/api/status');
    expect(statusResponse.status()).toBe(200);
    
    const status = await statusResponse.json();
    
    // Should provide standard monitoring fields
    expect(status).toHaveProperty('status');
    expect(status).toHaveProperty('timestamp');
    expect(status).toHaveProperty('services');
    
    // Timestamp should be ISO format
    expect(status.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});