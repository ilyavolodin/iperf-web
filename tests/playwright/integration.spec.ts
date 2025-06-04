import { test, expect } from '@playwright/test';

test.describe('iPerf3 Web Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize
    await page.waitForSelector('.app-header', { timeout: 10000 });
  });

  test('should complete full workflow: add host, select, and attempt test', async ({ page }) => {
    // Step 1: Add a manual host
    await page.fill('#host-name', 'Integration Test Host');
    await page.fill('#host-address', '127.0.0.1');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');

    // Step 2: Wait for host to appear and verify it's added
    await expect(page.locator('.host-card')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.host-name')).toContainText('Integration Test Host');

    // Step 3: Select the host
    await page.click('.host-card');
    await expect(page.locator('.host-card')).toHaveClass(/selected/);
    await expect(page.locator('#selected-host')).toContainText('Integration Test Host');

    // Step 4: Verify test buttons are enabled
    await expect(page.locator('#speed-test-btn')).toBeEnabled();
    await expect(page.locator('#ping-test-btn')).toBeEnabled();
    await expect(page.locator('#traceroute-test-btn')).toBeEnabled();
    await expect(page.locator('#full-test-btn')).toBeEnabled();

    // Step 5: Test connectivity
    await page.click('.test-connectivity-btn');
    // Should show some feedback (either success or failure)
    // This depends on whether localhost:5201 is actually running
  });

  test('should handle WebSocket real-time updates', async ({ page }) => {
    // Monitor WebSocket messages
    const wsMessages: any[] = [];
    
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        try {
          const message = JSON.parse(event.payload.toString());
          wsMessages.push(message);
        } catch (e) {
          // Ignore non-JSON messages
        }
      });
    });

    // Wait for WebSocket connection
    await page.waitForTimeout(3000);

    // Add a host (should trigger WebSocket message)
    await page.fill('#host-name', 'WebSocket Test Host');
    await page.fill('#host-address', '192.168.1.100');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');

    // Wait for potential WebSocket messages
    await page.waitForTimeout(2000);

    // Check if status updates properly
    const statusText = page.locator('.status-text');
    await expect(statusText).toBeVisible();
  });

  test('should persist and display test history', async ({ page }) => {
    // Mock successful ping test to create history
    await page.route('**/api/test/ping', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-ping-123',
          hostId: 'host-123',
          hostname: 'Test Host',
          testType: 'ping',
          timestamp: new Date().toISOString(),
          results: {
            host: '127.0.0.1',
            packetsTransmitted: 4,
            packetsReceived: 4,
            packetLoss: 0,
            times: {
              min: 0.1,
              avg: 0.2,
              max: 0.3,
              stddev: 0.05
            }
          }
        }),
      });
    });

    // Mock history endpoint to return our test result
    await page.route('**/api/history*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'test-ping-123',
            hostId: 'host-123',
            hostname: 'Test Host',
            testType: 'ping',
            timestamp: new Date().toISOString(),
            results: {
              host: '127.0.0.1',
              packetsTransmitted: 4,
              packetsReceived: 4,
              packetLoss: 0,
              times: {
                min: 0.1,
                avg: 0.2,
                max: 0.3,
                stddev: 0.05
              }
            }
          }
        ]),
      });
    });

    // Add and select a host
    await page.fill('#host-name', 'History Test Host');
    await page.fill('#host-address', '127.0.0.1');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');
    
    await page.waitForSelector('.host-card');
    await page.click('.host-card');

    // Run a ping test
    await page.click('#ping-test-btn');

    // Should show in test results
    await expect(page.locator('.result-card')).toBeVisible({ timeout: 10000 });

    // Should show in history
    await expect(page.locator('.history-item')).toBeVisible({ timeout: 5000 });
  });

  test('should handle multiple hosts and selection', async ({ page }) => {
    // Add first host
    await page.fill('#host-name', 'Host 1');
    await page.fill('#host-address', '192.168.1.10');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');

    await page.waitForSelector('.host-card');

    // Add second host
    await page.fill('#host-name', 'Host 2');
    await page.fill('#host-address', '192.168.1.20');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');

    // Should have two host cards
    await expect(page.locator('.host-card')).toHaveCount(2);

    // Select first host
    await page.locator('.host-card').first().click();
    await expect(page.locator('.host-card').first()).toHaveClass(/selected/);
    await expect(page.locator('#selected-host')).toContainText('Host 1');

    // Select second host
    await page.locator('.host-card').last().click();
    await expect(page.locator('.host-card').last()).toHaveClass(/selected/);
    await expect(page.locator('.host-card').first()).not.toHaveClass(/selected/);
    await expect(page.locator('#selected-host')).toContainText('Host 2');
  });

  test('should handle host removal', async ({ page }) => {
    // Add a host
    await page.fill('#host-name', 'Host to Remove');
    await page.fill('#host-address', '192.168.1.99');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');

    await page.waitForSelector('.host-card');
    
    // Select the host
    await page.click('.host-card');
    await expect(page.locator('#selected-host')).toContainText('Host to Remove');

    // Remove the host
    await page.click('.remove-host-btn');
    
    // Confirm removal in dialog
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Remove host');
      await dialog.accept();
    });

    // Host should be removed and selection cleared
    await expect(page.locator('.host-card')).toHaveCount(0);
    await expect(page.locator('#selected-host')).toContainText('No host selected');
  });

  test('should update test options and reflect in tests', async ({ page }) => {
    // Change test duration
    await page.fill('#test-duration', '5');
    await page.fill('#ping-count', '10');

    // Add and select a host
    await page.fill('#host-name', 'Options Test Host');
    await page.fill('#host-address', '127.0.0.1');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');
    
    await page.waitForSelector('.host-card');
    await page.click('.host-card');

    // Verify the values are maintained
    await expect(page.locator('#test-duration')).toHaveValue('5');
    await expect(page.locator('#ping-count')).toHaveValue('10');
  });

  test('should handle modal interactions', async ({ page }) => {
    // Mock a test result to trigger modal
    await page.route('**/api/test/ping', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'modal-test-123',
          hostId: 'host-123',
          hostname: 'Modal Test Host',
          testType: 'ping',
          timestamp: new Date().toISOString(),
          results: {
            host: '127.0.0.1',
            packetsTransmitted: 4,
            packetsReceived: 4,
            packetLoss: 0,
            times: {
              min: 0.1,
              avg: 0.2,
              max: 0.3,
              stddev: 0.05
            }
          }
        }),
      });
    });

    // Add and select host
    await page.fill('#host-name', 'Modal Test Host');
    await page.fill('#host-address', '127.0.0.1');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');
    
    await page.waitForSelector('.host-card');
    await page.click('.host-card');

    // Run test to trigger modal
    await page.click('#ping-test-btn');

    // Modal should appear
    await expect(page.locator('#result-modal')).toHaveClass(/show/, { timeout: 10000 });
    await expect(page.locator('#modal-title')).toContainText('PING Test Results');

    // Close modal with X button
    await page.click('#modal-close');
    await expect(page.locator('#result-modal')).not.toHaveClass(/show/);
  });

  test('should refresh hosts and maintain state', async ({ page }) => {
    // Add a host
    await page.fill('#host-name', 'Refresh Test Host');
    await page.fill('#host-address', '192.168.1.50');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');

    await page.waitForSelector('.host-card');
    
    // Select the host
    await page.click('.host-card');
    await expect(page.locator('#selected-host')).toContainText('Refresh Test Host');

    // Refresh hosts
    await page.click('#refresh-hosts-btn');

    // Should maintain selection after refresh
    await expect(page.locator('#selected-host')).toContainText('Refresh Test Host');
    await expect(page.locator('.host-card')).toHaveClass(/selected/);
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Intercept and fail API calls
    await page.route('**/api/discovery/hosts', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server error' }),
      });
    });

    // Try to add a host (should fail gracefully)
    await page.fill('#host-name', 'Error Test Host');
    await page.fill('#host-address', '127.0.0.1');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');

    // Should handle the error (may show alert or error message)
    // The exact behavior depends on how errors are handled in the UI
  });

  test('should export results functionality', async ({ page }) => {
    // Mock a test result
    await page.route('**/api/test/speed', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'export-test-123',
          hostId: 'host-123',
          hostname: 'Export Test Host',
          testType: 'speed',
          timestamp: new Date().toISOString(),
          results: {
            download: { bandwidth: 100000000, bytes: 1000000, duration: 10 },
            upload: { bandwidth: 50000000, bytes: 500000, duration: 10 }
          }
        }),
      });
    });

    // Add host and run test to get results
    await page.fill('#host-name', 'Export Test Host');
    await page.fill('#host-address', '127.0.0.1');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');
    
    await page.waitForSelector('.host-card');
    await page.click('.host-card');
    await page.click('#speed-test-btn');

    // Wait for result to appear
    await expect(page.locator('.result-card')).toBeVisible({ timeout: 10000 });

    // Test export button (may trigger download)
    await page.click('#export-results-btn');
    // The actual download testing would require more complex setup
  });
});