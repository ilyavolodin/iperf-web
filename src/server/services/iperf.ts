import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import type { SpeedTestResult, Host } from '../../types/index.js';
// Broadcast function will be injected to avoid circular imports
let broadcastFunction: ((message: any) => void) | null = null;

const execAsync = promisify(exec);

interface IperfTestOptions {
    host: string;
    port: number;
    duration?: number;
    parallel?: number;
    reverse?: boolean;
    json?: boolean;
}

class IperfService {
    async runSpeedTest(host: Host, duration: number = 10, reverse: boolean = false): Promise<SpeedTestResult> {
        console.log(`Running speed test against ${host.name} (${host.address}:${host.port})`);
        
        if (broadcastFunction) {
            broadcastFunction({
                type: 'test_progress',
                data: {
                    message: `Starting speed test against ${host.name}`,
                    progress: 0
                }
            });
        }

        try {
            let downloadResult, uploadResult;
            
            if (reverse) {
                // For reverse test, we run upload first (from target to this host)
                downloadResult = await this.runIperfTest({
                    host: host.address,
                    port: host.port,
                    duration,
                    reverse: true,
                    json: true
                });

                if (broadcastFunction) {
                    broadcastFunction({
                        type: 'test_progress',
                        data: {
                            message: `Reverse download test complete, starting reverse upload test`,
                            progress: 50
                        }
                    });
                }

                // Then upload (from this host to target)
                uploadResult = await this.runIperfTest({
                    host: host.address,
                    port: host.port,
                    duration,
                    reverse: false,
                    json: true
                });
            } else {
                // Normal direction: download test first (from target to this host)
                downloadResult = await this.runIperfTest({
                    host: host.address,
                    port: host.port,
                    duration,
                    json: true
                });

                if (broadcastFunction) {
                    broadcastFunction({
                        type: 'test_progress',
                        data: {
                            message: `Download test complete, starting upload test`,
                            progress: 50
                        }
                    });
                }

                // Then upload test (reverse direction: from this host to target)
                uploadResult = await this.runIperfTest({
                    host: host.address,
                    port: host.port,
                    duration,
                    reverse: true,
                    json: true
                });
            }

            if (broadcastFunction) {
                broadcastFunction({
                    type: 'test_progress',
                    data: {
                        message: `Upload test complete`,
                        progress: 100
                    }
                });
            }

            const result: SpeedTestResult = {
                download: {
                    bandwidth: downloadResult.end.sum_received.bits_per_second,
                    bytes: downloadResult.end.sum_received.bytes,
                    duration: downloadResult.end.sum_received.seconds
                },
                upload: {
                    bandwidth: uploadResult.end.sum_sent.bits_per_second,
                    bytes: uploadResult.end.sum_sent.bytes,
                    duration: uploadResult.end.sum_sent.seconds
                },
                jitter: downloadResult.end.sum_received.jitter_ms,
                packetLoss: downloadResult.end.sum_received.lost_percent
            };

            console.log(`Speed test completed: Download ${(result.download.bandwidth / 1000000).toFixed(2)} Mbps, Upload ${(result.upload.bandwidth / 1000000).toFixed(2)} Mbps`);
            
            return result;
        } catch (error) {
            console.error('Speed test failed:', error);
            throw new Error(`Speed test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private async runIperfTest(options: IperfTestOptions): Promise<any> {
        return new Promise((resolve, reject) => {
            const args = [
                '-c', options.host,
                '-p', options.port.toString(),
                '-t', (options.duration || 10).toString(),
                '-i', '1' // Report every 1 second for real-time feedback
            ];

            if (options.parallel) {
                args.push('-P', options.parallel.toString());
            }

            if (options.reverse) {
                args.push('-R');
            }

            if (options.json) {
                args.push('-J');
            }

            const child = spawn('iperf3', args);
            let stdout = '';
            let stderr = '';
            let intervalData: any[] = [];
            const duration = options.duration || 10;
            let currentSecond = 0;

            child.stdout.on('data', (data) => {
                const chunk = data.toString();
                stdout += chunk;

                // Parse real-time JSON output for progress updates
                if (options.json) {
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (line.trim() && line.includes('"start"') && line.includes('"end"')) {
                            try {
                                const intervalResult = JSON.parse(line.trim());
                                if (intervalResult.start && intervalResult.end && intervalResult.sum) {
                                    currentSecond++;
                                    const progress = Math.min((currentSecond / duration) * 100, 95);
                                    const currentSpeed = intervalResult.sum.bits_per_second / 1000000; // Convert to Mbps
                                    
                                    intervalData.push(intervalResult);
                                    
                                    // Send real-time progress update
                                    if (broadcastFunction) {
                                        broadcastFunction({
                                            type: 'test_progress',
                                            data: {
                                                message: `Testing... ${currentSecond}/${duration}s`,
                                                progress: progress,
                                                currentSpeed: currentSpeed,
                                                interval: currentSecond,
                                                intervalData: intervalResult
                                            }
                                        });
                                    }
                                }
                            } catch (e) {
                                // Ignore JSON parse errors for partial data
                            }
                        }
                    }
                }
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`iperf3 exited with code ${code}: ${stderr}`));
                    return;
                }

                if (options.json) {
                    try {
                        const result = JSON.parse(stdout);
                        if (result.error) {
                            reject(new Error(result.error));
                        } else {
                            // Enhance result with interval data for better analysis
                            result.intervals = intervalData;
                            resolve(result);
                        }
                    } catch (error) {
                        reject(new Error(`Failed to parse iperf3 JSON output: ${error}`));
                    }
                } else {
                    resolve(stdout);
                }
            });

            child.on('error', (error) => {
                reject(new Error(`Failed to start iperf3: ${error.message}`));
            });

            // Kill the process if it takes too long
            const timeout = setTimeout(() => {
                child.kill('SIGTERM');
                reject(new Error('iPerf3 test timed out'));
            }, (options.duration || 10) * 1000 + 30000); // Add 30 seconds buffer

            child.on('close', () => {
                clearTimeout(timeout);
            });
        });
    }

    async checkIperfServerStatus(): Promise<boolean> {
        try {
            const { stdout } = await execAsync('pgrep -f "iperf3 -s"');
            return stdout.trim().length > 0;
        } catch (error) {
            return false;
        }
    }

    async getIperfServerInfo(): Promise<{ running: boolean; pid?: number; port?: number }> {
        try {
            const { stdout } = await execAsync('pgrep -f "iperf3 -s"');
            const pid = parseInt(stdout.trim());
            
            if (pid) {
                // Try to extract port from process arguments
                try {
                    const { stdout: cmdline } = await execAsync(`cat /proc/${pid}/cmdline | tr '\\0' ' '`);
                    const portMatch = cmdline.match(/-p\s+(\d+)/);
                    const port = portMatch ? parseInt(portMatch[1]) : 5201;
                    
                    return { running: true, pid, port };
                } catch {
                    return { running: true, pid };
                }
            }
            
            return { running: false };
        } catch (error) {
            return { running: false };
        }
    }

    async testConnectivity(host: Host): Promise<boolean> {
        try {
            console.log(`Testing connectivity to ${host.address}:${host.port}`);
            
            // Simple connectivity test - try to connect briefly
            const result = await this.runIperfTest({
                host: host.address,
                port: host.port,
                duration: 1,
                json: true
            });
            
            return true;
        } catch (error) {
            console.log(`Connectivity test failed for ${host.address}:${host.port}:`, error);
            return false;
        }
    }

    setBroadcastFunction(fn: (message: any) => void): void {
        broadcastFunction = fn;
    }
}

export default new IperfService();