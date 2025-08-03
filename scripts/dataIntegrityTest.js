/**
 * Data Integrity Test Suite
 * Tests the orphan detection and prevention system
 */
class DataIntegrityTest {
    constructor() {
        this.storageService = window.storageService;
        this.testResults = [];
    }
    
    /**
     * Run all data integrity tests
     */
    async runAllTests() {
        console.log('🧪 Starting Data Integrity Tests...');
        
        this.testResults = [];
        
        // Test 1: Basic orphan detection
        await this.testOrphanDetection();
        
        // Test 2: Machinery validation
        await this.testMachineryValidation();
        
        // Test 3: Task validation
        await this.testTaskValidation();
        
        // Test 4: Event validation
        await this.testEventValidation();
        
        // Test 5: Auto-cleanup functionality
        await this.testAutoCleanup();
        
        // Test 6: Strict filtering
        await this.testStrictFiltering();
        
        this.printTestResults();
    }
    
    /**
     * Test basic orphan detection
     */
    async testOrphanDetection() {
        console.log('Test 1: Testing orphan detection...');
        
        try {
            // Create some test data
            const originalMachines = this.storageService.getMachines();
            const originalTasks = this.storageService.getBacklogTasks();
            const originalEvents = this.storageService.getScheduledEvents();
            
            // Add an orphan machine to events
            const orphanEvent = {
                id: 'test-orphan-event',
                taskId: 'non-existent-task',
                machine: 'non-existent-machine',
                taskTitle: 'Test Orphan Task',
                startTime: '2025-01-01T08:00:00',
                endTime: '2025-01-01T10:00:00'
            };
            
            const events = [...originalEvents, orphanEvent];
            this.storageService.saveScheduledEvents(events);
            
            // Run orphan detection
            const results = this.storageService.detectAndReportOrphans();
            
            // Verify detection
            const testPassed = results.hasOrphans && 
                             results.orphanEvents && 
                             results.orphanEvents.length > 0;
            
            this.testResults.push({
                test: 'Orphan Detection',
                passed: testPassed,
                details: results
            });
            
            // Clean up
            this.storageService.saveScheduledEvents(originalEvents);
            
            console.log(`Test 1 ${testPassed ? 'PASSED' : 'FAILED'}`);
            
        } catch (error) {
            this.testResults.push({
                test: 'Orphan Detection',
                passed: false,
                error: error.message
            });
            console.log('Test 1 FAILED:', error);
        }
    }
    
    /**
     * Test machinery validation
     */
    async testMachineryValidation() {
        console.log('Test 2: Testing machinery validation...');
        
        try {
            const validation = this.storageService.validateMachineryIntegrity();
            
            const testPassed = typeof validation.isValid === 'boolean' &&
                             typeof validation === 'object';
            
            this.testResults.push({
                test: 'Machinery Validation',
                passed: testPassed,
                details: validation
            });
            
            console.log(`Test 2 ${testPassed ? 'PASSED' : 'FAILED'}`);
            
        } catch (error) {
            this.testResults.push({
                test: 'Machinery Validation',
                passed: false,
                error: error.message
            });
            console.log('Test 2 FAILED:', error);
        }
    }
    
    /**
     * Test task validation
     */
    async testTaskValidation() {
        console.log('Test 3: Testing task validation...');
        
        try {
            const validation = this.storageService.validateTaskIntegrity();
            
            const testPassed = typeof validation.isValid === 'boolean' &&
                             typeof validation === 'object';
            
            this.testResults.push({
                test: 'Task Validation',
                passed: testPassed,
                details: validation
            });
            
            console.log(`Test 3 ${testPassed ? 'PASSED' : 'FAILED'}`);
            
        } catch (error) {
            this.testResults.push({
                test: 'Task Validation',
                passed: false,
                error: error.message
            });
            console.log('Test 3 FAILED:', error);
        }
    }
    
    /**
     * Test event validation
     */
    async testEventValidation() {
        console.log('Test 4: Testing event validation...');
        
        try {
            const validation = this.storageService.validateDataIntegrity();
            
            const testPassed = typeof validation.isValid === 'boolean' &&
                             validation.machineryValidation &&
                             validation.taskValidation;
            
            this.testResults.push({
                test: 'Event Validation',
                passed: testPassed,
                details: validation
            });
            
            console.log(`Test 4 ${testPassed ? 'PASSED' : 'FAILED'}`);
            
        } catch (error) {
            this.testResults.push({
                test: 'Event Validation',
                passed: false,
                error: error.message
            });
            console.log('Test 4 FAILED:', error);
        }
    }
    
