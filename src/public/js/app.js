/**
 * Main Application Controller for iPerf3 Web Application
 */
class App {
    constructor() {
        this.init();
    }

    async init() {
        console.log('iPerf3 Web Application starting...');
        
        // Set up WebSocket event handlers
        this.setupWebSocketHandlers();
        
        // Initial data load
        await this.loadInitialData();
        
        // Set up periodic updates
        this.setupPeriodicUpdates();
        
        console.log('iPerf3 Web Application initialized');
    }

    setupWebSocketHandlers() {
        // Connection status updates
        api.onWebSocketConnect(() => {
            ui.updateStatus(true);
            console.log('Connected to server');
        });

        api.onWebSocketDisconnect(() => {
            ui.updateStatus(false);
            console.log('Disconnected from server');
        });

        api.onWebSocketError((error) => {
            ui.updateStatus(false);
            console.error('WebSocket error:', error);
        });

        // Real-time message handling
        api.onWebSocketMessage((message) => {
            this.handleWebSocketMessage(message);
        });
    }

    handleWebSocketMessage(message) {
        console.log('WebSocket message received:', message);

        switch (message.type) {
            case 'test_progress':
                this.handleTestProgress(message.data);
                break;
                
            case 'test_complete':
                this.handleTestComplete(message.data);
                break;
                
            case 'host_discovered':
                this.handleHostDiscovered(message.data);
                break;
                
            case 'host_lost':
                this.handleHostLost(message.data);
                break;
                
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    handleTestProgress(data) {
        if (data.progress !== undefined && data.message) {
            ui.updateProgress(data.progress, data.message, data);
        }
    }

    handleTestComplete(data) {
        console.log('Test completed:', data);
        // The UI will handle this through the API response
        // This is just for logging and potential notifications
    }

    handleHostDiscovered(data) {
        console.log('Host discovered:', data);
        ui.refreshHosts();
    }

    handleHostLost(data) {
        console.log('Host lost:', data);
        ui.refreshHosts();
        
        // If the lost host was selected, deselect it
        if (ui.selectedHost && ui.selectedHost.id === data.id) {
            ui.selectedHost = null;
            ui.updateSelectedHostDisplay();
            ui.updateTestButtons();
        }
    }

    async loadInitialData() {
        try {
            // Check application status
            const status = await api.getStatus();
            console.log('Application status:', status);
            
            // Load hosts
            await ui.refreshHosts();
            
            // Load test history
            await ui.loadHistory();
            
            ui.updateStatus(true);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            ui.updateStatus(false);
            ui.showError('Failed to connect to server: ' + error.message);
        }
    }

    setupPeriodicUpdates() {
        // Refresh hosts every 30 seconds
        setInterval(async () => {
            try {
                if (api.ws && api.ws.readyState === WebSocket.OPEN) {
                    await ui.refreshHosts();
                }
            } catch (error) {
                console.error('Periodic host refresh failed:', error);
            }
        }, 30000);

        // Check application status every 10 seconds
        setInterval(async () => {
            try {
                const status = await api.getStatus();
                ui.updateStatus(true);
            } catch (error) {
                ui.updateStatus(false);
            }
        }, 10000);
    }

    // Enhanced result display with charts
    enhanceResultDisplay(result) {
        const modalBody = document.getElementById('modal-body');
        const existingCharts = modalBody.querySelector('.charts-container');
        
        if (existingCharts) {
            existingCharts.remove();
        }

        const chartsContainer = document.createElement('div');
        chartsContainer.className = 'charts-container';
        chartsContainer.style.marginTop = '20px';

        // Add charts based on test type
        switch (result.testType) {
            case 'speed':
                const speedChart = document.createElement('div');
                speedChart.className = 'chart-container';
                speedChart.innerHTML = '<h5>Speed Test Visualization</h5>';
                
                const downloadSpeed = result.results.download.bandwidth / 1000000;
                const uploadSpeed = result.results.upload.bandwidth / 1000000;
                charts.createSpeedChart(speedChart, downloadSpeed, uploadSpeed);
                
                chartsContainer.appendChild(speedChart);
                break;

            case 'ping':
                // For ping results, we could show a latency chart if we had individual ping times
                // This would require modifying the ping service to return individual times
                break;

            case 'traceroute':
                const traceChart = document.createElement('div');
                traceChart.className = 'chart-container';
                traceChart.innerHTML = '<h5>Route Visualization</h5>';
                
                charts.createTracerouteVisualization(traceChart, result.results.hops);
                chartsContainer.appendChild(traceChart);
                break;

            case 'full':
                const fullSpeedChart = document.createElement('div');
                fullSpeedChart.className = 'chart-container';
                fullSpeedChart.innerHTML = '<h5>Speed Test Results</h5>';
                
                const fullDownloadSpeed = result.results.speed.download.bandwidth / 1000000;
                const fullUploadSpeed = result.results.speed.upload.bandwidth / 1000000;
                charts.createSpeedChart(fullSpeedChart, fullDownloadSpeed, fullUploadSpeed);
                
                const fullTraceChart = document.createElement('div');
                fullTraceChart.className = 'chart-container';
                fullTraceChart.innerHTML = '<h5>Network Route</h5>';
                fullTraceChart.style.marginTop = '20px';
                
                charts.createTracerouteVisualization(fullTraceChart, result.results.traceroute.hops);
                
                chartsContainer.appendChild(fullSpeedChart);
                chartsContainer.appendChild(fullTraceChart);
                break;
        }

        if (chartsContainer.children.length > 0) {
            modalBody.appendChild(chartsContainer);
        }
    }

    // Performance monitoring
    startPerformanceMonitoring() {
        if ('performance' in window && 'PerformanceObserver' in window) {
            // Monitor long tasks
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > 50) {
                        console.warn('Long task detected:', entry.duration + 'ms');
                    }
                }
            });
            
