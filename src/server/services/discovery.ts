import { Bonjour } from 'bonjour-service';
import type { Host, AppConfig } from '../../types/index.js';
// Broadcast function will be injected to avoid circular imports
let broadcastFunction: ((message: any) => void) | null = null;

class DiscoveryService {
    private bonjour: Bonjour | null = null;
    private service: any = null;
    private browser: any = null;
    private hosts: Map<string, Host> = new Map();
    private running: boolean = false;
    private config: AppConfig | null = null;
    private cleanupInterval: NodeJS.Timeout | null = null;
    // Track host fingerprints to prevent duplicates
    private hostFingerprints: Map<string, string> = new Map(); // fingerprint -> hostId

    async start(config: AppConfig): Promise<void> {
        this.config = config;
        
        // Try mDNS first (for bare metal/VM deployments)
        try {
            this.bonjour = new Bonjour();
            
            // Advertise our service
            this.service = this.bonjour.publish({
                name: config.hostname,
                type: 'iperf3-web',
                port: config.webPort,
                txt: {
                    iperfPort: config.iperfPort.toString(),
                    version: '1.0.0',
                    hostname: config.hostname
                }
            });

            // Browse for other services
            this.browser = this.bonjour.find({ type: 'iperf3-web' }, (service: any) => {
                if (service.name !== config.hostname) {
                    this.handleServiceUp(service);
                }
            });

            // Handle service down events
            this.browser.on('down', (service: any) => {
                this.handleServiceDown(service);
            });
            
            console.log('mDNS discovery enabled');
        } catch (error) {
            console.warn('mDNS discovery failed, falling back to Docker discovery:', error);
        }

        // Also enable Docker-aware discovery for containerized environments
        this.startDockerDiscovery();

        // Set up cleanup interval for stale hosts
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleHosts();
        }, config.discoveryInterval * 1000);

        this.running = true;
        console.log(`Discovery service started for ${config.hostname}`);
    }

    async stop(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (this.browser) {
            this.browser.stop();
            this.browser = null;
        }

        if (this.service) {
            this.service.stop();
            this.service = null;
        }

        if (this.bonjour) {
            this.bonjour.destroy();
            this.bonjour = null;
        }

        this.running = false;
        this.hosts.clear();
        this.hostFingerprints.clear();
        console.log('Discovery service stopped');
    }

    isRunning(): boolean {
        return this.running;
    }

    getHosts(): Host[] {
        return Array.from(this.hosts.values());
    }

    addManualHost(name: string, address: string, port: number): Host {
        const id = `manual-${address}:${port}`;
        this.addOrUpdateHost(id, name, address, port, false);
        return this.hosts.get(id)!;
    }

    removeHost(id: string): boolean {
        const host = this.hosts.get(id);
        const removed = this.hosts.delete(id);
        
        if (removed && host) {
            // Clean up fingerprint mapping
            const fingerprint = this.createHostFingerprint(host.address, host.port);
            this.hostFingerprints.delete(fingerprint);
            
            if (broadcastFunction) {
                broadcastFunction({
                    type: 'host_lost',
                    data: { id }
                });
            }
        }
        return removed;
    }

    private handleServiceUp(service: any): void {
        const address = service.addresses?.[0] || service.host;
        const iperfPort = parseInt(service.txt?.iperfPort || '5201');
        const hostname = service.txt?.hostname || service.name;
        const id = `discovered-${address}:${iperfPort}`;

        this.addOrUpdateHost(id, hostname, address, iperfPort, true);
    }

    private handleServiceDown(service: any): void {
        const address = service.addresses?.[0] || service.host;
        const iperfPort = parseInt(service.txt?.iperfPort || '5201');
        const id = `discovered-${address}:${iperfPort}`;

        if (this.hosts.has(id)) {
            this.hosts.delete(id);
            console.log(`Lost iPerf3 service: ${service.name} at ${address}:${iperfPort}`);
            
            if (broadcastFunction) {
                broadcastFunction({
                    type: 'host_lost',
                    data: { id }
                });
            }
        }
    }

    private cleanupStaleHosts(): void {
        if (!this.config) return;

        const staleThreshold = this.config.discoveryInterval * 3 * 1000; // 3x discovery interval
        const now = new Date();

        for (const [id, host] of this.hosts.entries()) {
            if (!host.discovered) continue; // Don't cleanup manual hosts

            const timeSinceLastSeen = now.getTime() - host.lastSeen.getTime();
            if (timeSinceLastSeen > staleThreshold) {
                this.hosts.delete(id);
                console.log(`Cleaned up stale host: ${host.name}`);
                
                if (broadcastFunction) {
                    broadcastFunction({
                        type: 'host_lost',
                        data: { id }
                    });
                }
            }
        }
    }

    setBroadcastFunction(fn: (message: any) => void): void {
        broadcastFunction = fn;
    }

    // Create a fingerprint to identify the same host across different addresses
    private createHostFingerprint(address: string, port: number): string {
        // Normalize all addresses to a consistent logical hostname
        // This allows IP addresses and service names to be treated as the same host
        
        const ipRegex = /^\d+\.\d+\.\d+\.\d+$/;
        let normalizedHost = address;
        
        if (ipRegex.test(address)) {
            // For IP addresses, try to map to known service names based on common Docker network patterns
            if (address.match(/^172\.18\.0\.[23]$/) || address.match(/^172\.17\.0\.[23]$/)) {
                // Common Docker network ranges - map based on last octet
                const lastOctet = address.split('.')[3];
                if (lastOctet === '2') {
                    normalizedHost = 'iperf-node-1';  // First node typically gets .2
                } else if (lastOctet === '3') {
                    normalizedHost = 'iperf-node-2';  // Second node typically gets .3
                }
            }
        } else {
            // For hostnames, normalize Docker Compose service names
            if (address.includes('iperf-web-1') || address.includes('iperf-node-1')) {
                normalizedHost = 'iperf-node-1';
            } else if (address.includes('iperf-web-2') || address.includes('iperf-node-2')) {
                normalizedHost = 'iperf-node-2';
            }
        }
        
        return `${normalizedHost}:${port}`;
    }

    // Get preferred address type for a host (IP > service name > container name)
    private getAddressPriority(address: string): number {
        const ipRegex = /^\d+\.\d+\.\d+\.\d+$/;
        
        if (ipRegex.test(address)) {
            return 1; // Highest priority - IP address
        } else if (address.match(/^iperf-web-\d+$/)) {
            return 2; // Service names
        } else {
            return 3; // Container names or others
        }
    }

    // Add or update a host with deduplication
    private addOrUpdateHost(id: string, name: string, address: string, port: number, discovered: boolean = true): boolean {
        const fingerprint = this.createHostFingerprint(address, port);
        
        // Skip self-discovery
        if (name === this.config?.hostname || address === this.config?.hostname) {
            return false;
        }
        
        // Check if we already have this host under a different address
        const existingHostId = this.hostFingerprints.get(fingerprint);
        if (existingHostId && this.hosts.has(existingHostId)) {
            const existingHost = this.hosts.get(existingHostId)!;
            const currentPriority = this.getAddressPriority(existingHost.address);
            const newPriority = this.getAddressPriority(address);
            
            // Update if new address has higher priority
            if (newPriority < currentPriority) {
                // Remove old host entry but keep the fingerprint mapping
                this.hosts.delete(existingHostId);
                
                // Create new host with better address
                const newHost: Host = {
                    id,
                    name,
                    address,
                    port,
                    discovered,
                    lastSeen: new Date()
                };
                
                this.hosts.set(id, newHost);
                this.hostFingerprints.set(fingerprint, id);
                
                console.log(`Updated host ${name}: ${existingHost.address} -> ${address} (higher priority)`);
                
                if (broadcastFunction) {
                    broadcastFunction({
                        type: 'host_discovered',
                        data: newHost
                    });
                }
                return true;
            } else {
                // Just update last seen time
                existingHost.lastSeen = new Date();
                return false;
            }
        }
        
        // New host
        const host: Host = {
            id,
            name,
            address,
            port,
            discovered,
            lastSeen: new Date()
        };

        this.hosts.set(id, host);
        this.hostFingerprints.set(fingerprint, id);
        
        console.log(`Discovered ${discovered ? 'host' : 'manual host'}: ${name} at ${address}:${port}`);
        
        if (broadcastFunction) {
            broadcastFunction({
                type: 'host_discovered',
                data: host
            });
        }
        
        return true;
    }

    private async startDockerDiscovery(): Promise<void> {
        // In Docker, try to discover other containers on the same network
        setInterval(async () => {
            await this.discoverDockerContainers();
        }, (this.config?.discoveryInterval || 30) * 1000);
        
        // Run initial discovery
        await this.discoverDockerContainers();
    }

    private async discoverDockerContainers(): Promise<void> {
        if (!this.config) return;

        try {
            // Try to connect to other potential iPerf3 web containers
            // We'll scan common Docker network ranges and known container names
            const potentialHosts = [
                // Docker compose service names from docker-compose.yml
                'iperf-web-1',
                'iperf-web-2',
                'iperf-iperf-web-1-1',
                'iperf-iperf-web-2-1',
                // IP range scanning (common Docker network ranges)
                ...this.generateIPRange('172.18.0', 2, 10),
                ...this.generateIPRange('172.17.0', 2, 10),
            ];

            for (const hostname of potentialHosts) {
                // Skip our own hostname
                if (hostname === this.config.hostname || 
                    hostname.includes(this.config.hostname)) {
                    continue;
                }

                try {
                    const response = await fetch(`http://${hostname}:8080/api/status`, {
                        method: 'GET',
                        signal: AbortSignal.timeout(2000)
                    });

                    if (response.ok) {
                        const status = await response.json();
                        
                        // Create host entry for discovered container
                        const id = `discovered-${hostname}:${status.services?.iperf ? this.config.iperfPort : 5201}`;
                        const hostName = status.hostname || hostname;
                        const port = status.services?.iperf ? this.config.iperfPort : 5201;
                        
                        this.addOrUpdateHost(id, hostName, hostname, port, true);
                    }
                } catch (error) {
                    // Ignore connection errors - host not available
                }
            }
        } catch (error) {
            console.warn('Docker discovery error:', error);
        }
    }

    private generateIPRange(baseIP: string, start: number, end: number): string[] {
        const ips = [];
        for (let i = start; i <= end; i++) {
            ips.push(`${baseIP}.${i}`);
        }
        return ips;
    }
}

export default new DiscoveryService();