    /**
     * Test auto-cleanup functionality
     */
    async testAutoCleanup() {
        console.log('Test 5: Testing auto-cleanup...');
        
        try {
            // Create orphan data
            const originalEvents = this.storageService.getScheduledEvents();
            const orphanEvent = {
                id: 'test-cleanup-event',
                taskId: 'non-existent-task-cleanup',
                machine: 'non-existent-machine-cleanup',
                taskTitle: 'Test Cleanup Task',
                startTime: '2025-01-01T08:00:00',
                endTime: '2025-01-01T10:00:00'
            };
            
            const events = [...originalEvents, orphanEvent];
            this.storageService.saveScheduledEvents(events);
            
            // Run cleanup
            const results = this.storageService.autoCleanupOrphans();
            
            // Verify cleanup
            const testPassed = results && 
                             typeof results.orphanedEventsRemoved === 'number';
            
            this.testResults.push({
                test: 'Auto-Cleanup',
                passed: testPassed,
                details: results
            });
            
            // Restore original data
            this.storageService.saveScheduledEvents(originalEvents);
            
            console.log(`Test 5 ${testPassed ? 'PASSED' : 'FAILED'}`);
            
        } catch (error) {
            this.testResults.push({
                test: 'Auto-Cleanup',
                passed: false,
                error: error.message
            });
            console.log('Test 5 FAILED:', error);
        }
    }
    
    /**
     * Test strict filtering
     */
    async testStrictFiltering() {
        console.log('Test 6: Testing strict filtering...');
        
        try {
            const validMachines = this.storageService.getValidMachinesForDisplay();
            const validTasks = this.storageService.getValidTasksForDisplay();
            
            const testPassed = Array.isArray(validMachines) &&
                             Array.isArray(validTasks) &&
                             validMachines.every(machine => machine.name || machine.nominazione) &&
                             validTasks.every(task => task.id && task.name);
            
            this.testResults.push({
                test: 'Strict Filtering',
                passed: testPassed,
                details: {
                    validMachinesCount: validMachines.length,
                    validTasksCount: validTasks.length
                }
            });
            
            console.log(`Test 6 ${testPassed ? 'PASSED' : 'FAILED'}`);
            
        } catch (error) {
            this.testResults.push({
                test: 'Strict Filtering',
                passed: false,
                error: error.message
            });
            console.log('Test 6 FAILED:', error);
        }
    }
    
