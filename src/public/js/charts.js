/**
 * Charts and Visualizations for iPerf3 Web Application
 * Using vanilla JavaScript with SVG for lightweight charts
 */
class ChartManager {
    constructor() {
        this.colors = {
            primary: '#6366f1',
            success: '#10b981',
            warning: '#f59e0b',
            danger: '#ef4444',
            secondary: '#64748b'
        };
        this.gaugeAnimationId = null;
    }

    createSpeedGauge(canvas, maxSpeed = 1000) {
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 0.25 * Math.PI);
        ctx.lineWidth = 20;
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineCap = 'round';
        ctx.stroke();
        
        return {
            update: (speed, progress = 0) => {
                // Clear canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                // Background arc
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 0.25 * Math.PI);
                ctx.lineWidth = 20;
                ctx.strokeStyle = '#e2e8f0';
                ctx.lineCap = 'round';
                ctx.stroke();
                
                // Speed arc (prominent outer gauge - shows actual speed)
                if (speed > 0) {
                    const speedAngle = 0.75 * Math.PI + (Math.min(speed, maxSpeed) / maxSpeed) * 1.5 * Math.PI;
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, speedAngle);
                    ctx.lineWidth = 20;
                    ctx.strokeStyle = this.colors.primary;
                    ctx.lineCap = 'round';
                    ctx.stroke();
                }
                
                // Progress arc (smaller inner gauge - shows test progress)
                if (progress > 0) {
                    const progressAngle = 0.75 * Math.PI + (progress / 100) * 1.5 * Math.PI;
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, radius - 25, 0.75 * Math.PI, progressAngle);
                    ctx.lineWidth = 10;
                    ctx.strokeStyle = this.colors.success;
                    ctx.lineCap = 'round';
                    ctx.stroke();
                }
                
                // Tick marks
                this.drawGaugeTicks(ctx, centerX, centerY, radius, maxSpeed);
            }
        };
    }

    drawGaugeTicks(ctx, centerX, centerY, radius, maxSpeed) {
        const numTicks = 10;
        const tickRadius = radius + 10;
        const tickLength = 8;
        
        for (let i = 0; i <= numTicks; i++) {
            const angle = 0.75 * Math.PI + (i / numTicks) * 1.5 * Math.PI;
            const x1 = centerX + Math.cos(angle) * (tickRadius - tickLength);
            const y1 = centerY + Math.sin(angle) * (tickRadius - tickLength);
            const x2 = centerX + Math.cos(angle) * tickRadius;
            const y2 = centerY + Math.sin(angle) * tickRadius;
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#64748b';
            ctx.stroke();
            
            // Add labels for major ticks
            if (i % 2 === 0) {
                const labelRadius = tickRadius + 15;
                const labelX = centerX + Math.cos(angle) * labelRadius;
                const labelY = centerY + Math.sin(angle) * labelRadius;
                const labelValue = Math.round((i / numTicks) * maxSpeed);
                
                ctx.fillStyle = '#64748b';
                ctx.font = '12px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(labelValue.toString(), labelX, labelY);
            }
        }
    }


    createSpeedChart(container, downloadSpeed, uploadSpeed, maxSpeed = null) {
        if (!maxSpeed) {
            maxSpeed = Math.max(downloadSpeed, uploadSpeed) * 1.2;
        }

        const svg = this.createSVG(300, 200);
        const barWidth = 60;
        const barSpacing = 80;
        const chartHeight = 150;
        const startX = 60;

        // Download bar
        const downloadHeight = (downloadSpeed / maxSpeed) * chartHeight;
        const downloadBar = this.createRect(startX, 170 - downloadHeight, barWidth, downloadHeight, this.colors.primary);
        svg.appendChild(downloadBar);

        // Upload bar
        const uploadHeight = (uploadSpeed / maxSpeed) * chartHeight;
        const uploadBar = this.createRect(startX + barSpacing, 170 - uploadHeight, barWidth, uploadHeight, this.colors.success);
        svg.appendChild(uploadBar);

        // Labels
        const downloadLabel = this.createText(startX + barWidth/2, 190, 'Download', 'middle');
        const uploadLabel = this.createText(startX + barSpacing + barWidth/2, 190, 'Upload', 'middle');
        svg.appendChild(downloadLabel);
        svg.appendChild(uploadLabel);

        // Values
        const downloadValue = this.createText(startX + barWidth/2, 170 - downloadHeight - 5, `${downloadSpeed.toFixed(1)} Mbps`, 'middle');
        const uploadValue = this.createText(startX + barSpacing + barWidth/2, 170 - uploadHeight - 5, `${uploadSpeed.toFixed(1)} Mbps`, 'middle');
        svg.appendChild(downloadValue);
        svg.appendChild(uploadValue);

        container.appendChild(svg);
        return svg;
    }


    createTracerouteVisualization(container, hops) {
        const svg = this.createSVG(500, 300);
        const nodeRadius = 20;
        const nodeSpacing = 60;
        const startX = 50;
        const startY = 150;

        hops.forEach((hop, index) => {
            const x = startX + (index * nodeSpacing);
            const y = startY;

            // Draw connection line to next hop
            if (index < hops.length - 1) {
                const line = this.createLine(x + nodeRadius, y, x + nodeSpacing - nodeRadius, y, this.colors.secondary, 2);
                svg.appendChild(line);
            }

            // Draw hop node
            const circle = this.createCircle(x, y, nodeRadius, this.colors.primary);
            svg.appendChild(circle);

            // Hop number
            const hopNumber = this.createText(x, y + 4, hop.hop.toString(), 'middle');
            hopNumber.style.fill = 'white';
            hopNumber.style.fontWeight = 'bold';
            svg.appendChild(hopNumber);

            // IP address below
            const ipText = this.createText(x, y + nodeRadius + 15, hop.address, 'middle');
            ipText.style.fontSize = '10px';
            svg.appendChild(ipText);

            // Average time above
            const avgTime = hop.times.filter(t => t > 0).reduce((a, b) => a + b, 0) / hop.times.filter(t => t > 0).length;
            if (!isNaN(avgTime)) {
                const timeText = this.createText(x, y - nodeRadius - 10, `${avgTime.toFixed(1)}ms`, 'middle');
                timeText.style.fontSize = '10px';
                timeText.style.fill = this.colors.success;
                svg.appendChild(timeText);
            }
        });

        container.appendChild(svg);
        return svg;
    }


    // SVG Helper Methods
    createSVG(width, height) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.style.border = '1px solid #e2e8f0';
        svg.style.borderRadius = '8px';
        svg.style.backgroundColor = '#ffffff';
        return svg;
    }

    createRect(x, y, width, height, fill) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('fill', fill);
        rect.setAttribute('rx', '4');
        return rect;
    }

    createCircle(cx, cy, r, fill) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', r);
        circle.setAttribute('fill', fill);
        return circle;
    }

    createLine(x1, y1, x2, y2, stroke, strokeWidth) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('stroke', stroke);
        line.setAttribute('stroke-width', strokeWidth);
        return line;
    }

    createText(x, y, text, textAnchor = 'start') {
        const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('x', x);
        textElement.setAttribute('y', y);
        textElement.setAttribute('text-anchor', textAnchor);
        textElement.textContent = text;
        textElement.style.fontSize = '14px';
        textElement.style.fontFamily = 'Inter, sans-serif';
        textElement.style.fill = '#1e293b';
        return textElement;
    }

    clearContainer(container) {
        container.innerHTML = '';
    }
}

// Global charts instance
window.charts = new ChartManager();