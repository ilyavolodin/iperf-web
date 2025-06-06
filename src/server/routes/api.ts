import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import discoveryService from '../services/discovery.ts';
import iperfService from '../services/iperf.ts';
import networkService from '../services/network.ts';
import database from '../services/database.ts';
// Broadcast function will be injected to avoid circular imports
let broadcastFunction: ((message: any) => void) | null = null;
import type { TestResult, FullTestResult } from '../../types/index.ts';

const router = express.Router();

// Discovery endpoints
router.get('/discovery/hosts', async (_req, res) => {
    try {
        const hosts = discoveryService.getHosts();
        return res.json(hosts);
    } catch (error) {
        console.error('Error getting hosts:', error);
        return res.status(500).json({ error: 'Failed to get hosts' });
    }
});

router.post('/discovery/hosts', async (req, res) => {
    try {
        const { name, address, port } = req.body;
        
        if (!name || !address || !port) {
            return res.status(400).json({ error: 'Name, address, and port are required' });
        }

        if (isNaN(parseInt(port))) {
            return res.status(400).json({ error: 'Port must be a number' });
        }

        const host = discoveryService.addManualHost(name, address, parseInt(port));
        await database.saveHost(host);
        
        return res.json(host);
    } catch (error) {
        console.error('Error adding manual host:', error);
        return res.status(500).json({ error: 'Failed to add host' });
    }
});

router.delete('/discovery/hosts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const removed = discoveryService.removeHost(id);
        
        if (removed) {
            return res.json({ success: true });
        } else {
            return res.status(404).json({ error: 'Host not found' });
        }
    } catch (error) {
        console.error('Error removing host:', error);
        return res.status(500).json({ error: 'Failed to remove host' });
    }
});

// Testing endpoints
router.post('/test/speed', async (req, res) => {
    try {
        const { hostId, duration = 10, reverse = false } = req.body;
        
        if (!hostId) {
            return res.status(400).json({ error: 'Host ID is required' });
        }

        const hosts = discoveryService.getHosts();
        const host = hosts.find(h => h.id === hostId);
        
        if (!host) {
            return res.status(404).json({ error: 'Host not found' });
        }

        const result = await iperfService.runSpeedTest(host, duration, reverse);
        
        const testResult: TestResult = {
            id: uuidv4(),
            hostId: host.id,
            hostname: host.name,
            testType: 'speed',
            timestamp: new Date(),
            results: result
        };

        await database.saveTestResult(testResult);
        
        if (broadcastFunction) {
            broadcastFunction({
                type: 'test_complete',
                data: testResult
            });
        }

        return res.json(testResult);
    } catch (error) {
        console.error('Error running speed test:', error);
        return res.status(500).json({ error: error instanceof Error ? error.message : 'Speed test failed' });
    }
});

router.post('/test/ping', async (req, res) => {
    try {
        const { hostId, count = 4 } = req.body;
        
        if (!hostId) {
            return res.status(400).json({ error: 'Host ID is required' });
        }

        const hosts = discoveryService.getHosts();
        const host = hosts.find(h => h.id === hostId);
        
        if (!host) {
            return res.status(404).json({ error: 'Host not found' });
        }

        const result = await networkService.runPingTest(host, count);
        
        const testResult: TestResult = {
            id: uuidv4(),
            hostId: host.id,
            hostname: host.name,
            testType: 'ping',
            timestamp: new Date(),
            results: result
        };

        await database.saveTestResult(testResult);
        
        if (broadcastFunction) {
            broadcastFunction({
                type: 'test_complete',
                data: testResult
            });
        }

        return res.json(testResult);
    } catch (error) {
        console.error('Error running ping test:', error);
        return res.status(500).json({ error: error instanceof Error ? error.message : 'Ping test failed' });
    }
});

router.post('/test/traceroute', async (req, res) => {
    try {
        const { hostId, maxHops = 30 } = req.body;
        
        if (!hostId) {
            return res.status(400).json({ error: 'Host ID is required' });
        }

        const hosts = discoveryService.getHosts();
        const host = hosts.find(h => h.id === hostId);
        
        if (!host) {
            return res.status(404).json({ error: 'Host not found' });
        }

        const result = await networkService.runTracerouteTest(host, maxHops);
        
        const testResult: TestResult = {
            id: uuidv4(),
            hostId: host.id,
            hostname: host.name,
            testType: 'traceroute',
            timestamp: new Date(),
            results: result
        };

        await database.saveTestResult(testResult);
        
        if (broadcastFunction) {
            broadcastFunction({
                type: 'test_complete',
                data: testResult
            });
        }

        return res.json(testResult);
    } catch (error) {
        console.error('Error running traceroute test:', error);
        return res.status(500).json({ error: error instanceof Error ? error.message : 'Traceroute test failed' });
    }
});

