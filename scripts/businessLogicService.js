/**
 * Business Logic Service - Centralized business logic for all entities
 * Handles calculations, determinations, and business rules
 */
class BusinessLogicService {
    constructor() {
        this.DEBUG = (typeof window !== 'undefined' && window.DEBUG === true);
    }

    // ===== MACHINERY BUSINESS LOGIC =====
    
    /**
     * Generate machine ID based on type and work center
     */
    generateMachineId(machineType, workCenter) {
        const prefix = this.getMachineTypePrefix(machineType);
        const workCenterCode = workCenter === 'BUSTO_GAROLFO' ? 'BGF' : 'ZAN';
        
        // This would typically query existing machines to find next number
        // For now, return a timestamp-based ID
        const timestamp = Date.now().toString(36);
        return `${prefix}_${workCenterCode}_${timestamp}`;
    }
    
    /**
     * Get machine type prefix for ID generation
     */
    getMachineTypePrefix(machineType) {
        const prefixes = {
            'DIGITAL_PRINT': 'DIGI',
            'FLEXO_PRINT': 'FLEX',
            'ROTOGRAVURE': 'ROTO',
            'DOYPACK': 'DOYP',
            'PLURI_PIU': 'PLUR',
            'MONO_PIU': 'MONO'
        };
        return prefixes[machineType] || 'MACH';
    }
    
    /**
     * Get valid machine types for a department
     */
    getValidMachineTypes(department) {
        const validTypes = {
            'STAMPA': ['DIGITAL_PRINT', 'FLEXO_PRINT', 'ROTOGRAVURE'],
            'CONFEZIONAMENTO': ['DOYPACK', 'PLURI_PIU', 'MONO_PIU']
        };
        return validTypes[department] || [];
    }
    
    /**
     * Get valid work centers
     */
    getValidWorkCenters() {
        return ['ZANICA', 'BUSTO_GAROLFO'];
    }

    /**
     * Get machine display name (with fallback to legacy fields)
     */
    getMachineDisplayName(machine) {
        if (!machine) return 'Unknown Machine';
        
        // Use current field first
        if (machine.machine_name) {
            return machine.machine_name;
        }
        
        // Fallback to legacy fields
        if (machine.nominazione) {
            return machine.nominazione;
        }
        
        if (machine.name) {
            return machine.name;
        }
        
        return 'Unknown Machine';
    }

    /**
     * Check if machine is active
     */
    isActiveMachine(machine) {
        if (!machine) return false;
        
        // Use current status field
        if (machine.status) {
            return String(machine.status).toUpperCase() === 'ACTIVE';
        }
        
        // Legacy: any named machine is considered active
        return !!(machine.machine_name || machine.nominazione || machine.name);
    }

    // ===== ODP BUSINESS LOGIC =====
    
    /**
     * Auto-determine work center based on article code
     */
    autoDetermineWorkCenter(articleCode) {
        if (!articleCode) return 'ZANICA';
        
        // Article codes starting with P05 or ISP05 go to BUSTO GAROLFO
        if (articleCode.startsWith('P05') || articleCode.startsWith('ISP05')) {
            return 'BUSTO_GAROLFO';
        }
        
        // All other article codes go to ZANICA
        return 'ZANICA';
    }
    
    /**
     * Auto-determine department based on article code
     */
    autoDetermineDepartment(articleCode) {
        if (!articleCode) return 'STAMPA';
        
        // Article codes starting with P0 go to CONFEZIONAMENTO
        if (articleCode.startsWith('P0')) {
            return 'CONFEZIONAMENTO';
        }
        
        // All other article codes go to STAMPA
        return 'STAMPA';
    }
    
    /**
     * Generate ODP number (next in sequence)
     */
    generateODPNumber(existingODPNumbers = []) {
        const existingNumbers = existingODPNumbers
            .map(num => num && num.startsWith('OP') ? parseInt(num.substring(2)) : 0)
            .filter(num => !isNaN(num));
        
        const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
        return `OP${nextNumber.toString().padStart(6, '0')}`;
    }
    
