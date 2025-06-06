import { Bonjour } from 'bonjour-service';
import type { Host, AppConfig } from '../../types/index.ts';
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
        
        // Try mDNS for cross-host discovery
        try {
            this.bonjour = new Bonjour();
            
            // Advertise our service with detailed information
            this.service = this.bonjour.publish({
                name: config.hostname,
                type: 'iperf3-web',
                port: config.webPort,
                protocol: 'tcp',
                txt: {
                    iperfPort: config.iperfPort.toString(),
                    version: '1.0.0',
                    hostname: config.hostname,
                    // Add timestamp to help with discovery debugging
                    advertised: new Date().toISOString()
                }
            });

            // Browse for other services with more detailed logging
            this.browser = this.bonjour.find({ 
                type: 'iperf3-web',
                protocol: 'tcp'
            }, (service: any) => {
                console.log(`mDNS service found: ${service.name} at ${service.addresses?.[0] || service.host}:${service.port}`);
                if (service.name !== config.hostname) {
                    this.handleServiceUp(service);
                }
            });

            // Handle service down events
            this.browser.on('down', (service: any) => {
                console.log(`mDNS service lost: ${service.name}`);
                this.handleServiceDown(service);
            });
            
            console.log(`mDNS discovery enabled - advertising as '${config.hostname}' on port ${config.webPort}`);
            console.log(`Listening for iPerf3 services on the network...`);

            // Add error handling for the service and browser
            this.service.on('error', (err: any) => {
                console.error('mDNS service advertisement error:', err);
            });

            this.browser.on('error', (err: any) => {
                console.error('mDNS browser error:', err);
            });

            // Log when our service is successfully advertised
            this.service.on('up', () => {
                console.log(`Successfully advertising mDNS service '${config.hostname}'`);
            });
        } catch (error) {
            console.warn('mDNS discovery failed to initialize:', error);
            console.warn('This may be due to:');
            console.warn('  - mDNS/Bonjour not available on this system');
            console.warn('  - Network firewall blocking mDNS traffic (UDP port 5353)');
            console.warn('  - Running in a restricted container environment');
            console.warn('  - Network interface binding issues');
            console.warn('You can still add hosts manually using the web interface.');
        }

        // Set up cleanup interval for stale hosts
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleHosts();
        }, config.discoveryInterval * 1000);

        this.running = true;
        console.log(`Discovery service started for ${config.hostname}`);
        
        // Run network diagnostics for debugging
        this.runNetworkDiagnostics();
    }

    private runNetworkDiagnostics(): void {
        console.log('=== Network Discovery Diagnostics ===');
        console.log(`Hostname: ${this.config?.hostname}`);
        console.log(`Web Port: ${this.config?.webPort}`);
        console.log(`iPerf Port: ${this.config?.iperfPort}`);
        
        // Check if we're in a Docker container
        try {
            const fs = require('fs');
            if (fs.existsSync('/.dockerenv')) {
                console.log('Running in Docker container');
                console.log('For cross-host mDNS discovery, ensure:');
                console.log('  - Container runs with --net=host OR');
                console.log('  - Docker daemon has mDNS forwarding enabled OR');
                console.log('  - Use manual host addition for cross-host discovery');
            } else {
                console.log('Running on bare metal/VM - mDNS should work across hosts');
            }
        } catch (e) {
            // Ignore error checking for Docker
        }
        
        // Log network interfaces (if available)
        try {
            const os = require('os');
            const interfaces = os.networkInterfaces();
            console.log('Available network interfaces:');
            Object.keys(interfaces).forEach(name => {
                const addrs = interfaces[name]?.filter((addr: any) => !addr.internal && addr.family === 'IPv4');
                if (addrs && addrs.length > 0) {
                    console.log(`  ${name}: ${addrs.map((addr: any) => addr.address).join(', ')}`);
                }
            });
        } catch (e) {
            console.log('Could not enumerate network interfaces');
        }
        
        console.log('====================================');
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
        // For cross-host discovery, we want to use the actual address as the fingerprint
        // This ensures hosts on different networks are treated as separate entities
        return `${address}:${port}`;
    }

    // Get preferred address type for a host (IP > hostname)
    private getAddressPriority(address: string): number {
        const ipRegex = /^\d+\.\d+\.\d+\.\d+$/;
        
        if (ipRegex.test(address)) {
            return 1; // Highest priority - IP address
        } else {
            return 2; // Lower priority - hostname
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
}

export default new DiscoveryService();