    /**
     * Print test results
     */
    printTestResults() {
        console.log('\n📊 Data Integrity Test Results:');
        console.log('================================');
        
        const passedTests = this.testResults.filter(result => result.passed);
        const failedTests = this.testResults.filter(result => !result.passed);
        
        console.log(`✅ Passed: ${passedTests.length}/${this.testResults.length}`);
        console.log(`❌ Failed: ${failedTests.length}/${this.testResults.length}`);
        
        if (failedTests.length > 0) {
            console.log('\n❌ Failed Tests:');
            failedTests.forEach(test => {
                console.log(`  - ${test.test}: ${test.error || 'Unknown error'}`);
            });
        }
        
        console.log('\n✅ Passed Tests:');
        passedTests.forEach(test => {
            console.log(`  - ${test.test}`);
        });
        
        const overallSuccess = failedTests.length === 0;
        console.log(`\n🎯 Overall Result: ${overallSuccess ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
        
        return overallSuccess;
    }
    
    /**
     * Create test data for manual testing
     */
    createTestOrphanData() {
        console.log('🧪 Creating test orphan data...');
        
        // Create orphan machine in events
        const events = this.storageService.getScheduledEvents();
        const orphanEvent = {
            id: 'manual-test-orphan',
            taskId: 'manual-test-task',
            machine: 'vvvvvv', // The orphan machine mentioned in the issue
            taskTitle: 'Manual Test Task',
            startTime: '2025-01-01T08:00:00',
            endTime: '2025-01-01T10:00:00'
        };
        
        this.storageService.saveScheduledEvents([...events, orphanEvent]);
        
        console.log('✅ Test orphan data created. Run integrity check to detect it.');
    }
    
    /**
     * Clean up test data
     */
    cleanupTestData() {
        console.log('🧹 Cleaning up test data...');
        
        const events = this.storageService.getScheduledEvents();
        const cleanEvents = events.filter(event => 
            !event.id.includes('test-') && 
            !event.id.includes('manual-test')
        );
        
        this.storageService.saveScheduledEvents(cleanEvents);
        
        console.log('✅ Test data cleaned up.');
    }
    
    /**
     * Test the fix for orphan machines
     */
    testOrphanMachineFix() {
        console.log('🧪 Testing orphan machine fix...');
        
        try {
            // Create an orphan machine event (like "vvvvvv")
            const events = this.storageService.getScheduledEvents();
            const orphanEvent = {
                id: 'test-orphan-machine-fix',
                taskId: 'test-task',
                machine: 'vvvvvv', // The orphan machine mentioned in the issue
                taskTitle: 'Test Task for Orphan Machine',
                startTime: '2025-01-01T08:00:00',
                endTime: '2025-01-01T10:00:00'
            };
            
            this.storageService.saveScheduledEvents([...events, orphanEvent]);
            
            // Run the cleanup
            const results = this.storageService.forceFullCleanup();
            
            // Check if the orphan event was removed
            const remainingEvents = this.storageService.getScheduledEvents();
            const orphanStillExists = remainingEvents.some(event => event.machine === 'vvvvvv');
            
            const testPassed = !orphanStillExists && results.totalCleaned > 0;
            
            console.log(`Test ${testPassed ? 'PASSED' : 'FAILED'}: Orphan machine cleanup`);
            console.log('Results:', results);
            
            return testPassed;
            
        } catch (error) {
            console.error('Test FAILED:', error);
            return false;
        }
    }
    
    /**
     * Test SSOT (Single Source of Truth) for machines
     */
    testSSOTForMachines() {
        console.log('🧪 Testing SSOT for machines...');
        
        try {
            // Get machines from different sources
            const allMachines = this.storageService.getMachines();
            const validMachines = this.storageService.getValidMachinesForDisplay();
            const ganttMachines = this.storageService.getValidGanttMachines();
            const printingMachines = this.storageService.getPrintingMachines();
            const packagingMachines = this.storageService.getPackagingMachines();
            const liveMachines = this.storageService.getLiveMachines();
            
            // Check if all sources return the same valid machines
            const allSourcesUseValidMachines = 
                ganttMachines.length === validMachines.filter(m => m.live).length &&
                printingMachines.length === validMachines.filter(m => m.type === 'printing').length &&
                packagingMachines.length === validMachines.filter(m => m.type === 'packaging').length &&
                liveMachines.length === validMachines.filter(m => m.live).length;
            
            // Check if "vvvvvv" machine is excluded from all sources
            const vvvvvvInValidMachines = validMachines.some(m => m.name === 'vvvvvv' || m.nominazione === 'vvvvvv');
            const vvvvvvInGanttMachines = ganttMachines.some(m => m.name === 'vvvvvv' || m.nominazione === 'vvvvvv');
            const vvvvvvInPrintingMachines = printingMachines.some(m => m.name === 'vvvvvv' || m.nominazione === 'vvvvvv');
            const vvvvvvInPackagingMachines = packagingMachines.some(m => m.name === 'vvvvvv' || m.nominazione === 'vvvvvv');
            
            const vvvvvvExcludedFromAll = !vvvvvvInValidMachines && !vvvvvvInGanttMachines && 
                                         !vvvvvvInPrintingMachines && !vvvvvvInPackagingMachines;
            
            const testPassed = allSourcesUseValidMachines && vvvvvvExcludedFromAll;
            
            console.log(`Test ${testPassed ? 'PASSED' : 'FAILED'}: SSOT for machines`);
            console.log('Results:', {
                allMachinesCount: allMachines.length,
                validMachinesCount: validMachines.length,
                ganttMachinesCount: ganttMachines.length,
                printingMachinesCount: printingMachines.length,
                packagingMachinesCount: packagingMachines.length,
                liveMachinesCount: liveMachines.length,
                vvvvvvExcludedFromAll,
                allSourcesUseValidMachines
            });
            
            return testPassed;
            
        } catch (error) {
            console.error('Test FAILED:', error);
            return false;
        }
    }
}

// Global test instance
window.dataIntegrityTest = new DataIntegrityTest();

// Test commands for console
console.log(`
🧪 Data Integrity Test Commands:
================================
- dataIntegrityTest.runAllTests()           // Run all tests
- dataIntegrityTest.createTestOrphanData()  // Create test orphan data
- dataIntegrityTest.cleanupTestData()       // Clean up test data
- dataIntegrityTest.testOrphanMachineFix()  // Test orphan machine fix
- dataIntegrityTest.testSSOTForMachines()   // Test SSOT for machines
- dataIntegrityTest.printTestResults()      // Print last test results
`);