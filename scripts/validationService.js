/**
 * Validation Service - Centralized validation logic for all entities
 * Single source of truth for all business rules and validation patterns
 */
export class ValidationService {
    constructor() {
    }
    // ===== MACHINERY VALIDATION =====
    /**
     * Validate machine data according to business rules
     */
    validate_machine(machineData, options = {}) {
        const { returnFieldMapping = false } = options;
        const errors = [];
        const fieldErrors = {};
        const warnings = [];
        // Required fields validation
        const required_fields = ['machine_name', 'machine_type', 'work_center', 'department'];
        required_fields.forEach(field => {
            if (!machineData[field] || machineData[field].toString().trim() === '') {
                const errorMessage = `${this.format_field_name(field)} is required`;
                errors.push(errorMessage);
                if (returnFieldMapping) {
                    fieldErrors[field] = errorMessage;
                }
            }
        });
        // Technical capacity validation - required fields
        const technicalFields = ['min_web_width', 'max_web_width', 'min_bag_height', 'max_bag_height'];
        technicalFields.forEach(field => {
            if (!machineData[field] || machineData[field].toString().trim() === '') {
                const errorMessage = `${this.format_field_name(field)} is required`;
                errors.push(errorMessage);
                if (returnFieldMapping) {
                    fieldErrors[field] = errorMessage;
                }
            } else {
                const value = parseFloat(machineData[field]);
                if (isNaN(value) || value <= 0) {
                    const errorMessage = `${this.format_field_name(field)} must be a number > 0`;
                    errors.push(errorMessage);
                    if (returnFieldMapping) {
                        fieldErrors[field] = errorMessage;
                    }
                }
            }
        });
        
        // Web width relationship validation (only if both values are valid)
        if (machineData.min_web_width && machineData.max_web_width) {
            const minWidth = parseFloat(machineData.min_web_width);
            const maxWidth = parseFloat(machineData.max_web_width);
            if (!isNaN(minWidth) && !isNaN(maxWidth) && minWidth > maxWidth) {
                errors.push('Minimum web width cannot be greater than maximum web width');
            }
        }
        
        // Bag height relationship validation (only if both values are valid)
        if (machineData.min_bag_height && machineData.max_bag_height) {
            const minHeight = parseFloat(machineData.min_bag_height);
            const maxHeight = parseFloat(machineData.max_bag_height);
            if (!isNaN(minHeight) && !isNaN(maxHeight) && minHeight > maxHeight) {
                errors.push('Minimum bag height cannot be greater than maximum bag height');
            }
        }
        
        // Performance validation - required fields
        const performanceFields = ['standard_speed', 'setup_time_standard'];
        performanceFields.forEach(field => {
            if (!machineData[field] || machineData[field].toString().trim() === '') {
                errors.push(`${this.format_field_name(field)} is required`);
            } else {
                const value = parseFloat(machineData[field]);
                if (isNaN(value) || value < 0) {
                    errors.push(`${this.format_field_name(field)} must be a number >= 0`);
                }
            }
        });
        
        // Changeover validation based on department - required fields
        if (machineData.department === 'STAMPA') {
            if (!machineData.changeover_color || machineData.changeover_color.toString().trim() === '') {
                errors.push(`${this.format_field_name('changeover_color')} is required for printing machines`);
            } else {
                const value = parseFloat(machineData.changeover_color);
                if (isNaN(value) || value < 0) {
                    errors.push(`${this.format_field_name('changeover_color')} must be a number >= 0`);
                }
            }
        } else if (machineData.department === 'CONFEZIONAMENTO') {
            if (!machineData.changeover_material || machineData.changeover_material.toString().trim() === '') {
                errors.push(`${this.format_field_name('changeover_material')} is required for packaging machines`);
            } else {
                const value = parseFloat(machineData.changeover_material);
                if (isNaN(value) || value < 0) {
                    errors.push(`${this.format_field_name('changeover_material')} must be a number >= 0`);
                }
            }
        }
        // Shifts validation
        if (!machineData.active_shifts || machineData.active_shifts.length === 0) {
            errors.push('At least one shift must be selected');
        }
        // Machine type validation
        const validMachineTypes = {
            'STAMPA': ['DIGITAL_PRINT', 'FLEXO_PRINT', 'ROTOGRAVURE'],
            'CONFEZIONAMENTO': ['DOYPACK', 'PLURI_PIU', 'MONO_PIU','CONFEZIONAMENTO_TRADIZIONALE']
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
    // REMOVED: validateODPForCalculation - was never used
    // ===== PHASE VALIDATION =====
    /**
     * Validate phase data according to business rules
     */
    validate_phase(phaseData, options = {}) {
        const { returnFieldMapping = false } = options;
        const errors = [];
        const fieldErrors = {};
        const warnings = [];
        // Required fields validation
        const required_fields = ['name', 'department', 'numero_persone', 'work_center'];
        required_fields.forEach(field => {
            if (!phaseData[field] || phaseData[field].toString().trim() === '') {
                const errorMessage = `${this.format_field_name(field)} is required`;
                errors.push(errorMessage);
                if (returnFieldMapping) {
                    fieldErrors[field] = errorMessage;
                }
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
            // Printing parameters are required and must be >= 0
            const printingFields = ['v_stampa', 't_setup_stampa', 'costo_h_stampa'];
            printingFields.forEach(field => {
                if (!phaseData[field] || phaseData[field].toString().trim() === '') {
                    errors.push(`${this.format_field_name(field)} is required for printing phases`);
                } else {
                    const value = parseFloat(phaseData[field]);
                    if (isNaN(value) || value < 0) {
                        errors.push(`${this.format_field_name(field)} must be a number >= 0`);
                    }
                }
            });
        } else if (phaseData.department === 'CONFEZIONAMENTO') {
            // Packaging parameters are required and must be >= 0
            const packagingFields = ['v_conf', 't_setup_conf', 'costo_h_conf'];
            packagingFields.forEach(field => {
                if (!phaseData[field] || phaseData[field].toString().trim() === '') {
                    errors.push(`${this.format_field_name(field)} is required for packaging phases`);
                } else {
                    const value = parseFloat(phaseData[field]);
                    if (isNaN(value) || value < 0) {
                        errors.push(`${this.format_field_name(field)} must be a number >= 0`);
                    }
                }
            });
            // Phase content validation for packaging
            if (!phaseData.contenuto_fase || phaseData.contenuto_fase.trim() === '') {
                errors.push('Phase content is required for packaging phases');
            }
        }
        
        // Return format based on returnFieldMapping option
        if (returnFieldMapping) {
            return {
                isValid: errors.length === 0,
                errors: fieldErrors,
                generalErrors: errors.filter(error => !Object.values(fieldErrors).includes(error))
            };
        } else {
            return {
                isValid: errors.length === 0,
                errors,
                warnings
            };
        }
    }
    // ===== ODP VALIDATION =====
    /**
     * Unified ODP validation for both form and submission contexts
     * @param {Object} odpData - The ODP data to validate
     * @param {Object} options - Validation options
     * @param {string} options.context - 'form' or 'submission'
     * @param {boolean} options.returnFieldMapping - Return field-specific errors
     * @returns {Object} Validation result
     */
    validate_odp(odpData, options = {}) {
        const { context = 'submission', returnFieldMapping = false } = options;
        
        const errors = [];
        const fieldErrors = {};
        const warnings = [];
        
        // Context-specific required fields
        const requiredFields = context === 'form' 
            ? ['article_code', 'production_lot', 'bag_height', 'bag_width', 'bag_step', 'seal_sides', 'product_type', 'quantity', 'delivery_date', 'department', 'fase']
            : ['odp_number', 'article_code', 'production_lot', 'bag_height', 'bag_width', 'bag_step', 'quantity', 'delivery_date', 'department', 'fase'];
        
        // Required fields validation
        requiredFields.forEach(field => {
            if (!odpData[field] || odpData[field].toString().trim() === '') {
                const errorMessage = `${this.format_field_name(field)} is required`;
                errors.push(errorMessage);
                if (returnFieldMapping) {
                    fieldErrors[field] = errorMessage;
                }
            }
        });
        
        // ODP number format validation (submission context only)
        if (context === 'submission' && odpData.odp_number) {
            const odpPattern = /^OP\d{6}$/;
            if (!odpPattern.test(odpData.odp_number)) {
                const errorMessage = 'ODP number must follow format: OP000001';
                errors.push(errorMessage);
                if (returnFieldMapping) {
                    fieldErrors.odp_number = errorMessage;
                }
            }
        }
        
        // Article code format validation
        if (odpData.article_code && odpData.article_code.trim() !== '') {
            const articlePattern = /^(P0|ISP0)\w+$/;
            if (!articlePattern.test(odpData.article_code)) {
                const errorMessage = 'Article code must start with P0 or ISP0';
                errors.push(errorMessage);
                if (returnFieldMapping) {
                    fieldErrors.article_code = errorMessage;
                }
            }
        }
        
        // Production lot format validation
        if (odpData.production_lot && odpData.production_lot.trim() !== '') {
            const lotPattern = /^[A-Z]{2,4}\d{3,6}$/;
            if (!lotPattern.test(odpData.production_lot)) {
                const errorMessage = 'Production lot must follow format: AAPU001';
                errors.push(errorMessage);
                if (returnFieldMapping) {
                    fieldErrors.production_lot = errorMessage;
                }
            }
        }
        
        // Numeric field validation
        const numericFields = ['bag_height', 'bag_width', 'bag_step', 'quantity', 'progress'];
        numericFields.forEach(field => {
            if (odpData[field] && odpData[field].toString().trim() !== '') {
                const numValue = parseInt(odpData[field]);
                if (isNaN(numValue) || numValue < 0) {
                    const errorMessage = `${this.format_field_name(field)} must be greater than or equal to 0`;
                    errors.push(errorMessage);
                    if (returnFieldMapping) {
                        fieldErrors[field] = errorMessage;
                    }
                }
            }
        });
        
        // Bag dimensions relationship validation
        if (odpData.bag_width && odpData.bag_step) {
            const width = parseInt(odpData.bag_width);
            const step = parseInt(odpData.bag_step);
            if (!isNaN(width) && !isNaN(step) && width < step) {
                const errorMessage = 'Bag width must be greater than or equal to bag step';
                errors.push(errorMessage);
                if (returnFieldMapping) {
                    fieldErrors.bag_width = errorMessage;
                }
            }
        }
        
        // Date validation
        if (odpData.delivery_date) {
            const deliveryDate = new Date(odpData.delivery_date);
            const now = new Date();
            if (deliveryDate <= now) {
                const errorMessage = 'Delivery date must be in the future';
                errors.push(errorMessage);
                if (returnFieldMapping) {
                    fieldErrors.delivery_date = errorMessage;
                }
            }
        }
        
        // Date range validation (submission context only)
        if (context === 'submission' && odpData.production_start && odpData.delivery_date) {
            const start_date = new Date(odpData.production_start);
            const deliveryDate = new Date(odpData.delivery_date);
            if (start_date >= deliveryDate) {
                const errorMessage = 'Production start date must be before delivery date';
                errors.push(errorMessage);
                if (returnFieldMapping) {
                    fieldErrors.production_start = errorMessage;
                }
            }
        }
        
        // Department validation
        const validDepartments = ['STAMPA', 'CONFEZIONAMENTO'];
        if (odpData.department && !validDepartments.includes(odpData.department)) {
            const errorMessage = `Department must be one of: ${validDepartments.join(', ')}`;
            errors.push(errorMessage);
            if (returnFieldMapping) {
                fieldErrors.department = errorMessage;
            }
        }
        
        // Product type validation
        const validProductTypes = ['crema', 'liquido', 'polveri'];
        if (odpData.product_type && !validProductTypes.includes(odpData.product_type)) {
            const errorMessage = `Product type must be one of: ${validProductTypes.join(', ')}`;
            errors.push(errorMessage);
            if (returnFieldMapping) {
                fieldErrors.product_type = errorMessage;
            }
        }
        
        // Seal sides validation
        if (odpData.seal_sides !== undefined && odpData.seal_sides !== '') {
            const sealSides = parseInt(odpData.seal_sides);
            if (isNaN(sealSides) || (sealSides !== 3 && sealSides !== 4)) {
                const errorMessage = 'Seal sides must be 3 or 4';
                errors.push(errorMessage);
                if (returnFieldMapping) {
                    fieldErrors.seal_sides = errorMessage;
                }
            }
        }
        
        // Return format based on returnFieldMapping option
        if (returnFieldMapping) {
            return {
                isValid: errors.length === 0,
                errors: fieldErrors,
                fieldErrors: fieldErrors
            };
        } else {
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
        }
    }
    // ===== BUSINESS LOGIC VALIDATION =====
    // REMOVED: validate_machineCompatibility - was never used
    // ===== UTILITY METHODS =====
    /**
     * Format field names for user-friendly error messages
     */
    format_field_name(field_name) {
        const fieldMap = {
            'machine_name': 'Machine Name',
            'machine_type': 'Machine Type',
            'work_center': 'Work Center',
            'department': 'Department',
            'min_web_width': 'Minimum Web Width',
            'max_web_width': 'Maximum Web Width',
            'min_bag_height': 'Minimum Bag Height',
            'max_bag_height': 'Maximum Bag Height',
            'standard_speed': 'Standard Speed',
            'setup_time_standard': 'Setup Time',
            'changeover_color': 'Color Changeover Time',
            'changeover_material': 'Material Changeover Time',
            'active_shifts': 'Active Shifts',
            'name': 'Phase Name',
            'numero_persone': 'Number of People',
            'v_stampa': 'Printing Speed',
            't_setup_stampa': 'Printing Setup Time',
            'costo_h_stampa': 'Printing Hourly Cost',
            'v_conf': 'Packaging Speed',
            't_setup_conf': 'Packaging Setup Time',
            'costo_h_conf': 'Packaging Hourly Cost',
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
        return fieldMap[field_name] || field_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    // REMOVED: validate_format, validateNumericRange, validateFieldRelationship - were never used
    // REMOVED: validateODPForm - consolidated into unified validateODP method

    // REMOVED: validate_machine_form - consolidated into unified validate_machine method

    // REMOVED: validate_phase_form - consolidated into unified validate_phase method
}
// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationService;
}