            observer.observe({ entryTypes: ['longtask'] });
        }
    }

    // Keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + R: Refresh hosts
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                ui.refreshHosts();
            }
            
            // Ctrl/Cmd + Enter: Run speed test if host selected
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (ui.selectedHost && !ui.currentTest) {
                    ui.runTest('speed');
                }
            }
            
            // Escape: Close modal or cancel test
            if (e.key === 'Escape') {
                const modal = document.getElementById('result-modal');
                if (modal.classList.contains('show')) {
                    ui.hideModal();
                } else if (ui.currentTest) {
                    ui.cancelTest();
                }
            }
        });
    }

    // Error handling and recovery
    setupErrorHandling() {
        window.addEventListener('error', (e) => {
            console.error('Application error:', e.error);
        });

        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
        });
    }

    // Page visibility handling
    setupPageVisibilityHandling() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                // Page became visible, refresh data
                console.log('Page became visible, refreshing data');
                ui.refreshHosts();
                ui.loadHistory();
            }
        });
    }

    // Application lifecycle
    async start() {
        try {
            await this.init();
            this.setupKeyboardShortcuts();
            this.setupErrorHandling();
            this.setupPageVisibilityHandling();
            this.startPerformanceMonitoring();
            
            console.log('iPerf3 Web Application fully started');
        } catch (error) {
            console.error('Failed to start application:', error);
            ui.showError('Failed to start application: ' + error.message);
        }
    }
}

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for UI to be available
    const waitForUI = () => {
        if (window.ui) {
            window.app = new App();
            window.app.start();
            
            // Enhanced modal display with charts
            const originalShowModal = ui.showModal;
            ui.showModal = function(result) {
                originalShowModal.call(this, result);
                // Add charts after modal is shown
                setTimeout(() => {
                    app.enhanceResultDisplay(result);
                }, 100);
            };
        } else {
            setTimeout(waitForUI, 50);
        }
    };
    waitForUI();
});