/**
 * Validation Service - Centralized validation logic for all entities
 * Single source of truth for all business rules and validation patterns
 */
class ValidationService {
    constructor() {
        this.DEBUG = (typeof window !== 'undefined' && window.DEBUG === true);
    }

    // ===== MACHINERY VALIDATION =====
    
    /**
     * Validate machine data according to business rules
     */
    validateMachine(machineData) {
        const errors = [];
        const warnings = [];

        // Required fields validation
        const requiredFields = ['machine_name', 'machine_type', 'work_center', 'department'];
        requiredFields.forEach(field => {
            if (!machineData[field] || machineData[field].toString().trim() === '') {
                errors.push(`${this.formatFieldName(field)} is required`);
            }
        });

        // Technical capacity validation
        if (machineData.max_web_width !== undefined && machineData.max_web_width <= 0) {
            errors.push('Maximum web width must be greater than 0');
        }
        if (machineData.max_bag_height !== undefined && machineData.max_bag_height <= 0) {
            errors.push('Maximum bag height must be greater than 0');
        }

        // Web width relationship validation
        if (machineData.min_web_width !== undefined && machineData.max_web_width !== undefined) {
            if (machineData.min_web_width > machineData.max_web_width) {
                errors.push('Minimum web width cannot be greater than maximum web width');
            }
        }

        // Bag height relationship validation
        if (machineData.min_bag_height !== undefined && machineData.max_bag_height !== undefined) {
            if (machineData.min_bag_height > machineData.max_bag_height) {
                errors.push('Minimum bag height cannot be greater than maximum bag height');
            }
        }

        // Performance validation
        if (machineData.standard_speed !== undefined && machineData.standard_speed < 0) {
            errors.push('Standard speed cannot be negative');
        }
        if (machineData.setup_time_standard !== undefined && machineData.setup_time_standard < 0) {
            errors.push('Setup time cannot be negative');
        }

        // Changeover validation based on department
        if (machineData.department === 'STAMPA') {
            if (machineData.changeover_color !== undefined && machineData.changeover_color < 0) {
                errors.push('Color changeover time cannot be negative');
            }
        } else if (machineData.department === 'CONFEZIONAMENTO') {
            if (machineData.changeover_material !== undefined && machineData.changeover_material < 0) {
                errors.push('Material changeover time cannot be negative');
            }
        }

        // Shifts validation
        if (!machineData.active_shifts || machineData.active_shifts.length === 0) {
            errors.push('At least one shift must be selected');
        }

        // Machine type validation
        const validMachineTypes = {
            'STAMPA': ['DIGITAL_PRINT', 'FLEXO_PRINT', 'ROTOGRAVURE'],
            'CONFEZIONAMENTO': ['DOYPACK', 'PLURI_PIU', 'MONO_PIU']
        };
        
        if (machineData.department && machineData.machine_type) {
            const validTypes = validMachineTypes[machineData.department] || [];
            if (!validTypes.includes(machineData.machine_type)) {
                errors.push(`Machine type '${machineData.machine_type}' is not valid for department '${machineData.department}'`);
            }
        }

        // Work center validation
        const validWorkCenters = ['ZANICA', 'BUSTO_GAROLFO'];
        if (machineData.work_center && !validWorkCenters.includes(machineData.work_center)) {
            errors.push(`Work center '${machineData.work_center}' is not valid. Must be one of: ${validWorkCenters.join(', ')}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    // ===== PHASE VALIDATION =====
    
    /**
     * Validate phase data according to business rules
     */
    validatePhase(phaseData) {
        const errors = [];
        const warnings = [];

        // Required fields validation
        const requiredFields = ['name', 'department', 'numero_persone'];
        requiredFields.forEach(field => {
            if (!phaseData[field] || phaseData[field].toString().trim() === '') {
                errors.push(`${this.formatFieldName(field)} is required`);
            }
        });

        // Department validation
        const validDepartments = ['STAMPA', 'CONFEZIONAMENTO'];
        if (phaseData.department && !validDepartments.includes(phaseData.department)) {
            errors.push(`Department must be one of: ${validDepartments.join(', ')}`);
        }

        // Number of people validation
        if (phaseData.numero_persone !== undefined) {
            const numPeople = parseInt(phaseData.numero_persone);
            if (isNaN(numPeople) || numPeople < 1) {
                errors.push('Number of people must be at least 1');
            }
        }

        // Department-specific validation
        if (phaseData.department === 'STAMPA') {
            // Printing parameters validation
            const printingFields = ['V_STAMPA', 'T_SETUP_STAMPA', 'COSTO_H_STAMPA'];
            printingFields.forEach(field => {
                if (phaseData[field] !== undefined && phaseData[field] < 0) {
                    errors.push(`${this.formatFieldName(field)} cannot be negative`);
                }
            });
        } else if (phaseData.department === 'CONFEZIONAMENTO') {
            // Packaging parameters validation
            const packagingFields = ['V_CONF', 'T_SETUP_CONF', 'COSTO_H_CONF'];
            packagingFields.forEach(field => {
                if (phaseData[field] !== undefined && phaseData[field] < 0) {
                    errors.push(`${this.formatFieldName(field)} cannot be negative`);
                }
            });

            // Phase content validation for packaging
            if (!phaseData.contenuto_fase || phaseData.contenuto_fase.trim() === '') {
                errors.push('Phase content is required for packaging phases');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    // ===== ODP VALIDATION =====
    
    /**
     * Validate ODP data according to business rules
     */
    validateODP(odpData) {
        const errors = [];
        const warnings = [];

        // Required fields validation
        const requiredFields = ['odp_number', 'article_code', 'production_lot', 'bag_height', 'bag_width', 'bag_step', 'quantity', 'delivery_date', 'department', 'fase'];
        requiredFields.forEach(field => {
            if (!odpData[field] || odpData[field].toString().trim() === '') {
                errors.push(`${this.formatFieldName(field)} is required`);
            }
        });

        // ODP number format validation
        if (odpData.odp_number) {
            const odpPattern = /^OP\d{6}$/;
            if (!odpPattern.test(odpData.odp_number)) {
                errors.push('ODP number must follow format: OP000001');
            }
        }

        // Article code format validation
        if (odpData.article_code) {
            const articlePattern = /^(P0|ISP0)\w+$/;
            if (!articlePattern.test(odpData.article_code)) {
                errors.push('Article code must start with P0 or ISP0');
            }
        }

        // Production lot format validation
        if (odpData.production_lot) {
            const lotPattern = /^[A-Z]{3,4}[A-Z0-9]{3,4}$/;
            if (!lotPattern.test(odpData.production_lot)) {
                errors.push('Production lot must follow format: AAPU001');
            }
        }

        // Numeric field validation
        const numericFields = ['bag_height', 'bag_width', 'bag_step', 'quantity'];
        numericFields.forEach(field => {
            if (odpData[field] !== undefined) {
                const numValue = parseInt(odpData[field]);
                if (isNaN(numValue) || numValue < 0) {
                    errors.push(`${this.formatFieldName(field)} must be a positive number`);
                }
            }
        });

        // Bag dimensions relationship validation
        if (odpData.bag_width !== undefined && odpData.bag_step !== undefined) {
            if (parseInt(odpData.bag_width) < parseInt(odpData.bag_step)) {
                errors.push('Bag width must be greater than or equal to bag step');
            }
        }

        // Quantity validation
        if (odpData.quantity !== undefined) {
            const quantity = parseInt(odpData.quantity);
            if (quantity <= 0) {
                errors.push('Quantity must be greater than 0');
            }
        }

        // Delivery date validation
        if (odpData.delivery_date) {
            const deliveryDate = new Date(odpData.delivery_date);
            const now = new Date();
            if (deliveryDate <= now) {
                errors.push('Delivery date must be in the future');
            }
        }

        // Department validation
        const validDepartments = ['STAMPA', 'CONFEZIONAMENTO'];
        if (odpData.department && !validDepartments.includes(odpData.department)) {
            errors.push(`Department must be one of: ${validDepartments.join(', ')}`);
        }

        // Product type validation
        const validProductTypes = ['crema', 'liquido', 'polveri'];
        if (odpData.product_type && !validProductTypes.includes(odpData.product_type)) {
            errors.push(`Product type must be one of: ${validProductTypes.join(', ')}`);
        }

        // Seal sides validation
        if (odpData.seal_sides !== undefined) {
            const sealSides = parseInt(odpData.seal_sides);
            if (sealSides !== 3 && sealSides !== 4) {
                errors.push('Seal sides must be 3 or 4');
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    // ===== BUSINESS LOGIC VALIDATION =====
    
    /**
     * Validate machine compatibility with ODP requirements
     */
    validateMachineCompatibility(machine, odpData) {
        const errors = [];
        const warnings = [];

        // Department compatibility
        if (machine.department !== odpData.department) {
            errors.push(`Machine department (${machine.department}) does not match ODP department (${odpData.department})`);
        }

        // Web width compatibility
        if (machine.max_web_width !== undefined && odpData.bag_width !== undefined) {
            if (parseInt(odpData.bag_width) > machine.max_web_width) {
                errors.push(`Bag width (${odpData.bag_width}mm) exceeds machine maximum web width (${machine.max_web_width}mm)`);
            }
        }

        // Bag height compatibility
        if (machine.max_bag_height !== undefined && odpData.bag_height !== undefined) {
            if (parseInt(odpData.bag_height) > machine.max_bag_height) {
                errors.push(`Bag height (${odpData.bag_height}mm) exceeds machine maximum bag height (${machine.max_bag_height}mm)`);
            }
        }

        // Machine status compatibility
        if (machine.status !== 'ACTIVE') {
            warnings.push(`Machine ${machine.machine_name} is not active (status: ${machine.status})`);
        }

        return {
            isCompatible: errors.length === 0,
            errors,
            warnings
        };
    }

    // ===== UTILITY METHODS =====
    
    /**
     * Format field names for user-friendly error messages
     */
    formatFieldName(fieldName) {
        const fieldMap = {
            'machine_name': 'Machine Name',
            'machine_type': 'Machine Type',
            'work_center': 'Work Center',
            'department': 'Department',
            'max_web_width': 'Maximum Web Width',
            'max_bag_height': 'Maximum Bag Height',
            'standard_speed': 'Standard Speed',
            'setup_time_standard': 'Setup Time',
            'changeover_color': 'Color Changeover Time',
            'changeover_material': 'Material Changeover Time',
            'active_shifts': 'Active Shifts',
            'name': 'Phase Name',
            'numero_persone': 'Number of People',
            'V_STAMPA': 'Printing Speed',
            'T_SETUP_STAMPA': 'Printing Setup Time',
            'COSTO_H_STAMPA': 'Printing Hourly Cost',
            'V_CONF': 'Packaging Speed',
            'T_SETUP_CONF': 'Packaging Setup Time',
            'COSTO_H_CONF': 'Packaging Hourly Cost',
            'contenuto_fase': 'Phase Content',
            'odp_number': 'ODP Number',
            'article_code': 'Article Code',
            'production_lot': 'Production Lot',
            'bag_height': 'Bag Height',
            'bag_width': 'Bag Width',
            'bag_step': 'Bag Step',
            'seal_sides': 'Seal Sides',
            'product_type': 'Product Type',
            'quantity': 'Quantity',
            'delivery_date': 'Delivery Date',
            'fase': 'Phase'
        };

        return fieldMap[fieldName] || fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Validate data format patterns
     */
    validateFormat(fieldName, value, pattern) {
        if (!value) return { isValid: false, error: `${this.formatFieldName(fieldName)} is required` };
        if (!pattern.test(value)) return { isValid: false, error: `${this.formatFieldName(fieldName)} format is invalid` };
        return { isValid: true, error: null };
    }

    /**
     * Validate numeric range
     */
    validateNumericRange(fieldName, value, min, max) {
        if (value === undefined || value === null) return { isValid: true, error: null };
        
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return { isValid: false, error: `${this.formatFieldName(fieldName)} must be a number` };
        if (min !== undefined && numValue < min) return { isValid: false, error: `${this.formatFieldName(fieldName)} must be at least ${min}` };
        if (max !== undefined && numValue > max) return { isValid: false, error: `${this.formatFieldName(fieldName)} must be at most ${max}` };
        
        return { isValid: true, error: null };
    }

    /**
     * Validate field relationships
     */
    validateFieldRelationship(field1Name, field1Value, field2Name, field2Value, operator = '>=') {
        if (!field1Value || !field2Value) return { isValid: true, error: null };
        
        const val1 = parseFloat(field1Value);
        const val2 = parseFloat(field2Value);
        
        if (isNaN(val1) || isNaN(val2)) return { isValid: true, error: null };
        
        let isValid = false;
        switch (operator) {
            case '>=':
                isValid = val1 >= val2;
                break;
            case '>':
                isValid = val1 > val2;
                break;
            case '<=':
                isValid = val1 <= val2;
                break;
            case '<':
                isValid = val1 < val2;
                break;
            case '==':
                isValid = val1 === val2;
                break;
            default:
                isValid = true;
        }
        
        if (!isValid) {
            return {
                isValid: false,
                error: `${this.formatFieldName(field1Name)} must be ${operator} ${this.formatFieldName(field2Name)}`
            };
        }
        
        return { isValid: true, error: null };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationService;
} else if (typeof window !== 'undefined') {
    window.ValidationService = ValidationService;
}
