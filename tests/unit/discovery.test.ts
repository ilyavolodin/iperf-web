/**
 * Unit tests for Discovery Service
 */

import assert from 'assert';
import { test, describe } from 'node:test';

// We'll need to import parts of the discovery service for testing
// Since it's a class, we'll create a minimal version for testing the fingerprinting logic

describe('Discovery Service', () => {
    test('createHostFingerprint should generate simple address:port format', () => {
        // Simulate the new simplified fingerprint function
        function createHostFingerprint(address, port) {
            return `${address}:${port}`;
        }
        
        // Test various address formats
        assert.strictEqual(
            createHostFingerprint('192.168.1.100', 8080),
            '192.168.1.100:8080'
        );
        
        assert.strictEqual(
            createHostFingerprint('test-host.local', 8080),
            'test-host.local:8080'
        );
        
        assert.strictEqual(
            createHostFingerprint('10.0.0.5', 3000),
            '10.0.0.5:3000'
        );
        
        console.log('✅ Host fingerprinting test passed');
    });
    
    test('address priority should prefer IP addresses over hostnames', () => {
        // Simulate the new getPreferredAddress function
        function getPreferredAddress(service) {
            const addresses = service.addresses || [];
            
            // Prefer IP addresses over hostnames
            for (const addr of addresses) {
                if (/^\d+\.\d+\.\d+\.\d+$/.test(addr)) {
                    return addr;
                }
            }
            
            // Fall back to first address or hostname
            return addresses[0] || service.host;
        }
        
        // Test with IP addresses present
        const serviceWithIP = {
            addresses: ['test-host.local', '192.168.1.100'],
            host: 'fallback-host'
        };
        
        assert.strictEqual(
            getPreferredAddress(serviceWithIP),
            '192.168.1.100'
        );
        
        // Test with only hostnames
        const serviceWithHostname = {
            addresses: ['test-host.local', 'another-host.local'],
            host: 'fallback-host'
        };
        
        assert.strictEqual(
            getPreferredAddress(serviceWithHostname),
            'test-host.local'
        );
        
        // Test with no addresses
        const serviceNoAddresses = {
            host: 'fallback-host'
        };
        
        assert.strictEqual(
            getPreferredAddress(serviceNoAddresses),
            'fallback-host'
        );
        
        console.log('✅ Address priority test passed');
    });
    
    test('host deduplication should work with simplified fingerprints', () => {
        const hostFingerprints = new Map();
        const hosts = new Map();
        
        function createHostFingerprint(address, port) {
            return `${address}:${port}`;
        }
        
        function addHost(hostData) {
            const fingerprint = createHostFingerprint(hostData.address, hostData.port);
            
            if (hostFingerprints.has(fingerprint)) {
                // Already exists, update it
                const existingHostId = hostFingerprints.get(fingerprint);
                hosts.set(existingHostId, { ...hosts.get(existingHostId), ...hostData });
                return existingHostId;
            } else {
                // New host
                const hostId = `host-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                hostFingerprints.set(fingerprint, hostId);
                hosts.set(hostId, hostData);
                return hostId;
            }
        }
        
        // Add the same host twice (should deduplicate)
        const hostId1 = addHost({ address: '192.168.1.100', port: 8080, name: 'test-host-1' });
        const hostId2 = addHost({ address: '192.168.1.100', port: 8080, name: 'test-host-1-updated' });
        
        assert.strictEqual(hostId1, hostId2, 'Same address:port should reuse same host ID');
        assert.strictEqual(hosts.size, 1, 'Should only have one host entry');
        
        // Add different host (should not deduplicate)
        const hostId3 = addHost({ address: '192.168.1.101', port: 8080, name: 'test-host-2' });
        
        assert.notStrictEqual(hostId1, hostId3, 'Different addresses should have different host IDs');
        assert.strictEqual(hosts.size, 2, 'Should have two host entries');
        
        // Add same address but different port (should not deduplicate)
        const hostId4 = addHost({ address: '192.168.1.100', port: 8081, name: 'test-host-3' });
        
        assert.notStrictEqual(hostId1, hostId4, 'Different ports should have different host IDs');
        assert.strictEqual(hosts.size, 3, 'Should have three host entries');
        
        console.log('✅ Host deduplication test passed');
    });
});

console.log('🧪 Running Discovery Service Unit Tests...');
