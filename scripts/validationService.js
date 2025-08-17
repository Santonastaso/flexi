/**
 * Validation Service - Centralized validation logic for all entities
 * Single source of truth for all business rules and validation patterns
 * Refactored to be data-driven for easier maintenance and extension.
 */

// --- Validation Configuration ---
// NOTE: Custom validators are now regular functions to correctly bind `this` context.
const validationConfig = {
    machine: {
        required: ['machine_name', 'machine_type', 'work_center', 'department', 'min_web_width', 'max_web_width', 'min_bag_height', 'max_bag_height', 'standard_speed', 'setup_time_standard'],
        numericPositive: ['min_web_width', 'max_web_width', 'min_bag_height', 'max_bag_height'],
        numericNonNegative: ['standard_speed', 'setup_time_standard', 'changeover_color', 'changeover_material'],
        custom: [
            // Web width relationship validation
            function(data, errors) {
                const minWidth = parseFloat(data.min_web_width);
                const maxWidth = parseFloat(data.max_web_width);
                if (!isNaN(minWidth) && !isNaN(maxWidth) && minWidth > maxWidth) {
                    errors.push('Minimum web width cannot be greater than maximum web width');
                }
            },
            // Bag height relationship validation
            function(data, errors) {
                const minHeight = parseFloat(data.min_bag_height);
                const maxHeight = parseFloat(data.max_bag_height);
                if (!isNaN(minHeight) && !isNaN(maxHeight) && minHeight > maxHeight) {
                    errors.push('Minimum bag height cannot be greater than maximum bag height');
                }
            },
            // Department-specific changeover validation
            function(data, errors) {
                if (data.department === 'STAMPA' && (!data.changeover_color || data.changeover_color.toString().trim() === '')) {
                    errors.push('Color Changeover Time is required for printing machines');
                } else if (data.department === 'CONFEZIONAMENTO' && (!data.changeover_material || data.changeover_material.toString().trim() === '')) {
                    errors.push('Material Changeover Time is required for packaging machines');
                }
            },
            // Shifts validation
            function(data, errors) {
                if (!data.active_shifts || data.active_shifts.length === 0) {
                    errors.push('At least one shift must be selected');
                }
            },
            // Machine type and work center validation
            function(data, errors) {
                const validMachineTypes = {
                    'STAMPA': ['DIGITAL_PRINT', 'FLEXO_PRINT', 'ROTOGRAVURE'],
                    'CONFEZIONAMENTO': ['DOYPACK', 'PLURI_PIU', 'MONO_PIU','CONFEZIONAMENTO_TRADIZIONALE','CONFEZIONAMENTO_POLVERI']
                };
                if (data.department && data.machine_type) {
                    const validTypes = validMachineTypes[data.department] || [];
                    if (!validTypes.includes(data.machine_type)) {
                        errors.push(`Machine type '${data.machine_type}' is not valid for department '${data.department}'`);
                    }
                }
                const validWorkCenters = ['ZANICA', 'BUSTO_GAROLFO'];
                if (data.work_center && !validWorkCenters.includes(data.work_center)) {
                    errors.push(`Work center '${data.work_center}' is not valid. Must be one of: ${validWorkCenters.join(', ')}`);
                }
            }
        ]
    },
    phase: {
        required: ['name', 'department', 'numero_persone', 'work_center'],
        numericMin: { numero_persone: 1 },
        custom: [
            function(data, errors) {
                const validDepartments = ['STAMPA', 'CONFEZIONAMENTO'];
                if (data.department && !validDepartments.includes(data.department)) {
                    errors.push(`Department must be one of: ${validDepartments.join(', ')}`);
                }
            },
            function(data, errors) {
                if (data.department === 'STAMPA') {
                    const printingFields = ['v_stampa', 't_setup_stampa', 'costo_h_stampa'];
                    printingFields.forEach(field => {
                        if (!data[field] || data[field].toString().trim() === '' || parseFloat(data[field]) < 0) {
                            errors.push(`${this.format_field_name(field)} is required and must be >= 0 for printing phases`);
                        }
                    });
                } else if (data.department === 'CONFEZIONAMENTO') {
                    const packagingFields = ['v_conf', 't_setup_conf', 'costo_h_conf'];
                    packagingFields.forEach(field => {
                        if (!data[field] || data[field].toString().trim() === '' || parseFloat(data[field]) < 0) {
                            errors.push(`${this.format_field_name(field)} is required and must be >= 0 for packaging phases`);
                        }
                    });
                    if (!data.contenuto_fase || data.contenuto_fase.trim() === '') {
                        errors.push('Phase content is required for packaging phases');
                    }
                }
            }
        ]
    },
    odp: {
        required: {
            form: ['article_code', 'production_lot', 'bag_height', 'bag_width', 'bag_step', 'seal_sides', 'product_type', 'quantity', 'delivery_date', 'department', 'fase'],
            submission: ['odp_number', 'article_code', 'production_lot', 'bag_height', 'bag_width', 'bag_step', 'quantity', 'delivery_date', 'department', 'fase']
        },
        numericNonNegative: ['bag_height', 'bag_width', 'bag_step', 'quantity', 'quantity_per_box', 'quantity_completed'],
        patterns: {
            odp_number: { rule: /^OP/, message: 'ODP number must start with OP', context: 'submission' },
            article_code: { rule: /^(P0|ISP0)\w+$/, message: 'Article code must start with P0 or ISP0' }
        },
        custom: [
            function(data, errors) {
                const completed = parseInt(data.quantity_completed);
                const total = parseInt(data.quantity);
                if (!isNaN(completed) && !isNaN(total) && completed > total) {
                    errors.push('Quantity completed cannot exceed total quantity');
                }
            },
            function(data, errors) {
                const width = parseInt(data.bag_width);
                const step = parseInt(data.bag_step);
                if (!isNaN(width) && !isNaN(step) && width < step) {
                    errors.push('Bag width must be greater than or equal to bag step');
                }
            },
            function(data, errors) {
                if (data.delivery_date && new Date(data.delivery_date) <= new Date()) {
                    errors.push('Delivery date must be in the future');
                }
            },
            function(data, errors, context) {
                if (context === 'submission' && data.production_start && data.delivery_date && new Date(data.production_start) >= new Date(data.delivery_date)) {
                    errors.push('Production start date must be before delivery date');
                }
            },
            function(data, errors) {
                const validDepartments = ['STAMPA', 'CONFEZIONAMENTO'];
                if (data.department && !validDepartments.includes(data.department)) {
                    errors.push(`Department must be one of: ${validDepartments.join(', ')}`);
                }
                const validProductTypes = ['crema', 'liquido', 'polveri'];
                if (data.product_type && !validProductTypes.includes(data.product_type)) {
                    errors.push(`Product type must be one of: ${validProductTypes.join(', ')}`);
                }
                const sealSides = parseInt(data.seal_sides);
                if (data.seal_sides && data.seal_sides.toString().trim() !== '' && (isNaN(sealSides) || ![3, 4].includes(sealSides))) {
                    errors.push('Seal sides must be 3 or 4');
                }
            }
        ]
    }
};


