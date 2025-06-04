import express from 'express';
import cors from 'cors';
import path from 'path';
import { WebSocketServer } from 'ws';
import http from 'http';
import os from 'os';
import { fileURLToPath } from 'url';

import apiRoutes from './routes/api.js';
import discoveryService from './services/discovery.js';
import database from './services/database.js';
import iperfService from './services/iperf.js';
import networkService from './services/network.js';
import type { WebSocketMessage, AppConfig } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const config: AppConfig = {
  hostname: process.env.HOSTNAME || os.hostname(),
  iperfPort: parseInt(process.env.IPERF_PORT || '5201'),
  webPort: parseInt(process.env.WEB_PORT || '8080'),
  discoveryInterval: parseInt(process.env.DISCOVERY_INTERVAL || '30'),
  historyRetention: parseInt(process.env.HISTORY_RETENTION || '30')
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api', apiRoutes);

// WebSocket for real-time updates
wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Broadcast function for real-time updates
export const broadcast = (message: WebSocketMessage) => {
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify(message));
        }
    });
};

// Health check endpoint
app.get('/api/status', (req, res) => {
    res.json({
        status: 'healthy',
        hostname: config.hostname,
        timestamp: new Date().toISOString(),
        services: {
            web: true,
            iperf: true,
            discovery: discoveryService.isRunning()
        }
    });
});

// Catch-all route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize services
async function initialize() {
    try {
        console.log('Initializing database...');
        await database.initialize();
        
        console.log('Starting discovery service...');
        await discoveryService.start(config);
        
        // Inject broadcast function into services to avoid circular imports
        discoveryService.setBroadcastFunction(broadcast);
        if (iperfService.setBroadcastFunction) {
            iperfService.setBroadcastFunction(broadcast);
        }
        if (networkService.setBroadcastFunction) {
            networkService.setBroadcastFunction(broadcast);
        }
        if ((apiRoutes as any).setBroadcastFunction) {
            (apiRoutes as any).setBroadcastFunction(broadcast);
        }
        
        console.log('All services initialized successfully');
    } catch (error) {
        console.error('Failed to initialize services:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    
    try {
        await discoveryService.stop();
        await database.close();
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    
    try {
        await discoveryService.stop();
        await database.close();
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

// Start server
server.listen(config.webPort, '0.0.0.0', async () => {
    console.log(`iPerf3 Web Server running on port ${config.webPort}`);
    console.log(`Hostname: ${config.hostname}`);
    console.log(`iPerf3 Port: ${config.iperfPort}`);
    await initialize();
});