    /**
     * Auto-set internal customer code from article code
     */
    autoSetInternalCustomerCode(articleCode) {
        return articleCode || '';
    }
    
    /**
     * Calculate production duration based on phase and quantity
     */
    calculateProductionDuration(phase, quantity, bagWidth, bagHeight) {
        if (!phase || !quantity) return 0;
        
        let speed = 0;
        let setupTime = 0;
        
        if (phase.department === 'STAMPA') {
            speed = phase.V_STAMPA || 0; // mt/h
            setupTime = phase.T_SETUP_STAMPA || 0;
            
            // For printing, calculate based on bag width and quantity
            if (speed > 0 && bagWidth > 0) {
                const metersPerBag = bagWidth / 1000; // Convert mm to meters
                const bagsPerHour = speed / metersPerBag;
                const productionTime = quantity / bagsPerHour;
                return setupTime + productionTime;
            }
        } else if (phase.department === 'CONFEZIONAMENTO') {
            speed = phase.V_CONF || 0; // pz/h
            setupTime = phase.T_SETUP_CONF || 0;
            
            // For packaging, calculate based on quantity and speed
            if (speed > 0) {
                const productionTime = quantity / speed;
                return setupTime + productionTime;
            }
        }
        
        return setupTime;
    }
    
    /**
     * Calculate production cost based on phase and duration
     */
    calculateProductionCost(phase, duration) {
        if (!phase || !duration) return 0;
        
        let hourlyCost = 0;
        
        if (phase.department === 'STAMPA') {
            hourlyCost = phase.COSTO_H_STAMPA || 0;
        } else if (phase.department === 'CONFEZIONAMENTO') {
            hourlyCost = phase.COSTO_H_CONF || 0;
        }
        
        return hourlyCost * duration;
    }

    // ===== STATUS CALCULATION LOGIC =====
    
    /**
     * Determine ODP status based on Gantt schedule
     */
    determineODPStatus(odpNumber, scheduledEvents) {
        if (!odpNumber || !scheduledEvents) return 'Not Scheduled';
        
        // Check if this ODP is scheduled using multiple matching strategies
        const isScheduled = scheduledEvents.some(event => {
            // Primary: Check taskId
            if (String(event.taskId) === String(odpNumber)) return true;
            
            // Secondary: Check if taskTitle contains the ODP number
            if (event.taskTitle && String(event.taskTitle).includes(odpNumber)) return true;
            
            // Tertiary: Check if there's an odp_number field
            if (event.odp_number && String(event.odp_number) === String(odpNumber)) return true;
            
            return false;
        });
        
        return isScheduled ? 'Scheduled' : 'Not Scheduled';
    }
    
    /**
     * Get production start timestamp from Gantt schedule
     */
    getProductionStartTimestamp(odpNumber, scheduledEvents) {
        if (!odpNumber || !scheduledEvents) return null;
        
        // Find scheduled event by ODP number
        const scheduledEvent = scheduledEvents.find(event => {
            if (String(event.taskId) === String(odpNumber)) return true;
            if (event.taskTitle && String(event.taskTitle).includes(odpNumber)) return true;
            if (event.odp_number && String(event.odp_number) === String(odpNumber)) return true;
            return false;
        });
        
        if (scheduledEvent) {
            // Task is scheduled, return the timestamp
            const startDate = new Date(scheduledEvent.date);
            const startHour = scheduledEvent.startHour || 0;
            startDate.setHours(startHour, 0, 0, 0);
            return startDate.toISOString();
        }
        
        return null;
    }

    // ===== COMPATIBILITY LOGIC =====
    
    /**
     * Check if machine is compatible with ODP requirements
     */
    isMachineCompatible(machine, odpData) {
        if (!machine || !odpData) return false;
        
        // Department compatibility
        if (machine.department !== odpData.department) return false;
        
        // Web width compatibility
        if (machine.max_web_width !== undefined && odpData.bag_width !== undefined) {
            if (parseInt(odpData.bag_width) > machine.max_web_width) return false;
        }
        
        // Bag height compatibility
        if (machine.max_bag_height !== undefined && odpData.bag_height !== undefined) {
            if (parseInt(odpData.bag_height) > machine.max_bag_height) return false;
        }
        
        // Machine status compatibility
        if (machine.status !== 'ACTIVE') return false;
        
        return true;
    }
    