export class ValidationService {

    /**
     * Generic validation runner
     * @param {Object} data - The data to validate
     * @param {Object} config - The validation configuration for the entity
     * @param {Object} options - Additional options like context
     * @returns {Object} { isValid, errors, fieldErrors }
     */
    _validate(data, config, options = {}) {
        const { context = 'submission', returnFieldMapping = false } = options;
        const errors = [];
        const fieldErrors = {};

        const addError = (field, message) => {
            const finalMessage = message || `${this.format_field_name(field)} is invalid`;
            errors.push(finalMessage);
            if (returnFieldMapping) {
                fieldErrors[field] = finalMessage;
            }
        };

        // 1. Required fields
        let requiredFields = Array.isArray(config.required) ? config.required : config.required[context];
        if (requiredFields) {
            requiredFields.forEach(field => {
                if (data[field] === undefined || data[field] === null || data[field].toString().trim() === '') {
                    addError(field, `${this.format_field_name(field)} is required`);
                }
            });
        }

        // 2. Numeric validations
        if (config.numericPositive) {
            config.numericPositive.forEach(field => {
                const value = parseFloat(data[field]);
                if (data[field] && (isNaN(value) || value <= 0)) {
                    addError(field, `${this.format_field_name(field)} must be a number > 0`);
                }
            });
        }
        if (config.numericNonNegative) {
            config.numericNonNegative.forEach(field => {
                const value = parseFloat(data[field]);
                if (data[field] && (isNaN(value) || value < 0)) {
                    addError(field, `${this.format_field_name(field)} must be a number >= 0`);
                }
            });
        }
        if (config.numericMin) {
            Object.entries(config.numericMin).forEach(([field, min]) => {
                const value = parseInt(data[field]);
                if (!isNaN(value) && value < min) {
                    addError(field, `${this.format_field_name(field)} must be at least ${min}`);
                }
            });
        }


        // 3. Pattern validations
        if (config.patterns) {
            Object.entries(config.patterns).forEach(([field, patternConfig]) => {
                if (data[field] && (!patternConfig.context || patternConfig.context === context)) {
                    if (!patternConfig.rule.test(data[field])) {
                        addError(field, patternConfig.message);
                    }
                }
            });
        }

        // 4. Custom validation functions
        if (config.custom) {
            config.custom.forEach(customValidator => {
                customValidator.call(this, data, errors, context);
            });
        }

        // Create a distinct set of errors to avoid duplicates
        const uniqueErrors = [...new Set(errors)];

        return {
            isValid: uniqueErrors.length === 0,
            errors: returnFieldMapping ? fieldErrors : uniqueErrors,
            warnings: []
        };
    }

    // ===== PUBLIC VALIDATION METHODS =====

    validate_machine(machineData, options = {}) {
        return this._validate(machineData, validationConfig.machine, options);
    }

    validate_phase(phaseData, options = {}) {
        return this._validate(phaseData, validationConfig.phase, options);
    }

    validate_odp(odpData, options = {}) {
        return this._validate(odpData, validationConfig.odp, options);
    }


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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationService;
}