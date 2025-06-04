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

    async start(config: AppConfig): Promise<void> {
        this.config = config;
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
        const host: Host = {
            id,
            name,
            address,
            port,
            discovered: false,
            lastSeen: new Date()
        };

        this.hosts.set(id, host);
        
        if (broadcastFunction) {
            broadcastFunction({
                type: 'host_discovered',
                data: host
            });
        }

        return host;
    }

    removeHost(id: string): boolean {
        const removed = this.hosts.delete(id);
        if (removed && broadcastFunction) {
            broadcastFunction({
                type: 'host_lost',
                data: { id }
            });
        }
        return removed;
    }

    private handleServiceUp(service: any): void {
        const address = service.addresses?.[0] || service.host;
        const webPort = service.port;
        const iperfPort = parseInt(service.txt?.iperfPort || '5201');
        const hostname = service.txt?.hostname || service.name;

        const id = `discovered-${address}:${iperfPort}`;
        
        const host: Host = {
            id,
            name: hostname,
            address,
            port: iperfPort,
            discovered: true,
            lastSeen: new Date()
        };

        this.hosts.set(id, host);
        
        console.log(`Discovered iPerf3 service: ${hostname} at ${address}:${iperfPort}`);
        
        if (broadcastFunction) {
            broadcastFunction({
                type: 'host_discovered',
                data: host
            });
        }
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
}

export default new DiscoveryService();