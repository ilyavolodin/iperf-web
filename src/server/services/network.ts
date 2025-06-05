import { spawn } from 'child_process';
import type { PingTestResult, TracerouteTestResult, TracerouteHop, Host } from '../../types/index.js';
// Broadcast function will be injected to avoid circular imports
let broadcastFunction: ((message: any) => void) | null = null;

class NetworkService {
    async runPingTest(host: Host, count: number = 4): Promise<PingTestResult> {
        console.log(`Running ping test to ${host.address} (${count} packets)`);
        
        if (broadcastFunction) {
            broadcastFunction({
                type: 'test_progress',
                data: {
                    message: `Pinging ${host.name} (${count} packets)`,
                    progress: 0
                }
            });
        }

        return new Promise((resolve, reject) => {
            // Use simple ping command first, then add optimizations if needed
            const args = ['-c', count.toString(), host.address];
            
            console.log(`Spawning ping with args: ${args.join(' ')} on platform: ${process.platform}`); // Debug log
            const child = spawn('ping', args, { 
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env, LC_ALL: 'C' } // Ensure English output
            });
            
            let stdout = '';
            let stderr = '';
            let completedPings = 0;
            let pingResponses: Array<{seq: number, time: number}> = [];
            let allPingTimes: number[] = []; // Track all ping times for jitter calculation
            let partialLine = ''; // Handle partial lines

            console.log('Ping process spawned, setting up event handlers'); // Debug log

            child.stdout.on('data', (data) => {
                console.log('Ping process updated - stdout data received'); // Debug log
                const chunk = data.toString();
                stdout += chunk;
                
                console.log('Ping stdout chunk:', JSON.stringify(chunk)); // Debug log with JSON to see newlines
                console.log('Ping stdout chunk length:', chunk.length); // Debug log

                // Handle partial lines by combining with previous partial data
                const allData = partialLine + chunk;
                const lines = allData.split('\n');
                
                // Save the last incomplete line (if any) for next chunk
                partialLine = lines.pop() || '';
                
                console.log('Lines to process:', lines.length, 'partial line:', JSON.stringify(partialLine)); // Debug log
                
                for (const line of lines) {
                    console.log('Processing line:', JSON.stringify(line)); // Debug log with JSON
                    
                    if (line.trim() === '') continue; // Skip empty lines
                    
                    // Look for ping response lines: "64 bytes from host: icmp_seq=1 ttl=63 time=X.XXX ms"
                    const pingMatch = line.match(/\d+ bytes from .+: icmp_seq=(\d+) ttl=\d+ time=([\d.]+) ms/);
                    if (pingMatch) {
                        const seq = parseInt(pingMatch[1]);
                        const time = parseFloat(pingMatch[2]);
                        
                        completedPings++;
                        pingResponses.push({seq, time});
                        allPingTimes.push(time); // Track for jitter calculation
                        
                        const progress = (completedPings / count) * 100;
                        
                        console.log(`Ping match found: seq=${seq}, time=${time}ms, progress=${progress}%`); // Debug log
                        
                        // Send real-time progress update
                        if (broadcastFunction) {
                            broadcastFunction({
                                type: 'test_progress',
                                data: {
                                    message: `Ping ${completedPings}/${count}: ${time.toFixed(1)}ms`,
                                    progress: progress,
                                    currentPing: {
                                        sequence: seq,
                                        time: time,
                                        completed: completedPings,
                                        total: count
                                    },
                                    pingTimes: [...allPingTimes] // Include all ping times for jitter calculation
                                }
                            });
                        }
                        
                        console.log(`Ping ${seq}: ${time}ms (${completedPings}/${count})`);
                    }
                }
            });

            child.stderr.on('data', (data) => {
                console.log('Ping stderr data:', data.toString()); // Debug log
                stderr += data.toString();
            });

            child.on('spawn', () => {
                console.log('Ping process successfully spawned'); // Debug log
            });

            child.on('error', (error) => {
                console.log('Ping process error:', error); // Debug log
                reject(new Error(`Failed to start ping: ${error.message}`));
            });

            child.on('close', (_exitCode) => {
                console.log(`Ping process closed with exit code: ${_exitCode}`); // Debug log
                console.log('Final stdout:', JSON.stringify(stdout)); // Debug log
                console.log('Final stderr:', JSON.stringify(stderr)); // Debug log
                
                try {
                    if (_exitCode !== 0) {
                        reject(new Error(`Ping failed: ${stderr}`));
                        return;
                    }

                    const result = this.parsePingOutput(stdout, host.address);
                    console.log(`Ping test completed: ${result.packetLoss}% loss, avg ${result.times.avg}ms`);
                    
                    // Send final completion update
                    if (broadcastFunction) {
                        broadcastFunction({
                            type: 'test_progress',
                            data: {
                                message: `Ping complete: ${result.packetLoss}% loss, avg ${result.times.avg.toFixed(1)}ms`,
                                progress: 100,
                                completed: true,
                                result: result
                            }
                        });
                    }
                    
                    resolve(result);
                } catch (error) {
                    console.log('Error parsing ping output:', error); // Debug log
                    reject(error);
                }
            });
        });
    }

    async runTracerouteTest(host: Host, maxHops: number = 30): Promise<TracerouteTestResult> {
        console.log(`Running traceroute to ${host.address} (max ${maxHops} hops)`);
        
        if (broadcastFunction) {
            broadcastFunction({
                type: 'test_progress',
                data: {
                    message: `Tracing route to ${host.name}`,
                    progress: 0
                }
            });
        }

        return new Promise((resolve, reject) => {
            const args = ['-m', maxHops.toString(), '-n', host.address];
            const child = spawn('traceroute', args);
            
            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
                // Update progress based on output
                const lines = stdout.split('\n').length;
                const progress = Math.min(90, (lines / maxHops) * 100);
                
                if (broadcastFunction) {
                    broadcastFunction({
                        type: 'test_progress',
                        data: {
                            message: `Tracing route to ${host.name} (hop ${lines})`,
                            progress
                        }
                    });
                }
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (_exitCode) => {
                try {
                    // Traceroute may exit with non-zero code even on success
                    const result = this.parseTracerouteOutput(stdout, host.address);
                    console.log(`Traceroute completed: ${result.hops.length} hops`);
                    resolve(result);
                } catch (error) {
                    reject(new Error(`Traceroute failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
                }
            });

            child.on('error', (error) => {
                reject(new Error(`Failed to start traceroute: ${error.message}`));
            });

            // Timeout after 60 seconds
            setTimeout(() => {
                child.kill('SIGTERM');
                reject(new Error('Traceroute timed out'));
            }, 60000);
        });
    }

    private parsePingOutput(output: string, host: string): PingTestResult {
        const lines = output.split('\n');
        
        // Find statistics line
        const statsLine = lines.find(line => line.includes('packets transmitted'));
        if (!statsLine) {
            throw new Error('Could not parse ping statistics');
        }

        // Parse: "4 packets transmitted, 4 received, 0% packet loss, time 3003ms"
        const statsMatch = statsLine.match(/(\d+) packets transmitted, (\d+) received, (\d+)% packet loss/);
        if (!statsMatch) {
            throw new Error('Could not parse ping statistics line');
        }

        const transmitted = parseInt(statsMatch[1]);
        const received = parseInt(statsMatch[2]);
        const packetLoss = parseInt(statsMatch[3]);

        // Find timing line
        const timingLine = lines.find(line => line.includes('min/avg/max'));
        if (!timingLine) {
            throw new Error('Could not parse ping timing statistics');
        }

        // Parse: "rtt min/avg/max/mdev = 0.123/0.456/0.789/0.012 ms"
        const timingMatch = timingLine.match(/=\s*([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)\s*ms/);
        if (!timingMatch) {
            throw new Error('Could not parse ping timing line');
        }

        return {
            host,
            packetsTransmitted: transmitted,
            packetsReceived: received,
            packetLoss,
            times: {
                min: parseFloat(timingMatch[1]),
                avg: parseFloat(timingMatch[2]),
                max: parseFloat(timingMatch[3]),
                stddev: parseFloat(timingMatch[4])
            }
        };
    }

    private parseTracerouteOutput(output: string, host: string): TracerouteTestResult {
        const lines = output.split('\n').filter(line => line.trim());
        const hops: TracerouteHop[] = [];

        for (const line of lines) {
            // Skip the first line (header)
            if (line.includes('traceroute to')) continue;
            
            // Parse hop line: " 1  192.168.1.1 (192.168.1.1)  0.123 ms  0.234 ms  0.345 ms"
            const hopMatch = line.match(/^\s*(\d+)\s+(\S+)(?:\s+\(([^)]+)\))?\s+(.*)/);
            if (!hopMatch) continue;

            const hopNumber = parseInt(hopMatch[1]);
            const hostname = hopMatch[2];
            const address = hopMatch[3] || hopMatch[2];
            const timingsStr = hopMatch[4];

            // Parse timings
            const times: number[] = [];
            const timeMatches = timingsStr.match(/([\d.]+)\s*ms/g);
            
            if (timeMatches) {
                for (const timeMatch of timeMatches) {
                    const time = parseFloat(timeMatch.replace(/\s*ms/, ''));
                    if (!isNaN(time)) {
                        times.push(time);
                    }
                }
            }

            // Handle cases where hop shows * * *
            if (times.length === 0 && timingsStr.includes('*')) {
                times.push(-1); // Indicate timeout
            }

            const hop: TracerouteHop = {
                hop: hopNumber,
                address,
                times
            };

            if (hostname !== address) {
                hop.hostname = hostname;
            }

            hops.push(hop);
        }

        return {
            host,
            hops
        };
    }

    setBroadcastFunction(fn: (message: any) => void): void {
        broadcastFunction = fn;
    }
}

export default new NetworkService();