/**
 * UI Management for iPerf3 Web Application
 */
class UIManager {
    constructor() {
        this.selectedHost = null;
        this.currentTest = null;
        this.currentGaugeMax = 1000;
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        // Status elements
        this.statusDot = document.getElementById('status-dot');
        this.statusText = document.getElementById('status-text');

        // Host elements
        this.hostsList = document.getElementById('hosts-list');
        this.refreshHostsBtn = document.getElementById('refresh-hosts-btn');
        this.addHostForm = document.getElementById('add-host-form');
        this.addHostBtn = document.getElementById('add-host-btn');
        this.hostNameInput = document.getElementById('host-name');
        this.hostAddressInput = document.getElementById('host-address');
        this.hostPortInput = document.getElementById('host-port');

        // Selected host display elements
        this.selectedHostName = document.getElementById('selected-host-name');
        this.selectedHostAddress = document.getElementById('selected-host-address');

        // Test elements
        this.runTestBtn = document.getElementById('run-test-btn');
        this.testDurationInput = document.getElementById('test-duration');
        this.pingCountInput = document.getElementById('ping-count');
        this.reverseTestInput = document.getElementById('reverse-test');

        // Gauge elements
        this.gaugeSection = document.getElementById('gauge-section');
        this.progressGauge = document.getElementById('progress-gauge');
        this.resultsDisplay = document.getElementById('results-display');
        this.speedGaugeCanvas = document.getElementById('speed-gauge');
        this.gaugeValue = document.getElementById('gauge-value');
        this.gaugeUnit = document.getElementById('gauge-unit');
        this.gaugeLabel = document.getElementById('gauge-label');
        this.cancelTestBtn = document.getElementById('cancel-test-btn');

        // Direct Results elements
        this.welcomeMessage = document.getElementById('welcome-message');
        this.directResults = document.getElementById('direct-results');
        this.speedStatus = document.getElementById('speed-status');
        this.pingStatus = document.getElementById('ping-status');
        this.traceStatus = document.getElementById('trace-status');
        this.resultDownload = document.getElementById('result-download');
        this.resultUpload = document.getElementById('result-upload');
        this.resultLatency = document.getElementById('result-latency');
        this.resultPacketLoss = document.getElementById('result-packet-loss');
        this.resultHops = document.getElementById('result-hops');
        this.resultRouteTime = document.getElementById('result-route-time');

        // Metrics bar
        this.metricsBar = document.getElementById('metrics-bar');
        this.downloadSpeed = document.getElementById('download-speed');
        this.uploadSpeed = document.getElementById('upload-speed');
        this.latencyValue = document.getElementById('latency-value');
        this.jitterValue = document.getElementById('jitter-value');

        // History elements
        this.historyCompact = document.getElementById('history-compact');
        this.historyFilter = document.getElementById('history-filter');

        // Results elements (optional - may not exist in all layouts)
        this.clearResultsBtn = document.getElementById('clear-results-btn');

        // Modal elements
        this.modal = document.getElementById('result-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalBody = document.getElementById('modal-body');
        this.modalClose = document.getElementById('modal-close');
        this.modalExport = document.getElementById('modal-export');
        this.modalOk = document.getElementById('modal-ok');

        // Initialize gauge
        this.speedGauge = null;
        this.initializeGauge();
    }

    initializeGauge() {
        if (this.speedGaugeCanvas && typeof charts !== 'undefined') {
            // Start with 1000 Mbps, but allow dynamic scaling for higher speeds
            this.speedGauge = charts.createSpeedGauge(this.speedGaugeCanvas, 1000);
            this.currentGaugeMax = 1000;
        } else if (this.speedGaugeCanvas) {
            // Retry gauge initialization after a short delay if charts isn't available yet
            setTimeout(() => this.initializeGauge(), 100);
        }
    }

    bindEvents() {
        // Host events
        this.refreshHostsBtn.addEventListener('click', () => this.refreshHosts());
        this.addHostBtn.addEventListener('click', () => this.addManualHost());

        // Test events
        this.runTestBtn.addEventListener('click', () => this.runTest('full'));
        this.cancelTestBtn.addEventListener('click', () => this.cancelTest());

        // Results events (optional - may not exist in all layouts)
        if (this.clearResultsBtn) {
            this.clearResultsBtn.addEventListener('click', () => this.clearResults());
        }

        // History events
        this.historyFilter.addEventListener('change', () => this.loadHistory());

        // Modal events
        this.modalClose.addEventListener('click', () => this.hideModal());
        this.modalOk.addEventListener('click', () => this.hideModal());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hideModal();
        });

