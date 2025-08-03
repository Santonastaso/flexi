/**
 * Data Integrity Manager - Comprehensive orphan detection and management
 * Provides dashboard for monitoring data integrity and managing orphan data
 */
class DataIntegrityManager {
    constructor() {
        this.storageService = window.storageService;
        this.elements = {};
        this.integrityStatus = {
            lastCheck: null,
            issues: [],
            orphanCount: 0
        };
        this.init();
    }
    
    init() {
        this.bindElements();
        this.attachEventListeners();
        this.runInitialCheck();
        this.setupPeriodicChecks();
    }
    
    bindElements() {
        this.elements = {
            dashboard: document.getElementById('integrityDashboard'),
            statusIndicator: document.getElementById('integrityStatus'),
            issuesList: document.getElementById('integrityIssues'),
            orphanCount: document.getElementById('orphanCount'),
            lastCheckTime: document.getElementById('lastCheckTime'),
            checkNowBtn: document.getElementById('checkIntegrityNow'),
            autoCleanupBtn: document.getElementById('autoCleanupOrphans'),
            manualReviewBtn: document.getElementById('manualReviewOrphans'),
            exportReportBtn: document.getElementById('exportIntegrityReport')
        };
    }
    
    attachEventListeners() {
        if (this.elements.checkNowBtn) {
            this.elements.checkNowBtn.addEventListener('click', () => this.runManualCheck());
        }
        
        if (this.elements.autoCleanupBtn) {
            this.elements.autoCleanupBtn.addEventListener('click', () => this.autoCleanupOrphans());
        }
        
        if (this.elements.manualReviewBtn) {
            this.elements.manualReviewBtn.addEventListener('click', () => this.showManualReviewDialog());
        }
        
        if (this.elements.exportReportBtn) {
            this.elements.exportReportBtn.addEventListener('click', () => this.exportIntegrityReport());
        }
    }
    
    setupPeriodicChecks() {
        // Run integrity check every 10 minutes
        setInterval(() => {
            this.runBackgroundCheck();
        }, 10 * 60 * 1000);
        
        // Run check when window gains focus
        window.addEventListener('focus', () => {
            this.runBackgroundCheck();
        });
    }
    
    runInitialCheck() {
        this.runComprehensiveCheck();
        this.updateDashboard();
    }
    
    runBackgroundCheck() {
        const results = this.storageService.detectAndReportOrphans();
        if (results.hasOrphans) {
            this.integrityStatus.issues = results;
            this.integrityStatus.orphanCount = this.calculateOrphanCount(results);
            this.integrityStatus.lastCheck = new Date();
            this.updateDashboard();
            this.showBackgroundNotification(results);
        }
    }
    
    runManualCheck() {
        this.elements.checkNowBtn.disabled = true;
        this.elements.checkNowBtn.textContent = 'Checking...';
        
        setTimeout(() => {
            this.runComprehensiveCheck();
            this.updateDashboard();
            
            this.elements.checkNowBtn.disabled = false;
            this.elements.checkNowBtn.textContent = 'Check Now';
            
            this.showMessage('Integrity check completed', 'success');
        }, 1000);
    }
    
    runComprehensiveCheck() {
        const results = this.storageService.detectAndReportOrphans();
        const validationResults = this.storageService.validateDataIntegrity();
        
        this.integrityStatus.issues = results;
        this.integrityStatus.validationResults = validationResults;
        this.integrityStatus.orphanCount = this.calculateOrphanCount(results);
        this.integrityStatus.lastCheck = new Date();
        
        console.log('Comprehensive integrity check completed:', {
            orphanIssues: results,
            validationResults: validationResults
        });
    }
    
    calculateOrphanCount(results) {
        let count = 0;
        if (results.orphanEvents) count += results.orphanEvents.length;
        if (results.orphanMachines) count += results.orphanMachines.length;
        if (results.orphanTasks) count += results.orphanTasks.length;
        return count;
    }
    
    updateDashboard() {
        if (!this.elements.dashboard) return;
        
        // Update status indicator
        if (this.elements.statusIndicator) {
            const status = this.integrityStatus.orphanCount > 0 ? 'warning' : 'success';
            this.elements.statusIndicator.className = `status-indicator status-${status}`;
            this.elements.statusIndicator.textContent = this.integrityStatus.orphanCount > 0 ? '⚠️ Issues Detected' : '✅ All Good';
        }
        
        // Update orphan count
        if (this.elements.orphanCount) {
            this.elements.orphanCount.textContent = this.integrityStatus.orphanCount;
        }
        
        // Update last check time
        if (this.elements.lastCheckTime) {
            this.elements.lastCheckTime.textContent = this.integrityStatus.lastCheck ? 
                this.integrityStatus.lastCheck.toLocaleString() : 'Never';
        }
        
        // Update issues list
        this.updateIssuesList();
    }
    
