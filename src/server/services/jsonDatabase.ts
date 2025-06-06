import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import type { TestResult, Host } from '../../types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface DatabaseData {
    testResults: TestResult[];
    hosts: Record<string, Host>;
}

class JsonDatabaseService {
    private dataDir: string;
    private dbPath: string;
    private data: DatabaseData = {
        testResults: [],
        hosts: {}
    };
    private initialized: boolean = false;
    private saveQueue: Promise<void> = Promise.resolve();

    constructor() {
        this.dataDir = path.join(__dirname, '../../../data');
        this.dbPath = path.join(this.dataDir, 'iperf-data.json');
    }

    async initialize(): Promise<void> {
        // Ensure data directory exists
        if (!existsSync(this.dataDir)) {
            console.log(`Creating data directory: ${this.dataDir}`);
            try {
                mkdirSync(this.dataDir, { recursive: true });
            } catch (err) {
                console.error(`Failed to create data directory: ${err}`);
                throw new Error(`Cannot create data directory ${this.dataDir}: ${err}`);
            }
        }

        // Test write permissions
        try {
            const testFile = path.join(this.dataDir, '.write_test');
            await fs.writeFile(testFile, 'test');
            await fs.unlink(testFile);
        } catch (err) {
            console.error(`Data directory is not writable: ${err}`);
            throw new Error(`Data directory ${this.dataDir} is not writable. Please check permissions.`);
        }

        // Load existing data if available
        try {
            if (existsSync(this.dbPath)) {
                const fileContent = await fs.readFile(this.dbPath, 'utf-8');
                this.data = JSON.parse(fileContent);
                console.log(`Loaded database from ${this.dbPath}`);
            } else {
                // Initialize with empty data
                await this.saveData();
                console.log(`Created new database at ${this.dbPath}`);
            }
        } catch (err) {
            console.error(`Error loading database: ${err}`);
            // Initialize with empty data if there was an error
            await this.saveData();
        }

        this.initialized = true;
        console.log('JSON database initialized');
    }

    private async saveData(): Promise<void> {
        // Queue save operations to prevent race conditions
        this.saveQueue = this.saveQueue.then(async () => {
            try {
                await fs.writeFile(this.dbPath, JSON.stringify(this.data, null, 2));
            } catch (err) {
                console.error(`Error saving database: ${err}`);
            }
        });
        return this.saveQueue;
    }

    async saveTestResult(testResult: TestResult): Promise<void> {
        if (!this.initialized) throw new Error('Database not initialized');

        // Add to in-memory data
        this.data.testResults.unshift(testResult);
        
        // Limit the number of test results to prevent the file from growing too large
        const maxResults = 1000; // Adjust as needed
        if (this.data.testResults.length > maxResults) {
            this.data.testResults = this.data.testResults.slice(0, maxResults);
        }

        // Save to disk
        await this.saveData();
    }

    async getTestResults(hostId?: string, limit: number = 100): Promise<TestResult[]> {
        if (!this.initialized) throw new Error('Database not initialized');

        let results = this.data.testResults;
        
        // Filter by hostId if provided
        if (hostId) {
            results = results.filter(result => result.hostId === hostId);
        }
        
        // Limit the number of results
        return results.slice(0, limit);
    }

    async deleteTestResult(id: string): Promise<boolean> {
        if (!this.initialized) throw new Error('Database not initialized');

        const initialLength = this.data.testResults.length;
        this.data.testResults = this.data.testResults.filter(result => result.id !== id);
        
        const deleted = initialLength > this.data.testResults.length;
        
        if (deleted) {
            await this.saveData();
        }
        
        return deleted;
    }

    async saveHost(host: Host): Promise<void> {
        if (!this.initialized) throw new Error('Database not initialized');

        // Add or update host
        this.data.hosts[host.id] = host;
        
        // Save to disk
        await this.saveData();
    }

    async getHosts(): Promise<Host[]> {
        if (!this.initialized) throw new Error('Database not initialized');
        
        return Object.values(this.data.hosts);
    }

    async cleanupOldResults(retentionDays: number): Promise<number> {
        if (!this.initialized) throw new Error('Database not initialized');

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        
        const initialLength = this.data.testResults.length;
        this.data.testResults = this.data.testResults.filter(result => {
            const timestamp = new Date(result.timestamp);
            return timestamp >= cutoffDate;
        });
        
        const deletedCount = initialLength - this.data.testResults.length;
        
        if (deletedCount > 0) {
            await this.saveData();
            console.log(`Cleaned up ${deletedCount} old test results`);
        }
        
        return deletedCount;
    }

    async close(): Promise<void> {
        // Ensure any pending writes are completed
        await this.saveQueue;
        console.log('Database closed');
    }
}

export default new JsonDatabaseService();