router.post('/test/full', async (req, res) => {
    try {
        const { hostId, duration = 10, pingCount = 4, reverse = false, maxHops = 30 } = req.body;
        
        if (!hostId) {
            return res.status(400).json({ error: 'Host ID is required' });
        }

        const hosts = discoveryService.getHosts();
        const host = hosts.find(h => h.id === hostId);
        
        if (!host) {
            return res.status(404).json({ error: 'Host not found' });
        }

        if (broadcastFunction) {
            broadcastFunction({
                type: 'test_progress',
                data: {
                    message: 'Starting full network test suite',
                    progress: 0
                }
            });
        }

        // Run ping test
        const pingResult = await networkService.runPingTest(host, pingCount);
        
        if (broadcastFunction) {
            broadcastFunction({
                type: 'test_progress',
                data: {
                    message: 'Ping test complete, starting speed test',
                    progress: 25
                }
            });
        }

        // Run speed test
        const speedResult = await iperfService.runSpeedTest(host, duration, reverse);
        
        if (broadcastFunction) {
            broadcastFunction({
                type: 'test_progress',
                data: {
                    message: 'Speed test complete, starting traceroute',
                    progress: 75
                }
            });
        }

        // Run traceroute
        const tracerouteResult = await networkService.runTracerouteTest(host, maxHops);
        
        const fullResult: FullTestResult = {
            ping: pingResult,
            speed: speedResult,
            traceroute: tracerouteResult
        };

        const testResult: TestResult = {
            id: uuidv4(),
            hostId: host.id,
            hostname: host.name,
            testType: 'full',
            timestamp: new Date(),
            results: fullResult
        };

        await database.saveTestResult(testResult);
        
        if (broadcastFunction) {
            broadcastFunction({
                type: 'test_complete',
                data: testResult
            });
        }

        return res.json(testResult);
    } catch (error) {
        console.error('Error running full test:', error);
        return res.status(500).json({ error: error instanceof Error ? error.message : 'Full test failed' });
    }
});

// History endpoints
router.get('/history', async (req, res) => {
    try {
        const { hostId, limit = 100 } = req.query;
        const results = await database.getTestResults(
            hostId as string, 
            parseInt(limit as string)
        );
        return res.json(results);
    } catch (error) {
        console.error('Error getting test history:', error);
        return res.status(500).json({ error: 'Failed to get test history' });
    }
});

router.get('/history/:hostId', async (req, res) => {
    try {
        const { hostId } = req.params;
        const { limit = 50 } = req.query;
        
        const results = await database.getTestResults(hostId, parseInt(limit as string));
        return res.json(results);
    } catch (error) {
        console.error('Error getting host history:', error);
        return res.status(500).json({ error: 'Failed to get host history' });
    }
});

router.delete('/history/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await database.deleteTestResult(id);
        
        if (deleted) {
            return res.json({ success: true });
        } else {
            return res.status(404).json({ error: 'Test result not found' });
        }
    } catch (error) {
        console.error('Error deleting test result:', error);
        return res.status(500).json({ error: 'Failed to delete test result' });
    }
});

// Service status endpoints
router.get('/iperf/status', async (_req, res) => {
    try {
        const status = await iperfService.getIperfServerInfo();
        return res.json(status);
    } catch (error) {
        console.error('Error getting iPerf status:', error);
        return res.status(500).json({ error: 'Failed to get iPerf status' });
    }
});

router.post('/test/connectivity/:hostId', async (req, res) => {
    try {
        const { hostId } = req.params;
        
        const hosts = discoveryService.getHosts();
        const host = hosts.find(h => h.id === hostId);
        
        if (!host) {
            return res.status(404).json({ error: 'Host not found' });
        }

        const isConnectable = await iperfService.testConnectivity(host);
        return res.json({ connectable: isConnectable });
    } catch (error) {
        console.error('Error testing connectivity:', error);
        return res.status(500).json({ error: 'Failed to test connectivity' });
    }
});

// Function to set broadcast function
const setBroadcastFunction = (fn: (message: any) => void) => {
    broadcastFunction = fn;
};

export { setBroadcastFunction };
export default router;