export interface Host {
  id: string;
  name: string;
  address: string;
  port: number;
  discovered: boolean;
  lastSeen: Date;
}

export interface TestResult {
  id: string;
  hostId: string;
  hostname: string;
  testType: 'speed' | 'ping' | 'traceroute' | 'full';
  timestamp: Date;
  results: SpeedTestResult | PingTestResult | TracerouteTestResult | FullTestResult;
}

export interface SpeedTestResult {
  download: {
    bandwidth: number;
    bytes: number;
    duration: number;
  };
  upload: {
    bandwidth: number;
    bytes: number;
    duration: number;
  };
  jitter?: number;
  packetLoss?: number;
}

export interface PingTestResult {
  host: string;
  packetsTransmitted: number;
  packetsReceived: number;
  packetLoss: number;
  times: {
    min: number;
    avg: number;
    max: number;
    stddev: number;
  };
}

export interface TracerouteTestResult {
  host: string;
  hops: TracerouteHop[];
}

export interface TracerouteHop {
  hop: number;
  address: string;
  hostname?: string;
  times: number[];
}

export interface FullTestResult {
  ping: PingTestResult;
  speed: SpeedTestResult;
  traceroute: TracerouteTestResult;
}

export interface WebSocketMessage {
  type: 'test_progress' | 'test_complete' | 'host_discovered' | 'host_lost';
  data: any;
}

export interface AppConfig {
  hostname: string;
  iperfPort: number;
  webPort: number;
  discoveryInterval: number;
  historyRetention: number;
}

export interface ServiceStatus {
  web: boolean;
  iperf: boolean;
  discovery: boolean;
}