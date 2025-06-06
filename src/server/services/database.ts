import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import type { TestResult, Host } from '../../types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseService {
    private db: sqlite3.Database | null = null;
    private dbPath: string;

    constructor() {
        this.dbPath = path.join(__dirname, '../../../data/iperf.db');
    }

    async initialize(): Promise<void> {
        // Ensure data directory exists
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
            console.log(`Creating data directory: ${dataDir}`);
            try {
                fs.mkdirSync(dataDir, { recursive: true });
            } catch (err) {
                console.error(`Failed to create data directory: ${err}`);
                throw new Error(`Cannot create data directory ${dataDir}: ${err}`);
            }
        }

        // Test write permissions
        const testFile = path.join(dataDir, '.write_test');
        try {
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
        } catch (err) {
            console.error(`Data directory is not writable: ${err}`);
            throw new Error(`Data directory ${dataDir} is not writable. Please check permissions.`);
        }

        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    console.error(`Database path: ${this.dbPath}`);
                    console.error(`Data directory exists: ${fs.existsSync(dataDir)}`);
                    console.error(`Data directory permissions: ${fs.statSync(dataDir).mode.toString(8)}`);
                    reject(new Error(`Failed to open SQLite database at ${this.dbPath}: ${err.message}`));
                    return;
                }

                console.log('Connected to SQLite database');
                this.createTables()
                    .then(() => resolve())
                    .catch(reject);
            });
        });
    }

    private async createTables(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const createTestResultsTable = `
            CREATE TABLE IF NOT EXISTS test_results (
                id TEXT PRIMARY KEY,
                host_id TEXT NOT NULL,
                hostname TEXT NOT NULL,
                test_type TEXT NOT NULL,
                timestamp DATETIME NOT NULL,
                results TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        const createHostsTable = `
            CREATE TABLE IF NOT EXISTS hosts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                address TEXT NOT NULL,
                port INTEGER NOT NULL,
                discovered BOOLEAN NOT NULL,
                last_seen DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        return new Promise((resolve, reject) => {
            this.db!.serialize(() => {
                this.db!.run(createHostsTable, (err) => {
                    if (err) {
                        console.error('Error creating hosts table:', err);
                        reject(err);
                        return;
                    }
                });

                this.db!.run(createTestResultsTable, (err) => {
                    if (err) {
                        console.error('Error creating test_results table:', err);
                        reject(err);
                        return;
                    }
                    
                    console.log('Database tables created successfully');
                    resolve();
                });
            });
        });
    }

    async saveTestResult(testResult: TestResult): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const sql = `
            INSERT INTO test_results (id, host_id, hostname, test_type, timestamp, results)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        return new Promise((resolve, reject) => {
            this.db!.run(sql, [
                testResult.id,
                testResult.hostId,
                testResult.hostname,
                testResult.testType,
                testResult.timestamp.toISOString(),
                JSON.stringify(testResult.results)
            ], (err) => {
                if (err) {
                    console.error('Error saving test result:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async getTestResults(hostId?: string, limit: number = 100): Promise<TestResult[]> {
        if (!this.db) throw new Error('Database not initialized');

        let sql = `
            SELECT * FROM test_results
            ${hostId ? 'WHERE host_id = ?' : ''}
            ORDER BY timestamp DESC
            LIMIT ?
        `;

        const params = hostId ? [hostId, limit] : [limit];

        return new Promise((resolve, reject) => {
            this.db!.all(sql, params, (err, rows: any[]) => {
                if (err) {
                    console.error('Error fetching test results:', err);
                    reject(err);
                    return;
                }

                const testResults: TestResult[] = rows.map(row => ({
                    id: row.id,
                    hostId: row.host_id,
                    hostname: row.hostname,
                    testType: row.test_type,
                    timestamp: new Date(row.timestamp),
                    results: JSON.parse(row.results)
                }));

                resolve(testResults);
            });
        });
    }

    async deleteTestResult(id: string): Promise<boolean> {
        if (!this.db) throw new Error('Database not initialized');

        const sql = 'DELETE FROM test_results WHERE id = ?';

        return new Promise((resolve, reject) => {
            this.db!.run(sql, [id], function(err) {
                if (err) {
                    console.error('Error deleting test result:', err);
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    async saveHost(host: Host): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const sql = `
            INSERT OR REPLACE INTO hosts (id, name, address, port, discovered, last_seen)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        return new Promise((resolve, reject) => {
            this.db!.run(sql, [
                host.id,
                host.name,
                host.address,
                host.port,
                host.discovered,
                host.lastSeen.toISOString()
            ], (err) => {
                if (err) {
                    console.error('Error saving host:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    async getHosts(): Promise<Host[]> {
        if (!this.db) throw new Error('Database not initialized');

        const sql = 'SELECT * FROM hosts ORDER BY last_seen DESC';

        return new Promise((resolve, reject) => {
            this.db!.all(sql, [], (err, rows: any[]) => {
                if (err) {
                    console.error('Error fetching hosts:', err);
                    reject(err);
                    return;
                }

                const hosts: Host[] = rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    address: row.address,
                    port: row.port,
                    discovered: Boolean(row.discovered),
                    lastSeen: new Date(row.last_seen)
                }));

                resolve(hosts);
            });
        });
    }

    async cleanupOldResults(retentionDays: number): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const sql = 'DELETE FROM test_results WHERE timestamp < ?';

        return new Promise((resolve, reject) => {
            this.db!.run(sql, [cutoffDate.toISOString()], function(err) {
                if (err) {
                    console.error('Error cleaning up old results:', err);
                    reject(err);
                } else {
                    console.log(`Cleaned up ${this.changes} old test results`);
                    resolve(this.changes);
                }
            });
        });
    }

    async close(): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            this.db!.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                    reject(err);
                } else {
                    console.log('Database connection closed');
                    this.db = null;
                    resolve();
                }
            });
        });
    }
}

export default new DatabaseService();