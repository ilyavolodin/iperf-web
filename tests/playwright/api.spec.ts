import { test, expect } from '@playwright/test';

test.describe('iPerf3 Web API', () => {
  const baseURL = 'http://localhost:8080';

  test('should respond to status endpoint', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/status`);
    expect(response.status()).toBe(200);
    
    const status = await response.json();
    expect(status).toHaveProperty('status');
    expect(status).toHaveProperty('hostname');
    expect(status).toHaveProperty('timestamp');
    expect(status).toHaveProperty('services');
    expect(status.services).toHaveProperty('web');
    expect(status.services).toHaveProperty('iperf');
    expect(status.services).toHaveProperty('discovery');
  });

  test('should get empty hosts list initially', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/discovery/hosts`);
    expect(response.status()).toBe(200);
    
    const hosts = await response.json();
    expect(Array.isArray(hosts)).toBe(true);
  });

  test('should add a manual host', async ({ request }) => {
    const hostData = {
      name: 'Test Host',
      address: '127.0.0.1',
      port: 5201
    };

    const response = await request.post(`${baseURL}/api/discovery/hosts`, {
      data: hostData
    });
    
    expect(response.status()).toBe(200);
    
    const host = await response.json();
    expect(host).toHaveProperty('id');
    expect(host).toHaveProperty('name', hostData.name);
    expect(host).toHaveProperty('address', hostData.address);
    expect(host).toHaveProperty('port', hostData.port);
    expect(host).toHaveProperty('discovered', false);
    expect(host).toHaveProperty('lastSeen');
  });

  test('should validate required fields when adding host', async ({ request }) => {
    // Test missing name
    let response = await request.post(`${baseURL}/api/discovery/hosts`, {
      data: { address: '127.0.0.1', port: 5201 }
    });
    expect(response.status()).toBe(400);

    // Test missing address
    response = await request.post(`${baseURL}/api/discovery/hosts`, {
      data: { name: 'Test', port: 5201 }
    });
    expect(response.status()).toBe(400);

    // Test missing port
    response = await request.post(`${baseURL}/api/discovery/hosts`, {
      data: { name: 'Test', address: '127.0.0.1' }
    });
    expect(response.status()).toBe(400);

    // Test invalid port
    response = await request.post(`${baseURL}/api/discovery/hosts`, {
      data: { name: 'Test', address: '127.0.0.1', port: 'invalid' }
    });
    expect(response.status()).toBe(400);
  });

  test('should get iPerf status', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/iperf/status`);
    expect(response.status()).toBe(200);
    
    const status = await response.json();
    expect(status).toHaveProperty('running');
  });

  test('should get empty history initially', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/history`);
    expect(response.status()).toBe(200);
    
    const history = await response.json();
    expect(Array.isArray(history)).toBe(true);
  });

  test('should handle pagination for history', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/history?limit=10`);
    expect(response.status()).toBe(200);
    
    const history = await response.json();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeLessThanOrEqual(10);
  });

  test('should require hostId for tests', async ({ request }) => {
    // Test speed test without hostId
    let response = await request.post(`${baseURL}/api/test/speed`, {
      data: { duration: 10 }
    });
    expect(response.status()).toBe(400);

    // Test ping test without hostId
    response = await request.post(`${baseURL}/api/test/ping`, {
      data: { count: 4 }
    });
    expect(response.status()).toBe(400);

    // Test traceroute without hostId
    response = await request.post(`${baseURL}/api/test/traceroute`, {
      data: { maxHops: 30 }
    });
    expect(response.status()).toBe(400);

    // Test full test without hostId
    response = await request.post(`${baseURL}/api/test/full`, {
      data: { duration: 10 }
    });
    expect(response.status()).toBe(400);
  });

  test('should return 404 for non-existent host tests', async ({ request }) => {
    const fakeHostId = 'non-existent-host-id';

    // Test speed test with fake hostId
    let response = await request.post(`${baseURL}/api/test/speed`, {
      data: { hostId: fakeHostId, duration: 10 }
    });
    expect(response.status()).toBe(404);

    // Test ping test with fake hostId
    response = await request.post(`${baseURL}/api/test/ping`, {
      data: { hostId: fakeHostId, count: 4 }
    });
    expect(response.status()).toBe(404);

    // Test connectivity test with fake hostId
    response = await request.post(`${baseURL}/api/test/connectivity/${fakeHostId}`);
    expect(response.status()).toBe(404);
  });

  test('should handle CORS headers', async ({ request }) => {
    const response = await request.options(`${baseURL}/api/status`);
    expect(response.status()).toBe(204);
    
    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBeDefined();
  });

  test('should serve static files', async ({ request }) => {
    const response = await request.get(`${baseURL}/`);
    expect(response.status()).toBe(200);
    
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/html');
  });

  test('should serve CSS files', async ({ request }) => {
    const response = await request.get(`${baseURL}/css/styles.css`);
    expect(response.status()).toBe(200);
    
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('text/css');
  });

  test('should serve JavaScript files', async ({ request }) => {
    const response = await request.get(`${baseURL}/js/app.js`);
    expect(response.status()).toBe(200);
    
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('javascript');
  });

  test('should handle 404 for non-existent files', async ({ request }) => {
    const response = await request.get(`${baseURL}/non-existent-file.js`);
    expect(response.status()).toBe(404);
  });

  test('should delete test results', async ({ request }) => {
    // Try to delete a non-existent result
    const response = await request.delete(`${baseURL}/api/history/non-existent-id`);
    expect(response.status()).toBe(404);
  });

  test('should remove hosts', async ({ request }) => {
    // First add a host
    const hostData = {
      name: 'Test Host for Removal',
      address: '127.0.0.1',
      port: 5202
    };

    const addResponse = await request.post(`${baseURL}/api/discovery/hosts`, {
      data: hostData
    });
    expect(addResponse.status()).toBe(200);
    
    const host = await addResponse.json();
    
    // Now remove the host
    const removeResponse = await request.delete(`${baseURL}/api/discovery/hosts/${host.id}`);
    expect(removeResponse.status()).toBe(200);
    
    const result = await removeResponse.json();
    expect(result).toHaveProperty('success', true);
  });

  test('should handle removal of non-existent hosts', async ({ request }) => {
    const response = await request.delete(`${baseURL}/api/discovery/hosts/non-existent-id`);
    expect(response.status()).toBe(404);
  });

  test('should filter history by host', async ({ request }) => {
    // Get history for a specific host (even if empty)
    const response = await request.get(`${baseURL}/api/history/some-host-id`);
    expect(response.status()).toBe(200);
    
    const history = await response.json();
    expect(Array.isArray(history)).toBe(true);
  });
});