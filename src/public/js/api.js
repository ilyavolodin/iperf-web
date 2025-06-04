/**
 * API Client for iPerf3 Web Application
 */
class ApiClient {
    constructor() {
        this.baseUrl = '';
        this.ws = null;
        this.wsCallbacks = {
            onMessage: null,
            onConnect: null,
            onDisconnect: null,
            onError: null
        };
        this.setupWebSocket();
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            if (this.wsCallbacks.onConnect) {
                this.wsCallbacks.onConnect();
            }
        };
        
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (this.wsCallbacks.onMessage) {
                    this.wsCallbacks.onMessage(message);
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            if (this.wsCallbacks.onDisconnect) {
                this.wsCallbacks.onDisconnect();
            }
            
            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                this.setupWebSocket();
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (this.wsCallbacks.onError) {
                this.wsCallbacks.onError(error);
            }
        };
    }

    onWebSocketMessage(callback) {
        this.wsCallbacks.onMessage = callback;
    }

    onWebSocketConnect(callback) {
        this.wsCallbacks.onConnect = callback;
    }

    onWebSocketDisconnect(callback) {
        this.wsCallbacks.onDisconnect = callback;
    }

    onWebSocketError(callback) {
        this.wsCallbacks.onError = callback;
    }

    async request(method, endpoint, data = null) {
        const url = `${this.baseUrl}/api${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API request failed: ${method} ${endpoint}`, error);
            throw error;
        }
    }

    // Discovery endpoints
    async getHosts() {
        return this.request('GET', '/discovery/hosts');
    }

    async addHost(name, address, port) {
        return this.request('POST', '/discovery/hosts', { name, address, port });
    }

    async removeHost(id) {
        return this.request('DELETE', `/discovery/hosts/${id}`);
    }

    // Test endpoints
    async runSpeedTest(hostId, duration = 10, reverse = false) {
        return this.request('POST', '/test/speed', { hostId, duration, reverse });
    }

    async runPingTest(hostId, count = 4) {
        return this.request('POST', '/test/ping', { hostId, count });
    }

    async runTracerouteTest(hostId, maxHops = 30) {
        return this.request('POST', '/test/traceroute', { hostId, maxHops });
    }

    async runFullTest(hostId, duration = 10, pingCount = 4, reverse = false, maxHops = 30) {
        return this.request('POST', '/test/full', { 
            hostId, 
            duration, 
            pingCount, 
            reverse,
            maxHops 
        });
    }

    async testConnectivity(hostId) {
        return this.request('POST', `/test/connectivity/${hostId}`);
    }

    // History endpoints
    async getHistory(hostId = null, limit = 100) {
        const params = new URLSearchParams();
        if (hostId) params.append('hostId', hostId);
        if (limit) params.append('limit', limit.toString());
        
        const query = params.toString();
        return this.request('GET', `/history${query ? '?' + query : ''}`);
    }

    async getHostHistory(hostId, limit = 50) {
        return this.request('GET', `/history/${hostId}?limit=${limit}`);
    }

    async deleteTestResult(id) {
        return this.request('DELETE', `/history/${id}`);
    }

    // Status endpoints
    async getStatus() {
        return this.request('GET', '/status');
    }

    async getIperfStatus() {
        return this.request('GET', '/iperf/status');
    }
}

// Global API instance
window.api = new ApiClient();