        // Form submission
        this.addHostForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addManualHost();
        });

        // Enter key for inputs
        [this.hostNameInput, this.hostAddressInput, this.hostPortInput].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addManualHost();
            });
        });
    }

    updateStatus(connected) {
        this.statusDot.className = `status-dot ${connected ? 'connected' : 'disconnected'}`;
        this.statusText.textContent = connected ? 'Connected' : 'Disconnected';
    }

    async refreshHosts() {
        try {
            this.setLoading(this.refreshHostsBtn, true);
            const hosts = await api.getHosts();
            this.renderHosts(hosts);
            this.updateHistoryFilter(hosts);
        } catch (error) {
            this.showError('Failed to refresh hosts: ' + error.message);
        } finally {
            this.setLoading(this.refreshHostsBtn, false);
        }
    }

    renderHosts(hosts) {
        this.hostsList.innerHTML = '';

        if (hosts.length === 0) {
            this.hostsList.innerHTML = `
                <div class="no-hosts" style="padding: 20px; text-align: center; color: var(--text-secondary);">
                    <p>No hosts available.<br>Add a manual host or wait for auto-discovery.</p>
                </div>
            `;
            return;
        }

        hosts.forEach(host => {
            const hostItem = this.createHostItem(host);
            this.hostsList.appendChild(hostItem);
        });
    }

    createHostItem(host) {
        const item = document.createElement('div');
        item.className = `host-item ${this.selectedHost?.id === host.id ? 'selected' : ''}`;
        item.dataset.hostId = host.id;

        item.innerHTML = `
            <div class="host-info">
                <div class="host-name">${this.escapeHtml(host.name)}</div>
                <div class="host-address">${this.escapeHtml(host.address)}:${host.port}</div>
            </div>
            <div class="host-actions">
                <div class="host-status-indicator" title="${host.discovered ? 'Auto-discovered' : 'Manual host'}"></div>
                ${!host.discovered ? '<button class="btn btn-danger btn-small remove-host-btn" title="Remove host">×</button>' : ''}
            </div>
        `;

        // Bind events
        item.addEventListener('click', (e) => {
            if (!e.target.matches('button')) {
                this.selectHost(host);
            }
        });

        const removeBtn = item.querySelector('.remove-host-btn');
        if (removeBtn) {
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeHost(host);
            });
        }

        return item;
    }

    selectHost(host) {
        this.selectedHost = host;
        this.updateSelectedHostDisplay();
        this.updateTestButtons();
        this.refreshHosts(); // Re-render to update selection
    }

    updateSelectedHostDisplay() {
        if (this.selectedHost) {
            this.selectedHostName.textContent = this.selectedHost.name;
            this.selectedHostAddress.textContent = `${this.selectedHost.address}:${this.selectedHost.port}`;
        } else {
            this.selectedHostName.textContent = 'No host selected';
            this.selectedHostAddress.textContent = '';
        }
    }

    updateTestButtons() {
        const enabled = this.selectedHost && !this.currentTest;
        this.runTestBtn.disabled = !enabled;
        
        // Update button text based on state
        if (this.currentTest) {
            this.runTestBtn.querySelector('.btn-text').textContent = 'Testing...';
            // Keep button hidden during test (set by showTestInProgress)
        } else if (!this.selectedHost) {
            this.runTestBtn.querySelector('.btn-text').textContent = 'Select Host First';
        } else {
            this.runTestBtn.querySelector('.btn-text').textContent = 'Run Network Test';
        }
    }

    async addManualHost() {
        const name = this.hostNameInput.value.trim();
        const address = this.hostAddressInput.value.trim();
        const port = parseInt(this.hostPortInput.value);

        if (!name || !address || !port) {
            this.showError('Please fill in all fields');
            return;
        }

        try {
            this.setLoading(this.addHostBtn, true);
            await api.addHost(name, address, port);
            
            // Clear form
            this.hostNameInput.value = '';
            this.hostAddressInput.value = '';
            this.hostPortInput.value = '5201';
            
            this.refreshHosts();
            this.showSuccess('Host added successfully');
        } catch (error) {
            this.showError('Failed to add host: ' + error.message);
        } finally {
            this.setLoading(this.addHostBtn, false);
        }
    }

    async removeHost(host) {
        if (!confirm(`Remove host "${host.name}"?`)) return;

        try {
            await api.removeHost(host.id);
            if (this.selectedHost?.id === host.id) {
                this.selectedHost = null;
                this.updateSelectedHostDisplay();
                this.updateTestButtons();
            }
            this.refreshHosts();
            this.showSuccess('Host removed successfully');
        } catch (error) {
            this.showError('Failed to remove host: ' + error.message);
        }
    }

    async testConnectivity(host) {
        try {
            const result = await api.testConnectivity(host.id);
            if (result.connectable) {
                this.showSuccess(`Connection to ${host.name} successful`);
            } else {
                this.showError(`Cannot connect to ${host.name}`);
            }
        } catch (error) {
            this.showError(`Connectivity test failed: ${error.message}`);
        }
    }

    async runTest(type) {
        if (!this.selectedHost) {
            this.showError('No host selected');
            return;
        }

        const duration = parseInt(this.testDurationInput.value);
        const pingCount = parseInt(this.pingCountInput.value);
        const reverse = this.reverseTestInput.checked;

        this.currentTest = type;
        this.showTestInProgress();
        this.updateTestButtons();

        try {
            let result;
            switch (type) {
                case 'speed':
                    result = await api.runSpeedTest(this.selectedHost.id, duration, reverse);
                    break;
                case 'ping':
                    result = await api.runPingTest(this.selectedHost.id, pingCount);
                    break;
                case 'traceroute':
                    result = await api.runTracerouteTest(this.selectedHost.id);
                    break;
                case 'full':
                    result = await api.runFullTest(this.selectedHost.id, duration, pingCount, reverse);
                    break;
            }

            this.showDirectResults(result);
            this.loadHistory();
        } catch (error) {
            this.hideTestInProgress();
            this.showError(`Test failed: ${error.message}`);
        } finally {
            this.currentTest = null;
            this.updateTestButtons();
        }
    }

    showTestInProgress() {
        // Hide welcome message and direct results (shows duplicate info with metrics bar)
        this.welcomeMessage.style.display = 'none';
        this.directResults.style.display = 'none';
        this.progressGauge.style.display = 'flex';
        this.cancelTestBtn.style.display = 'inline-flex';
        this.metricsBar.style.display = 'flex';

        // Hide test button for cleaner test UI
        this.runTestBtn.style.display = 'none';

        // Initialize gauge
        if (this.speedGauge) {
            this.speedGauge.update(0, 0);
        }

        // Reset all status indicators
        this.speedStatus.textContent = 'Running...';
        this.pingStatus.textContent = 'Pending';
        this.traceStatus.textContent = 'Pending';

        // Reset all result values
        this.resultDownload.textContent = '-- Mbps';
        this.resultUpload.textContent = '-- Mbps';
        this.resultLatency.textContent = '-- ms';
        this.resultPacketLoss.textContent = '-- %';
        this.resultHops.textContent = '--';
        this.resultRouteTime.textContent = '-- ms';

        // Initialize gauge for full test (starts with speed test)
        this.gaugeUnit.textContent = 'Mbps';
        this.gaugeLabel.textContent = 'Starting full network test...';
        this.gaugeValue.textContent = '0';
        
        // Reset metrics bar
        this.downloadSpeed.textContent = '0 Mbps';
        this.uploadSpeed.textContent = '0 Mbps';
        this.latencyValue.textContent = '-- ms';
        this.jitterValue.textContent = '-- ms';
    }

    hideTestInProgress() {
        this.progressGauge.style.display = 'none';
        this.cancelTestBtn.style.display = 'none';
        this.metricsBar.style.display = 'none';

        // Show test button again after test completion
        this.runTestBtn.style.display = 'inline-flex';
    }

    showDirectResults(result) {
        this.hideTestInProgress();
        
        // Keep direct results visible
        this.directResults.style.display = 'block';
        
        // Update status indicators
        this.speedStatus.textContent = 'Complete';
        this.pingStatus.textContent = 'Complete';
        this.traceStatus.textContent = 'Complete';

        // Update results based on test type
        if (result.testType === 'full') {
            // Speed results
            const downloadMbps = (result.results.speed.download.bandwidth / 1000000).toFixed(1);
            const uploadMbps = (result.results.speed.upload.bandwidth / 1000000).toFixed(1);
            this.resultDownload.textContent = `${downloadMbps} Mbps`;
            this.resultUpload.textContent = `${uploadMbps} Mbps`;

            // Ping results
            this.resultLatency.textContent = `${result.results.ping.times.avg.toFixed(1)} ms`;
            this.resultPacketLoss.textContent = `${result.results.ping.packetLoss}%`;

            // Traceroute results
            this.resultHops.textContent = result.results.traceroute.hops.length;
            const avgHopTime = result.results.traceroute.hops
                .flatMap(hop => hop.times.filter(t => t > 0))
                .reduce((a, b) => a + b, 0) / 
                result.results.traceroute.hops.flatMap(hop => hop.times.filter(t => t > 0)).length;
            this.resultRouteTime.textContent = `${avgHopTime.toFixed(1)} ms`;
        }
    }

    updateGaugeLabels(testType) {
        switch (testType) {
            case 'speed':
                this.gaugeUnit.textContent = 'Mbps';
                this.gaugeLabel.textContent = 'Initializing speed test...';
                break;
            case 'ping':
                this.gaugeUnit.textContent = 'ms';
                this.gaugeLabel.textContent = 'Running ping test...';
                break;
            case 'traceroute':
                this.gaugeUnit.textContent = 'hops';
                this.gaugeLabel.textContent = 'Tracing route...';
                break;
            case 'full':
                this.gaugeUnit.textContent = 'Mbps';
                this.gaugeLabel.textContent = 'Running full test suite...';
                break;
        }
        this.gaugeValue.textContent = '0';
    }

    // Helper method to dynamically scale gauge if needed
    scaleGaugeIfNeeded(speed) {
        if (!this.speedGauge) return;
        
        // If speed exceeds current max, scale up to next reasonable level
        if (speed > this.currentGaugeMax * 0.9) {
            let newMax = this.currentGaugeMax;
            
            if (speed > 10000) { // > 10 Gbps
                newMax = 20000;
            } else if (speed > 5000) { // > 5 Gbps  
                newMax = 10000;
            } else if (speed > 2000) { // > 2 Gbps
                newMax = 5000;
            } else if (speed > 1000) { // > 1 Gbps
                newMax = 2000;
            }
            
            if (newMax !== this.currentGaugeMax) {
                console.log(`Scaling gauge from ${this.currentGaugeMax} to ${newMax} Mbps for speed ${speed}`);
                this.currentGaugeMax = newMax;
                this.speedGauge = charts.createSpeedGauge(this.speedGaugeCanvas, newMax);
            }
        }
    }

    updateProgress(percent, message, data = {}) {
        // Update progress message
        this.gaugeLabel.textContent = message;

        // Handle different test phases and update gauge appropriately
        if (message.includes('ping') || message.includes('Ping')) {
            // Update gauge labels for ping test
            this.gaugeUnit.textContent = 'ms';
            this.speedStatus.textContent = 'Complete';
            this.pingStatus.textContent = 'Running...';
            
            // For ping tests, show current ping time in gauge
            if (this.speedGauge && data.currentPing) {
                const pingTime = data.currentPing.time;
                this.speedGauge.update(Math.min(pingTime, 100), percent); // Cap at 100ms for gauge display
                this.animateValue(this.gaugeValue, parseFloat(this.gaugeValue.textContent) || 0, pingTime, 300);
                
                // Update ping result card in real-time
                this.resultLatency.textContent = `${pingTime.toFixed(1)} ms`;
                
                // Update live metrics bar latency during ping test
                this.animateValue(this.latencyValue, 
                    parseFloat(this.latencyValue.textContent.replace(/[^\d.]/g, '')) || 0, 
                    pingTime, 300, ' ms');
                
                // Calculate running packet loss
                if (data.currentPing.completed && data.currentPing.total) {
                    const received = data.currentPing.completed;
                    const sent = data.currentPing.total;
                    const loss = ((sent - received) / sent * 100);
                    this.resultPacketLoss.textContent = `${loss.toFixed(1)}%`;
                }
                
                // Calculate jitter from ping variance if we have historical data
                if (data.pingTimes && data.pingTimes.length > 1) {
                    const times = data.pingTimes;
                    const avg = times.reduce((a, b) => a + b, 0) / times.length;
                    const variance = times.map(t => Math.pow(t - avg, 2)).reduce((a, b) => a + b, 0) / times.length;
                    const jitter = Math.sqrt(variance);
                    
                    this.animateValue(this.jitterValue, 
                        parseFloat(this.jitterValue.textContent.replace(/[^\d.]/g, '')) || 0, 
                        jitter, 300, ' ms');
                }
            }
        } else if (message.includes('traceroute')) {
            // Update gauge labels for traceroute
            this.gaugeUnit.textContent = 'hops';
            this.pingStatus.textContent = 'Complete';
            this.traceStatus.textContent = 'Running...';
        } else if (message.includes('Testing...') || message.includes('speed') || message.includes('Speed') || message.includes('download') || message.includes('upload') || data.testPhase) {
            // Update gauge labels for speed test
            this.gaugeUnit.textContent = 'Mbps';
            
            // This is a speed test progress update
            if (this.speedGauge && data.currentSpeed !== undefined) {
                const speed = data.currentSpeed;
                
                // Scale gauge if needed for high speeds
                this.scaleGaugeIfNeeded(speed);
                
                this.speedGauge.update(speed, percent);
                
                // Animate the gauge value with smooth counting
                this.animateValue(this.gaugeValue, parseFloat(this.gaugeValue.textContent) || 0, speed, 500);
                
                // Update speed result cards in real-time based on test phase
                if (data.testPhase === 'upload' || data.testPhase === 'Upload' || message.includes('upload') || message.includes('Upload') || message.includes('reverse upload')) {
                    // During upload test
                    this.animateValue(this.resultUpload, 
                        parseFloat(this.resultUpload.textContent.replace(/[^\d.]/g, '')) || 0, 
                        speed, 300, ' Mbps');
                    
                    // Update upload speed in metrics bar during upload phase
                    this.animateValue(this.uploadSpeed, 
                        parseFloat(this.uploadSpeed.textContent.replace(/[^\d.]/g, '')) || 0, 
                        speed, 300, ' Mbps');
                        
                } else if (data.testPhase === 'download' || data.testPhase === 'Download' || message.includes('download') || message.includes('Download') || message.includes('Testing...')) {
                    // During download test
                    this.animateValue(this.resultDownload, 
                        parseFloat(this.resultDownload.textContent.replace(/[^\d.]/g, '')) || 0, 
                        speed, 300, ' Mbps');
                    
                    // Update download speed in metrics bar during download phase only
                    this.animateValue(this.downloadSpeed, 
                        parseFloat(this.downloadSpeed.textContent.replace(/[^\d.]/g, '')) || 0, 
                        speed, 300, ' Mbps');
                }
            }
        }

        // Update interval data if available (for detailed metrics from iperf JSON)
        if (data.intervalData && data.intervalData.sum) {
            const sum = data.intervalData.sum;
            const speedMbps = sum.bits_per_second / 1000000;
            
            // Update speed in metrics bar based on test phase
            if (data.testPhase === 'upload' || data.testPhase === 'Upload') {
                this.animateValue(this.uploadSpeed, 
                    parseFloat(this.uploadSpeed.textContent.replace(/[^\d.]/g, '')) || 0, 
                    speedMbps, 200, ' Mbps');
            } else {
                this.animateValue(this.downloadSpeed, 
                    parseFloat(this.downloadSpeed.textContent.replace(/[^\d.]/g, '')) || 0, 
                    speedMbps, 200, ' Mbps');
            }
            
            if (sum.jitter_ms) {
                this.animateValue(this.jitterValue, 
                    parseFloat(this.jitterValue.textContent.replace(/[^\d.]/g, '')) || 0, 
                    sum.jitter_ms, 200, ' ms');
            }
            
            if (sum.lost_percent !== undefined) {
                this.latencyValue.textContent = `${sum.lost_percent.toFixed(1)}% loss`;
            }
        }
    }

    // Smooth value animation helper
    animateValue(element, start, end, duration, suffix = '') {
        const startTime = performance.now();
        const startValue = parseFloat(start) || 0;
        const endValue = parseFloat(end) || 0;
        const difference = endValue - startValue;

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth animation
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentValue = startValue + (difference * easedProgress);
            
            element.textContent = `${currentValue.toFixed(1)}${suffix}`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    cancelTest() {
        // In a real implementation, this would cancel the ongoing test
        this.currentTest = null;
        this.hideTestInProgress();
        this.updateTestButtons();
    }

    showResults(result) {
        // Show a brief summary in the main area after test completion
        this.resultsDisplay.innerHTML = this.createResultSummary(result);
        this.resultsDisplay.style.display = 'flex';
    }

    createResultSummary(result) {
        const timestamp = new Date(result.timestamp).toLocaleString();
        
        let summaryHtml = `
            <div class="result-summary">
                <div class="summary-header">
                    <h3>${result.testType.toUpperCase()} Test Complete</h3>
                    <p class="summary-timestamp">${timestamp}</p>
                </div>
                <div class="summary-metrics">
        `;

        // Add metrics based on test type
        const metrics = this.getResultMetrics(result);
        metrics.forEach(metric => {
            summaryHtml += `
                <div class="summary-metric">
                    <div class="summary-value">${metric.value}<span class="summary-unit">${metric.unit}</span></div>
                    <div class="summary-label">${metric.label}</div>
                </div>
            `;
        });

        summaryHtml += `
                </div>
                <div class="summary-actions">
                    <button class="btn btn-primary" onclick="ui.showModal(${JSON.stringify(result).replace(/"/g, '&quot;')})">
                        View Details
                    </button>
                    <button class="btn btn-secondary" onclick="ui.runTest('${result.testType}')">
                        Run Again
                    </button>
                </div>
            </div>
        `;

        return summaryHtml;
    }

    addResult(result) {
        const noResults = this.resultsContainer.querySelector('.no-results');
        if (noResults) {
            noResults.remove();
        }

        const resultCard = this.createResultCard(result);
        this.resultsContainer.insertBefore(resultCard, this.resultsContainer.firstChild);
    }

    createResultCard(result) {
        const card = document.createElement('div');
        card.className = 'result-card';
        
        const timestamp = new Date(result.timestamp).toLocaleString();
        const metrics = this.getResultMetrics(result);

        card.innerHTML = `
            <div class="result-header">
                <div class="result-title">${result.testType.toUpperCase()} Test - ${this.escapeHtml(result.hostname)}</div>
                <div class="result-timestamp">${timestamp}</div>
            </div>
            <div class="result-metrics">
                ${metrics.map(metric => `
                    <div class="metric">
                        <div class="metric-value">${metric.value}<span class="metric-unit">${metric.unit}</span></div>
                        <div class="metric-label">${metric.label}</div>
                    </div>
                `).join('')}
            </div>
        `;

        card.addEventListener('click', () => {
            this.showModal(result);
        });

        return card;
    }

    getResultMetrics(result) {
        const metrics = [];

        switch (result.testType) {
            case 'speed':
                const speedResult = result.results;
                metrics.push(
                    { 
                        value: (speedResult.download.bandwidth / 1000000).toFixed(1), 
                        unit: ' Mbps', 
                        label: 'Download' 
                    },
                    { 
                        value: (speedResult.upload.bandwidth / 1000000).toFixed(1), 
                        unit: ' Mbps', 
                        label: 'Upload' 
                    }
                );
                break;

            case 'ping':
                const pingResult = result.results;
                metrics.push(
                    { 
                        value: pingResult.times.avg.toFixed(1), 
                        unit: ' ms', 
                        label: 'Avg Latency' 
                    },
                    { 
                        value: pingResult.packetLoss, 
                        unit: '%', 
                        label: 'Packet Loss' 
                    }
                );
                break;

            case 'traceroute':
                const traceResult = result.results;
                metrics.push(
                    { 
                        value: traceResult.hops.length, 
                        unit: '', 
                        label: 'Hops' 
                    }
                );
                break;

            case 'full':
                const fullResult = result.results;
                metrics.push(
                    { 
                        value: (fullResult.speed.download.bandwidth / 1000000).toFixed(1), 
                        unit: ' Mbps', 
                        label: 'Download' 
                    },
                    { 
                        value: fullResult.ping.times.avg.toFixed(1), 
                        unit: ' ms', 
                        label: 'Latency' 
                    }
                );
                break;
        }

        return metrics;
    }

    showModal(result) {
        this.modalTitle.textContent = `${result.testType.toUpperCase()} Test Results - ${result.hostname}`;
        this.modalBody.innerHTML = this.createDetailedResults(result);
        this.modal.classList.add('show');
    }

    hideModal() {
        this.modal.classList.remove('show');
    }

    createDetailedResults(result) {
        const timestamp = new Date(result.timestamp).toLocaleString();
        
        let content = `
            <div class="result-details">
                <div class="detail-header">
                    <strong>Test Type:</strong> ${result.testType.toUpperCase()}<br>
                    <strong>Host:</strong> ${this.escapeHtml(result.hostname)}<br>
                    <strong>Timestamp:</strong> ${timestamp}
                </div>
                <div class="detail-content">
        `;

        switch (result.testType) {
            case 'speed':
                content += this.createSpeedTestDetails(result.results);
                break;
            case 'ping':
                content += this.createPingTestDetails(result.results);
                break;
            case 'traceroute':
                content += this.createTracerouteDetails(result.results);
                break;
            case 'full':
                content += this.createFullTestDetails(result.results);
                break;
        }

        content += '</div></div>';
        return content;
    }

    createSpeedTestDetails(results) {
        return `
            <h4>Speed Test Results</h4>
            <div class="speed-details">
                <div class="speed-metric">
                    <h5>Download</h5>
                    <p>Bandwidth: <strong>${(results.download.bandwidth / 1000000).toFixed(2)} Mbps</strong></p>
                    <p>Bytes: ${this.formatBytes(results.download.bytes)}</p>
                    <p>Duration: ${results.download.duration.toFixed(2)}s</p>
                </div>
                <div class="speed-metric">
                    <h5>Upload</h5>
                    <p>Bandwidth: <strong>${(results.upload.bandwidth / 1000000).toFixed(2)} Mbps</strong></p>
                    <p>Bytes: ${this.formatBytes(results.upload.bytes)}</p>
                    <p>Duration: ${results.upload.duration.toFixed(2)}s</p>
                </div>
                ${results.jitter ? `<p>Jitter: ${results.jitter.toFixed(2)} ms</p>` : ''}
                ${results.packetLoss ? `<p>Packet Loss: ${results.packetLoss.toFixed(2)}%</p>` : ''}
            </div>
        `;
    }

    createPingTestDetails(results) {
        return `
            <h4>Ping Test Results</h4>
            <div class="ping-details">
                <p>Host: <strong>${this.escapeHtml(results.host)}</strong></p>
                <p>Packets Transmitted: ${results.packetsTransmitted}</p>
                <p>Packets Received: ${results.packetsReceived}</p>
                <p>Packet Loss: <strong>${results.packetLoss}%</strong></p>
                <h5>Timing Statistics</h5>
                <p>Min: ${results.times.min.toFixed(2)} ms</p>
                <p>Avg: <strong>${results.times.avg.toFixed(2)} ms</strong></p>
                <p>Max: ${results.times.max.toFixed(2)} ms</p>
                <p>Std Dev: ${results.times.stddev.toFixed(2)} ms</p>
            </div>
        `;
    }

    createTracerouteDetails(results) {
        const hopsHtml = results.hops.map(hop => `
            <tr>
                <td>${hop.hop}</td>
                <td>${this.escapeHtml(hop.hostname || hop.address)}</td>
                <td>${this.escapeHtml(hop.address)}</td>
                <td>${hop.times.map(t => t === -1 ? '*' : `${t.toFixed(1)}ms`).join(', ')}</td>
            </tr>
        `).join('');

        return `
            <h4>Traceroute Results</h4>
            <div class="traceroute-details">
                <p>Destination: <strong>${this.escapeHtml(results.host)}</strong></p>
                <p>Total Hops: ${results.hops.length}</p>
                <table class="hops-table">
                    <thead>
                        <tr>
                            <th>Hop</th>
                            <th>Hostname</th>
                            <th>Address</th>
                            <th>Times</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${hopsHtml}
                    </tbody>
                </table>
            </div>
        `;
    }

    createFullTestDetails(results) {
        return `
            ${this.createPingTestDetails(results.ping)}
            <hr>
            ${this.createSpeedTestDetails(results.speed)}
            <hr>
            ${this.createTracerouteDetails(results.traceroute)}
        `;
    }

    clearResults() {
        this.resultsContainer.innerHTML = `
            <div class="no-results">
                <p>No test results yet. Run a test to see results here.</p>
            </div>
        `;
    }


    async loadHistory() {
        try {
            const hostId = this.historyFilter.value || null;
            const history = await api.getHistory(hostId, 50);
            this.renderHistory(history);
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }

    renderHistory(history) {
        this.historyCompact.innerHTML = '';

        if (history.length === 0) {
            this.historyCompact.innerHTML = '<p style="padding: 16px; text-align: center; color: var(--text-secondary); font-size: 12px;">No test history available.</p>';
            return;
        }

        // Show only the most recent 10 items in compact view
        const recentHistory = history.slice(0, 10);
        
        recentHistory.forEach(item => {
            const historyItem = this.createCompactHistoryItem(item);
            this.historyCompact.appendChild(historyItem);
        });
    }

    createCompactHistoryItem(item) {
        const div = document.createElement('div');
        div.className = 'history-item-compact';

        const timestamp = this.formatRelativeTime(new Date(item.timestamp));
        const metrics = this.getResultMetrics(item);
        const primaryMetric = metrics[0] || { value: '--', unit: '', label: 'N/A' };
        
        div.innerHTML = `
            <div class="history-meta">
                <span class="history-host">${this.escapeHtml(item.hostname)}</span>
                <span class="history-timestamp">${timestamp}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="history-type">${item.testType}</span>
                <span style="font-family: 'Courier New', monospace; font-weight: 600; color: var(--primary-color);">
                    ${primaryMetric.value}${primaryMetric.unit}
                </span>
            </div>
        `;

        div.addEventListener('click', () => {
            this.showModal(item);
        });

        return div;
    }

    updateHistoryFilter(hosts) {
        const currentValue = this.historyFilter.value;
        this.historyFilter.innerHTML = '<option value="">All Hosts</option>';
        
        hosts.forEach(host => {
            const option = document.createElement('option');
            option.value = host.id;
            option.textContent = host.name;
            this.historyFilter.appendChild(option);
        });

        this.historyFilter.value = currentValue;
    }

    setLoading(element, loading) {
        if (loading) {
            element.classList.add('loading');
            element.disabled = true;
        } else {
            element.classList.remove('loading');
            element.disabled = false;
        }
    }

    showError(message) {
        // Simple error notification - in a real app you'd want a proper notification system
        alert('Error: ' + message);
    }

    showSuccess(message) {
        // Simple success notification - in a real app you'd want a proper notification system
        console.log('Success: ' + message);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Global UI instance - created when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.ui = new UIManager();
});