    updateIssuesList() {
        if (!this.elements.issuesList) return;
        
        if (!this.integrityStatus.issues.hasOrphans) {
            this.elements.issuesList.innerHTML = `
                <div class="no-issues">
                    <p>✅ No data integrity issues detected</p>
                </div>
            `;
            return;
        }
        
        let issuesHtml = '<div class="issues-list">';
        
        // Orphan events
        if (this.integrityStatus.issues.orphanEvents && this.integrityStatus.issues.orphanEvents.length > 0) {
            issuesHtml += '<div class="issue-category"><h4>🚨 Orphaned Events</h4>';
            this.integrityStatus.issues.orphanEvents.forEach(event => {
                issuesHtml += `<div class="issue-item">
                    <span class="issue-type">${event.type}</span>
                    <span class="issue-details">${event.reason}</span>
                </div>`;
            });
            issuesHtml += '</div>';
        }
        
        // Orphan machines
        if (this.integrityStatus.issues.orphanMachines && this.integrityStatus.issues.orphanMachines.length > 0) {
            issuesHtml += '<div class="issue-category"><h4>🏭 Orphaned Machines</h4>';
            this.integrityStatus.issues.orphanMachines.forEach(machine => {
                issuesHtml += `<div class="issue-item">
                    <span class="issue-type">Machine</span>
                    <span class="issue-details">${machine.reason}</span>
                </div>`;
            });
            issuesHtml += '</div>';
        }
        
        // Recommendations
        if (this.integrityStatus.issues.recommendations && this.integrityStatus.issues.recommendations.length > 0) {
            issuesHtml += '<div class="issue-category"><h4>💡 Recommendations</h4>';
            this.integrityStatus.issues.recommendations.forEach(rec => {
                issuesHtml += `<div class="issue-item">
                    <span class="issue-type">Recommendation</span>
                    <span class="issue-details">${rec}</span>
                </div>`;
            });
            issuesHtml += '</div>';
        }
        
        issuesHtml += '</div>';
        this.elements.issuesList.innerHTML = issuesHtml;
    }
    
    autoCleanupOrphans() {
        if (!confirm('This will automatically remove all orphaned data. Are you sure?')) {
            return;
        }
        
        this.elements.autoCleanupBtn.disabled = true;
        this.elements.autoCleanupBtn.textContent = 'Cleaning...';
        
        setTimeout(() => {
            const results = this.storageService.autoCleanupOrphans();
            
            this.elements.autoCleanupBtn.disabled = false;
            this.elements.autoCleanupBtn.textContent = 'Auto-Cleanup';
            
            this.runComprehensiveCheck();
            this.updateDashboard();
            
            this.showMessage(`Cleanup completed: ${results.orphanedEventsRemoved} items removed`, 'success');
        }, 1000);
    }
    
    showManualReviewDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'manual-review-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <h3>Manual Orphan Review</h3>
                <div class="orphan-details">
                    ${this.generateOrphanDetails()}
                </div>
                <div class="dialog-actions">
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn btn-secondary">Close</button>
                    <button onclick="dataIntegrityManager.exportOrphanDetails()" class="btn btn-primary">Export Details</button>
                </div>
            </div>
        `;
        
        dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        document.body.appendChild(dialog);
    }
    
    generateOrphanDetails() {
        if (!this.integrityStatus.issues.hasOrphans) {
            return '<p>No orphaned data found.</p>';
        }
        
        let details = '<div class="orphan-sections">';
        
        if (this.integrityStatus.issues.orphanEvents) {
            details += '<div class="orphan-section"><h4>Orphaned Events</h4>';
            this.integrityStatus.issues.orphanEvents.forEach(event => {
                details += `<div class="orphan-item">
                    <strong>${event.type}:</strong> ${event.reason}
                </div>`;
            });
            details += '</div>';
        }
        
        if (this.integrityStatus.issues.orphanMachines) {
            details += '<div class="orphan-section"><h4>Orphaned Machines</h4>';
            this.integrityStatus.issues.orphanMachines.forEach(machine => {
                details += `<div class="orphan-item">
                    <strong>Machine:</strong> ${machine.reason}
                </div>`;
            });
            details += '</div>';
        }
        
        details += '</div>';
        return details;
    }
    
    exportOrphanDetails() {
        const data = {
            timestamp: new Date().toISOString(),
            integrityStatus: this.integrityStatus,
            recommendations: this.integrityStatus.issues.recommendations || []
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `integrity-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    exportIntegrityReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalOrphans: this.integrityStatus.orphanCount,
                lastCheck: this.integrityStatus.lastCheck,
                status: this.integrityStatus.orphanCount > 0 ? 'Issues Detected' : 'Clean'
            },
            details: this.integrityStatus.issues,
            validationResults: this.integrityStatus.validationResults,
            recommendations: this.integrityStatus.issues.recommendations || []
        };
        
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `data-integrity-report-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showMessage('Integrity report exported successfully', 'success');
    }
    
    showBackgroundNotification(results) {
        const notification = document.createElement('div');
        notification.className = 'background-integrity-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <h4>⚠️ Data Integrity Alert</h4>
                <p>${this.integrityStatus.orphanCount} orphaned items detected</p>
                <button onclick="this.parentElement.parentElement.remove()" class="btn btn-sm">Dismiss</button>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: white;
            border: 2px solid #f59e0b;
            border-radius: 8px;
            padding: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            max-width: 300px;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }
    
    showMessage(message, type = 'info') {
        if (this.storageService && this.storageService.showMessage) {
            this.storageService.showMessage(message, type);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// Initialize the data integrity manager when the page loads
const initializeDataIntegrityManager = () => {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.dataIntegrityManager = new DataIntegrityManager();
        });
    } else {
        window.dataIntegrityManager = new DataIntegrityManager();
    }
};

// Auto-initialize
initializeDataIntegrityManager();