    /**
     * Get machine compatibility status with detailed information
     */
    getMachineCompatibilityStatus(machine, odpData) {
        const isCompatible = this.isMachineCompatible(machine, odpData);
        const reasons = [];
        
        if (!isCompatible) {
            if (machine.department !== odpData.department) {
                reasons.push(`Department mismatch: ${machine.department} vs ${odpData.department}`);
            }
            
            if (machine.max_web_width !== undefined && odpData.bag_width !== undefined) {
                if (parseInt(odpData.bag_width) > machine.max_web_width) {
                    reasons.push(`Bag width (${odpData.bag_width}mm) exceeds machine capacity (${machine.max_web_width}mm)`);
                }
            }
            
            if (machine.max_bag_height !== undefined && odpData.bag_height !== undefined) {
                if (parseInt(odpData.bag_height) > machine.max_bag_height) {
                    reasons.push(`Bag height (${odpData.bag_height}mm) exceeds machine capacity (${machine.max_bag_height}mm)`);
                }
            }
            
            if (machine.status !== 'ACTIVE') {
                reasons.push(`Machine is not active (status: ${machine.status})`);
            }
        }
        
        return {
            isCompatible,
            reasons,
            status: isCompatible ? 'compatible' : 'incompatible',
            icon: isCompatible ? '✅' : '❌',
            message: isCompatible ? 'Compatible' : 'Incompatible'
        };
    }

    // ===== DATA NORMALIZATION =====
    
    /**
     * Normalize machine data for storage
     */
    normalizeMachineData(machineData) {
        return {
            ...machineData,
            machine_name: this.normalizeName(machineData.machine_name || ''),
            machine_type: this.normalizeCode(machineData.machine_type || ''),
            work_center: this.normalizeCode(machineData.work_center || 'ZANICA'),
            department: this.normalizeCode(machineData.department || ''),
            status: this.normalizeStatus(machineData.status || 'ACTIVE')
        };
    }
    
    /**
     * Normalize ODP data for storage
     */
    normalizeODPData(odpData) {
        return {
            ...odpData,
            article_code: this.normalizeCode(odpData.article_code || ''),
            production_lot: this.normalizeCode(odpData.production_lot || ''),
            work_center: this.normalizeCode(odpData.work_center || ''),
            department: this.normalizeCode(odpData.department || ''),
            product_type: this.normalizeEnumLower(odpData.product_type || 'crema'),
            status: this.normalizeStatus(odpData.status || 'DRAFT'),
            priority: this.normalizeEnumLower(odpData.priority || 'medium')
        };
    }
    
    /**
     * Normalize phase data for storage
     */
    normalizePhaseData(phaseData) {
        return {
            ...phaseData,
            name: this.normalizeName(phaseData.name || ''),
            department: this.normalizeCode(phaseData.department || 'STAMPA')
        };
    }

    // ===== UTILITY METHODS =====
    
    /**
     * Normalize name (trim, uppercase, replace spaces with underscores)
     */
    normalizeName(name) {
        return String(name || '').trim().toUpperCase().replace(/\s+/g, '_');
    }
    
    /**
     * Normalize code (trim, uppercase, replace spaces with underscores)
     */
    normalizeCode(code) {
        return String(code || '').trim().toUpperCase().replace(/\s+/g, '_');
    }
    
    /**
     * Normalize status (trim, uppercase)
     */
    normalizeStatus(status) {
        return String(status || '').trim().toUpperCase();
    }
    
    /**
     * Normalize enum to lowercase
     */
    normalizeEnumLower(value) {
        return String(value || '').trim().toLowerCase();
    }
    
    /**
     * Normalize ID (ensure string format)
     */
    normalizeId(id) {
        return String(id || '').trim();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BusinessLogicService;
} else if (typeof window !== 'undefined') {
    window.BusinessLogicService = BusinessLogicService;
}
