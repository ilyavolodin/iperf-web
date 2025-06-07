import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import type { SpeedTestResult, Host } from '../../types/index.ts';
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
                // Use text output for real-time, then JSON for final result
                downloadResult = await this.runIperfTest({
                    host: host.address,
                    port: host.port,
                    duration,
                    reverse: true,
                    json: false // Use text for real-time updates
                });

                if (broadcastFunction) {
                    broadcastFunction({
                        type: 'test_progress',
                        data: {
                            message: `Reverse download test complete, starting reverse upload test`,
                            progress: 50,
                            testPhase: 'transition'
                        }
                    });
                }

                // Then upload (from this host to target)
                uploadResult = await this.runIperfTest({
                    host: host.address,
                    port: host.port,
                    duration,
                    reverse: false,
                    json: false // Use text for real-time updates
                });
            } else {
                // Normal direction: download test first (from target to this host)
                downloadResult = await this.runIperfTest({
                    host: host.address,
                    port: host.port,
                    duration,
                    json: false // Use text for real-time updates
                });

                if (broadcastFunction) {
                    broadcastFunction({
                        type: 'test_progress',
                        data: {
                            message: `Download test complete, starting upload test`,
                            progress: 50,
                            testPhase: 'transition'
                        }
                    });
                }

                // Then upload test (reverse direction: from this host to target)
                uploadResult = await this.runIperfTest({
                    host: host.address,
                    port: host.port,
                    duration,
                    reverse: true,
                    json: false // Use text for real-time updates
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
                    bandwidth: this.extractBandwidthFromTextOutput(downloadResult, false),
                    bytes: this.extractBytesFromTextOutput(downloadResult, false),
                    duration: duration
                },
                upload: {
                    bandwidth: this.extractBandwidthFromTextOutput(uploadResult, true),
                    bytes: this.extractBytesFromTextOutput(uploadResult, true),
                    duration: duration
                },
                jitter: 0, // Text output doesn't provide jitter easily
                packetLoss: 0 // Text output doesn't provide packet loss for TCP
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
                '-i', '1', // Report every 1 second for real-time feedback
                '--forceflush' // Force flushing output at every interval for real-time updates
            ];

            if (options.parallel) {
                args.push('-P', options.parallel.toString());
            }

            if (options.reverse) {
                args.push('-R');
            }

            // Only use JSON for final result, not for real-time parsing
            if (options.json) {
                args.push('-J');
            }

            console.log(`[iperf] Starting test with args: ${args.join(' ')}`);
            const child = spawn('iperf3', args);
            let stdout = '';
            let stderr = '';
            let intervalData: any[] = [];
            const duration = options.duration || 10;
            let currentSecond = 0;
            let partialLine = '';

            child.stdout.on('data', (data) => {
                const chunk = data.toString();
                stdout += chunk;

                // Handle partial lines by combining with previous partial data
                const allData = partialLine + chunk;
                const lines = allData.split('\n');
                
                // Save the last incomplete line (if any) for next chunk
                partialLine = lines.pop() || '';
                
                // Process complete lines for real-time progress
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine === '') continue;
                    
                    console.log(`[iperf] Processing line: ${trimmedLine}`);
                    
                    // Parse real-time interval lines (both JSON and text format)
                    if (options.json) {
                        // For JSON mode, look for complete JSON objects (only final result)
                        if (trimmedLine.includes('"start"') && trimmedLine.includes('"end"') && trimmedLine.includes('"intervals"')) {
                            try {
                                const result = JSON.parse(trimmedLine);
                                if (result.intervals) {
                                    // Process intervals for progress updates
                                    result.intervals.forEach((interval: any, index: number) => {
                                        if (interval.sum && interval.sum.bits_per_second) {
                                            const progress = Math.min(((index + 1) / duration) * 100, 95);
                                            const currentSpeed = interval.sum.bits_per_second / 1000000;
                                            
                                            console.log(`[iperf] Retroactive interval ${index + 1}: ${currentSpeed.toFixed(2)} Mbps`);
                                            
                                            if (broadcastFunction) {
                                                broadcastFunction({
                                                    type: 'test_progress',
                                                    data: {
                                                        message: `Testing... ${index + 1}/${duration}s`,
                                                        progress: progress,
                                                        currentSpeed: currentSpeed,
                                                        interval: index + 1,
                                                        intervalData: interval
                                                    }
                                                });
                                            }
                                        }
                                    });
                                }
                            } catch (e) {
                                console.log(`[iperf] Failed to parse final JSON result: ${e}`);
                            }
                        }
                    } else {
                        // Parse text format interval lines: "[  5]   0.00-1.00   sec  9.12 GBytes  78.3 Gbits/sec    0   2.25 MBytes"
                        const intervalMatch = trimmedLine.match(/\[\s*\d+\]\s+([\d.]+)-([\d.]+)\s+sec\s+([\d.]+)\s+[GM]Bytes\s+([\d.]+)\s+[GM]bits\/sec/);
                        if (intervalMatch) {
                            const startTime = parseFloat(intervalMatch[1]);
                            const endTime = parseFloat(intervalMatch[2]);
                            const speedValue = parseFloat(intervalMatch[4]);
                            
                            // Convert to Mbps (handle both Gbits and Mbits)
                            const speedMbps = trimmedLine.includes('Gbits/sec') ? speedValue * 1000 : speedValue;
                            
                            currentSecond = Math.floor(endTime);
                            const progress = Math.min((currentSecond / duration) * 100, 95);
                            
                            console.log(`[iperf] Real-time interval ${currentSecond}: ${speedMbps.toFixed(2)} Mbps`);
                            
                            // Send real-time progress update with better phase identification
                            if (broadcastFunction) {
                                const testPhase = options.reverse ? 'Upload' : 'Download';
                                broadcastFunction({
                                    type: 'test_progress',
                                    data: {
                                        message: `${testPhase} test: ${currentSecond}/${duration}s`,
                                        progress: progress,
                                        currentSpeed: speedMbps,
                                        interval: currentSecond,
                                        startTime,
                                        endTime,
                                        testPhase: testPhase.toLowerCase()
                                    }
                                });
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
                    // For text output, just return the raw stdout for parsing
                    console.log(`[iperf] Test completed, text output length: ${stdout.length}`);
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

    private extractBandwidthFromTextOutput(output: string, isSender: boolean): number {
        // Parse final summary line for bandwidth
        // Look for lines like: "[  5]   0.00-10.00  sec  99.6 GBytes  85.5 Gbits/sec                  receiver"
        // or: "[  5]   0.00-10.00  sec  99.6 GBytes  85.5 Gbits/sec    0            sender"
        const lines = output.split('\n');
        const targetType = isSender ? 'sender' : 'receiver';
        
        for (const line of lines) {
            if (line.includes(targetType) && line.includes('bits/sec')) {
                const match = line.match(/([\d.]+)\s+([GM])bits\/sec/);
                if (match) {
                    const value = parseFloat(match[1]);
                    const unit = match[2];
                    // Convert to bits per second
                    return unit === 'G' ? value * 1000000000 : value * 1000000;
                }
            }
        }
        
        // Fallback: try to find any final bandwidth line
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            if (line.includes('bits/sec') && !line.includes('Retr')) {
                const match = line.match(/([\d.]+)\s+([GM])bits\/sec/);
                if (match) {
                    const value = parseFloat(match[1]);
                    const unit = match[2];
                    return unit === 'G' ? value * 1000000000 : value * 1000000;
                }
            }
        }
        
        return 0;
    }

    private extractBytesFromTextOutput(output: string, isSender: boolean): number {
        // Parse final summary line for bytes transferred
        const lines = output.split('\n');
        const targetType = isSender ? 'sender' : 'receiver';
        
        for (const line of lines) {
            if (line.includes(targetType) && line.includes('Bytes')) {
                const match = line.match(/([\d.]+)\s+([GM])Bytes/);
                if (match) {
                    const value = parseFloat(match[1]);
                    const unit = match[2];
                    // Convert to bytes
                    return unit === 'G' ? value * 1000000000 : value * 1000000;
                }
            }
        }
        
        // Fallback: try to find any final bytes line
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            if (line.includes('Bytes') && line.includes('bits/sec')) {
                const match = line.match(/([\d.]+)\s+([GM])Bytes/);
                if (match) {
                    const value = parseFloat(match[1]);
                    const unit = match[2];
                    return unit === 'G' ? value * 1000000000 : value * 1000000;
                }
            }
        }
        
        return 0;
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
            await this.runIperfTest({
                host: host.address,
                port: host.port,
                duration: 1,
                json: false // Use text output for simplicity
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