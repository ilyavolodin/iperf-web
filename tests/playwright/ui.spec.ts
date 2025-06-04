import { test, expect } from '@playwright/test';

test.describe('iPerf3 Web UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the main page', async ({ page }) => {
    await expect(page).toHaveTitle(/iPerf3 Web/);
    await expect(page.locator('h1')).toContainText('iPerf3 Web');
    await expect(page.locator('.subtitle')).toContainText('Network Performance Testing');
  });

  test('should show application status', async ({ page }) => {
    await expect(page.locator('.status-indicator')).toBeVisible();
    await expect(page.locator('.status-dot')).toBeVisible();
    await expect(page.locator('.status-text')).toBeVisible();
  });

  test('should display all main sections', async ({ page }) => {
    // Check for main sections
    await expect(page.locator('text=Available Hosts')).toBeVisible();
    await expect(page.locator('text=Network Tests')).toBeVisible();
    await expect(page.locator('text=Test Results')).toBeVisible();
    await expect(page.locator('text=Test History')).toBeVisible();
  });

  test('should show add host form', async ({ page }) => {
    await expect(page.locator('#add-host-form')).toBeVisible();
    await expect(page.locator('#host-name')).toBeVisible();
    await expect(page.locator('#host-address')).toBeVisible();
    await expect(page.locator('#host-port')).toBeVisible();
    await expect(page.locator('#add-host-btn')).toBeVisible();
  });

  test('should have test buttons disabled initially', async ({ page }) => {
    await expect(page.locator('#speed-test-btn')).toBeDisabled();
    await expect(page.locator('#ping-test-btn')).toBeDisabled();
    await expect(page.locator('#traceroute-test-btn')).toBeDisabled();
    await expect(page.locator('#full-test-btn')).toBeDisabled();
  });

  test('should add a manual host', async ({ page }) => {
    // Fill in host details
    await page.fill('#host-name', 'Test Server');
    await page.fill('#host-address', '127.0.0.1');
    await page.fill('#host-port', '5201');

    // Click add host button
    await page.click('#add-host-btn');

    // Wait for the host to appear (with timeout for API call)
    await expect(page.locator('.host-card')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.host-name')).toContainText('Test Server');
    await expect(page.locator('.host-address')).toContainText('127.0.0.1:5201');
  });

  test('should select a host and enable test buttons', async ({ page }) => {
    // First add a host
    await page.fill('#host-name', 'Test Server');
    await page.fill('#host-address', '127.0.0.1');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');

    // Wait for host to appear and click it
    await page.waitForSelector('.host-card', { timeout: 10000 });
    await page.click('.host-card');

    // Check that host is selected
    await expect(page.locator('.host-card')).toHaveClass(/selected/);
    await expect(page.locator('#selected-host')).toContainText('Test Server');

    // Check that test buttons are enabled
    await expect(page.locator('#speed-test-btn')).toBeEnabled();
    await expect(page.locator('#ping-test-btn')).toBeEnabled();
    await expect(page.locator('#traceroute-test-btn')).toBeEnabled();
    await expect(page.locator('#full-test-btn')).toBeEnabled();
  });

  test('should refresh hosts when refresh button is clicked', async ({ page }) => {
    const refreshButton = page.locator('#refresh-hosts-btn');
    await expect(refreshButton).toBeVisible();
    
    // Click refresh button
    await refreshButton.click();

    // Button should show loading state briefly
    await expect(refreshButton).toHaveClass(/loading/, { timeout: 1000 });
  });

  test('should show test options', async ({ page }) => {
    await expect(page.locator('#test-duration')).toBeVisible();
    await expect(page.locator('#ping-count')).toBeVisible();
    
    // Check default values
    await expect(page.locator('#test-duration')).toHaveValue('10');
    await expect(page.locator('#ping-count')).toHaveValue('4');
  });

  test('should open modal when test is triggered', async ({ page }) => {
    // Add and select a host first
    await page.fill('#host-name', 'Test Server');
    await page.fill('#host-address', '127.0.0.1');
    await page.fill('#host-port', '5201');
    await page.click('#add-host-btn');
    
    await page.waitForSelector('.host-card', { timeout: 10000 });
    await page.click('.host-card');

    // Mock the API response to avoid actual test execution
    await page.route('**/api/test/ping', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-123',
          hostId: 'host-123',
          hostname: 'Test Server',
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

    // Click ping test button
    await page.click('#ping-test-btn');

    // Should show progress section
    await expect(page.locator('#progress-section')).toBeVisible({ timeout: 5000 });
  });

  test('should handle form validation', async ({ page }) => {
    // Try to add host with empty fields
    await page.click('#add-host-btn');
    
    // Should show validation (browser native or custom)
    // This test depends on how validation is implemented
    const nameField = page.locator('#host-name');
    await expect(nameField).toBeFocused();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Check that elements are still visible and properly arranged
    await expect(page.locator('.app-header')).toBeVisible();
    await expect(page.locator('.main-content')).toBeVisible();
    await expect(page.locator('#add-host-form')).toBeVisible();
  });

  test('should handle WebSocket connection status', async ({ page }) => {
    // Initially should show connecting or connected status
    const statusText = page.locator('.status-text');
    await expect(statusText).toBeVisible();
    
    // Should eventually show connected status (when WebSocket connects)
    await expect(statusText).toContainText(/Connected|Connecting/, { timeout: 10000 });
  });

  test('should clear form after successful host addition', async ({ page }) => {
    await page.fill('#host-name', 'Test Server');
    await page.fill('#host-address', '127.0.0.1');
    await page.fill('#host-port', '5201');

    await page.click('#add-host-btn');

    // After successful addition, form should be cleared
    await expect(page.locator('#host-name')).toHaveValue('');
    await expect(page.locator('#host-address')).toHaveValue('');
    await expect(page.locator('#host-port')).toHaveValue('5201'); // Default value
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Test tab navigation through form fields
    await page.press('#host-name', 'Tab');
    await expect(page.locator('#host-address')).toBeFocused();
    
    await page.press('#host-address', 'Tab');
    await expect(page.locator('#host-port')).toBeFocused();
  });

  test('should show history filter options', async ({ page }) => {
    const historyFilter = page.locator('#history-filter');
    await expect(historyFilter).toBeVisible();
    
    // Should have default "All Hosts" option
    await expect(historyFilter.locator('option[value=""]')).toContainText('All Hosts');
  });
});