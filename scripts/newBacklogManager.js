/**
 * New Backlog Manager - Handles printing and packaging production lots
 * Implements Italian calculation formulas for Stampa and Confezionamento
 */
class NewBacklogManager extends BaseManager {
    constructor() {
        super(window.storageService);
        this.editManager = window.editManager;
        this.currentCalculation = null;
        this.init();
    }

    init() {
        // Ensure storage service is available
        if (!this.storageService) {
            console.error('StorageService not available');
            return;
        }
        
        // Bind elements first
        this.elements = this.getElementMap();
        
        // Initialize edit functionality
        if (this.editManager) {
            this.editManager.initTableEdit('.modern-table');
            // Override saveEdit method
            this.editManager.saveEdit = (row) => this.saveEdit(row);
            
            // Handle delete events
            const table = document.querySelector('.modern-table');
            if (table) {
                table.addEventListener('deleteRow', (e) => {
                    const row = e.detail.row;
                    const taskId = row.dataset.taskId;
                    if (taskId) {
                        this.deleteTask(taskId);
                    }
                });
            }
        } else {
            console.error('EditManager not available');
        }
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Load data and setup validation
        this.loadBacklog();
        this.setupFormValidation();
    }

    getElementMap() {
        return {
            // IDENTIFICAZIONE fields
            odpNumber: document.getElementById('odpNumber'),
            articleCode: document.getElementById('articleCode'),
            productionLot: document.getElementById('productionLot'),
            workCenter: document.getElementById('workCenter'),
            
            // SPECIFICHE TECNICHE fields
            bagHeight: document.getElementById('bagHeight'),
            bagWidth: document.getElementById('bagWidth'),
            bagStep: document.getElementById('bagStep'),
            sealSides: document.getElementById('sealSides'),
            productType: document.getElementById('productType'),
            quantity: document.getElementById('quantity'),
            
            // PIANIFICAZIONE fields
            productionStart: document.getElementById('productionStart'),
            deliveryDate: document.getElementById('deliveryDate'),
            
            // DATI COMMERCIALI fields
            internalCustomerCode: document.getElementById('internalCustomerCode'),
            externalCustomerCode: document.getElementById('externalCustomerCode'),
            customerOrderRef: document.getElementById('customerOrderRef'),
            
            // DATI LAVORAZIONE fields
            tipoLavorazione: document.getElementById('tipoLavorazione'),
            fase: document.getElementById('fase'),
            
            // Buttons
            calculateBtn: document.getElementById('calculateBtn'),
            createTaskBtn: document.getElementById('createTask'),
            
            // Results sections
            compatibilityCheck: document.getElementById('compatibilityCheck'),
            compatibilityResults: document.getElementById('compatibilityResults'),
            calculationResults: document.getElementById('calculationResults'),
            
            // Calculation results
            materialQuantity: document.getElementById('materialQuantity'),
            printingTime: document.getElementById('printingTime'),
            printingCost: document.getElementById('printingCost'),
            packagingTime: document.getElementById('packagingTime'),
            packagingCost: document.getElementById('packagingCost'),
            totalDuration: document.getElementById('totalDuration'),
            totalCost: document.getElementById('totalCost'),
            
            // Table
            backlogTableBody: document.getElementById('backlog-table-body'),
            
            // Preview elements (keeping for bag visualization)
            previewFascia: document.getElementById('previewFascia'),
            previewAltezza: document.getElementById('previewAltezza'),
            previewPasso: document.getElementById('previewPasso')
        };
    }

    attachEventListeners() {
        if (this.elements.calculateBtn) {
            this.elements.calculateBtn.addEventListener('click', () => {
                this.validateForm();
                if (!this.elements.calculateBtn.disabled) {
                    this.calculateProduction();
                }
            });
        }
        
        if (this.elements.createTaskBtn) {
            this.elements.createTaskBtn.addEventListener('click', () => {
                this.validateForm();
                if (!this.elements.createTaskBtn.disabled) {
                    this.addToBacklog();
                }
            });
        }
        
        // Form validation and preview updates
        const technicalInputs = [this.elements.bagHeight, this.elements.bagWidth, this.elements.bagStep, this.elements.quantity];
        technicalInputs.forEach(input => {
            if (input) {
            input.addEventListener('input', () => {
                this.updatePreview();
            });
            }
        });
        
        // Handle tipo_lavorazione change to update fase options
        if (this.elements.tipoLavorazione) {
            this.elements.tipoLavorazione.addEventListener('change', () => {
                this.updateFaseOptions();
            });
        }
        
        // Handle fase change for calculations
        if (this.elements.fase) {
            this.elements.fase.addEventListener('change', () => {
                // No validation here, just enable/disable buttons based on field presence
                this.updateButtonStates();
            });
        }
        
        // Auto-generate ODP number on article code change
        if (this.elements.articleCode) {
            this.elements.articleCode.addEventListener('input', () => {
                this.generateODPNumber();
            });
        }
        
        // Real-time compatibility checking
        const compatibilityFields = [this.elements.workCenter, this.elements.bagWidth, this.elements.bagHeight, this.elements.tipoLavorazione];
        compatibilityFields.forEach(field => {
            if (field) {
                field.addEventListener('change', () => {
                    this.checkCompatibility();
                });
            }
        });

        // Date validation - only validate when buttons are clicked, not on change
        if (this.elements.productionStart) {
            this.elements.productionStart.addEventListener('change', () => {
                // No validation here, just update button states
                this.updateButtonStates();
            });
        }

        if (this.elements.deliveryDate) {
            this.elements.deliveryDate.addEventListener('change', () => {
                // No validation here, just update button states
                this.updateButtonStates();
            });
        }

        // Additional form validations - only update button states, not validate
        const allInputs = [
            this.elements.articleCode, this.elements.productionLot, this.elements.workCenter,
            this.elements.sealSides, this.elements.productType, this.elements.internalCustomerCode,
            this.elements.externalCustomerCode, this.elements.customerOrderRef
        ];

        allInputs.forEach(input => {
            if (input) {
                input.addEventListener('input', () => {
                    this.updateButtonStates();
                });
                input.addEventListener('change', () => {
                    this.updateButtonStates();
                });
            }
        });
    }

    setupFormValidation() {
        this.loadPhases();
        this.updateButtonStates();
        this.updatePreview();
        this.generateODPNumber();
    }

    generateODPNumber() {
        if (!this.elements.odpNumber.value) {
            // Generate ODP number using the storage service
            const odpNumber = this.storageService.generateODPNumber();
            this.elements.odpNumber.value = odpNumber;
        }
    }

    updateFaseOptions() {
        const tipoLavorazione = this.elements.tipoLavorazione.value;
        const faseSelect = this.elements.fase;
        
        // Clear existing options
        faseSelect.innerHTML = '<option value="">Select fase</option>';
        
        if (tipoLavorazione) {
            // Get phases for the selected type
            const phases = this.storageService.getPhasesByType(tipoLavorazione);
            
            phases.forEach(phase => {
                const option = document.createElement('option');
                option.value = phase.id;
                option.textContent = phase.name || `${phase.type} - ${phase.id}`;
                faseSelect.appendChild(option);
            });
        }
    }

    loadPhases() {
        // Load existing phases from storage
        this.storageService.getPhases();
    }

    getPhaseName(phaseId) {
        if (!phaseId) return null;
        const phase = this.storageService.getPhaseById(phaseId);
        return phase ? phase.name : phaseId;
    }

    validateDates() {
        const productionStart = this.elements.productionStart.value;
        const deliveryDate = this.elements.deliveryDate.value;
        
        // Clear previous date validation errors
        this.showValidationError('productionStart', '');
        this.showValidationError('deliveryDate', '');
        
        // Only validate if both dates are provided
        if (productionStart && deliveryDate) {
            const startDate = new Date(productionStart);
            const deliveryDateObj = new Date(deliveryDate);
            
            if (startDate >= deliveryDateObj) {
                this.elements.productionStart.setCustomValidity('Production start must be before delivery date');
                this.elements.deliveryDate.setCustomValidity('Delivery date must be after production start');
                this.showValidationError('productionStart', 'Production start must be before delivery date');
                this.showValidationError('deliveryDate', 'Delivery date must be after production start');
                return false;
            } else {
                this.elements.productionStart.setCustomValidity('');
                this.elements.deliveryDate.setCustomValidity('');
            }
        }
        
        return true;
    }

    updatePreview() {
        // Get current form values for bag preview
        const bagHeight = this.elements.bagHeight.value || '';
        const bagWidth = this.elements.bagWidth.value || '';
        const bagStep = this.elements.bagStep.value || '';
        
        // Update SVG labels (using bagWidth as fascia for compatibility)
        if (this.elements.previewFascia) {
            this.elements.previewFascia.textContent = bagWidth ? `${bagWidth}mm` : '-';
        }
        if (this.elements.previewAltezza) {
            this.elements.previewAltezza.textContent = bagHeight ? `${bagHeight}mm` : '-';
        }
        if (this.elements.previewPasso) {
            this.elements.previewPasso.textContent = bagStep ? `${bagStep}mm` : '-';
        }
    }

    checkCompatibility() {
        const workCenter = this.elements.workCenter.value;
        const bagWidth = parseInt(this.elements.bagWidth.value) || 0;
        const bagHeight = parseInt(this.elements.bagHeight.value) || 0;
        const tipoLavorazione = this.elements.tipoLavorazione.value;
        
        if (!workCenter || !bagWidth || !bagHeight || !tipoLavorazione) {
            this.elements.compatibilityCheck.style.display = 'none';
            return;
        }
        
        // Create a mock ODP object for compatibility checking
        const mockODP = {
            work_center: workCenter,
            bag_width: bagWidth,
            bag_height: bagHeight,
            tipo_lavorazione: tipoLavorazione
        };
        
        // Get machines and check compatibility
        const machines = this.storageService.getMachines();
        const compatibilityResults = [];
        
        machines.forEach(machine => {
            const compatibility = Utils.isCompatible(machine, mockODP);
            const status = Utils.getCompatibilityStatus(machine, mockODP);
            
            compatibilityResults.push({
                machine: machine,
                compatibility: compatibility,
                status: status
            });
        });
        
        this.displayCompatibilityResults(compatibilityResults);
        this.elements.compatibilityCheck.style.display = 'block';
    }

    displayCompatibilityResults(results) {
        const container = this.elements.compatibilityResults;
        container.innerHTML = '';
        
        if (results.length === 0) {
            container.innerHTML = '<p>No machines found.</p>';
            return;
        }
        
        results.forEach(result => {
            const item = document.createElement('div');
            item.className = `compatibility-item ${result.status.status}`;
            
            item.innerHTML = `
                <div>
                    <div class="machine-name">${result.machine.machine_name || result.machine.name || result.machine.id}</div>
                    <div class="machine-type">${result.machine.machine_type || result.machine.type || 'Unknown'}</div>
                    ${result.compatibility.reasons.length > 0 ? 
                        `<div class="compatibility-reasons">${result.compatibility.reasons.join(', ')}</div>` : 
                        ''}
                </div>
                <div class="compatibility-status">
                    <span class="compatibility-icon">${result.status.icon}</span>
                    <span>${result.status.message}</span>
                </div>
            `;
            
            container.appendChild(item);
        });
    }

    updateButtonStates() {
        // For calculation, only require essential fields
        const hasCalculationFields = this.elements.bagHeight.value &&
                                   this.elements.bagWidth.value &&
                                   this.elements.bagStep.value &&
                                   this.elements.quantity.value &&
                                   this.elements.tipoLavorazione.value &&
                                   this.elements.fase.value;
        
        // For adding to backlog, require all fields
        const hasAllRequiredFields = this.elements.articleCode.value.trim() &&
                                   this.elements.productionLot.value.trim() &&
                                   this.elements.workCenter.value &&
                                   this.elements.bagHeight.value &&
                                   this.elements.bagWidth.value &&
                                   this.elements.bagStep.value &&
                                   this.elements.sealSides.value &&
                                   this.elements.productType.value &&
                                   this.elements.quantity.value &&
                                   this.elements.deliveryDate.value &&
                                   this.elements.tipoLavorazione.value &&
                                   this.elements.fase.value;
        
        this.elements.calculateBtn.disabled = !hasCalculationFields;
        this.elements.createTaskBtn.disabled = !hasAllRequiredFields || !this.currentCalculation;
    }

    validateForm() {
        // Clear any previous validation errors
        this.clearValidationErrors();
        
        // Validate dates first
        const datesValid = this.validateDates();
        
        // For calculation, only require essential fields
        const hasCalculationFields = this.elements.bagHeight.value &&
                                   this.elements.bagWidth.value &&
                                   this.elements.bagStep.value &&
                                   this.elements.quantity.value &&
                                   this.elements.tipoLavorazione.value &&
                                   this.elements.fase.value;
        
        // For adding to backlog, require all fields
        const hasAllRequiredFields = this.elements.articleCode.value.trim() &&
                                   this.elements.productionLot.value.trim() &&
                                   this.elements.workCenter.value &&
                                   this.elements.bagHeight.value &&
                                   this.elements.bagWidth.value &&
                                   this.elements.bagStep.value &&
                                   this.elements.sealSides.value &&
                                   this.elements.productType.value &&
                                   this.elements.quantity.value &&
                                   this.elements.deliveryDate.value &&
                                   this.elements.tipoLavorazione.value &&
                                   this.elements.fase.value;
        
        // Additional validation for numeric fields
        const numericValidation = this.validateNumericFields();
        
        // Validate field formats
        this.validateFieldFormats();
        
        this.elements.calculateBtn.disabled = !hasCalculationFields || !numericValidation;
        this.elements.createTaskBtn.disabled = !hasAllRequiredFields || !this.currentCalculation || !datesValid || !numericValidation;
    }

    validateNumericFields() {
        const bagHeight = parseInt(this.elements.bagHeight.value) || 0;
        const bagWidth = parseInt(this.elements.bagWidth.value) || 0;
        const bagStep = parseInt(this.elements.bagStep.value) || 0;
        const quantity = parseInt(this.elements.quantity.value) || 0;
        
        let isValid = true;
        
        // Check if values are positive (only if they have values)
        if (this.elements.bagHeight.value && bagHeight <= 0) {
            this.showValidationError('bagHeight', 'Bag height must be greater than 0');
            isValid = false;
        }
        
        if (this.elements.bagWidth.value && bagWidth <= 0) {
            this.showValidationError('bagWidth', 'Bag width must be greater than 0');
            isValid = false;
        }
        
        if (this.elements.bagStep.value && bagStep <= 0) {
            this.showValidationError('bagStep', 'Bag step must be greater than 0');
            isValid = false;
        }
        
        if (this.elements.quantity.value && quantity <= 0) {
            this.showValidationError('quantity', 'Quantity must be greater than 0');
            isValid = false;
        }
        
        // Check if bag width is greater than or equal to bag step (only if both have values)
        if (this.elements.bagWidth.value && this.elements.bagStep.value && bagWidth > 0 && bagStep > 0 && bagWidth < bagStep) {
            this.showValidationError('bagWidth', 'Bag width must be greater than or equal to bag step');
            isValid = false;
        }
        
        return isValid;
    }

    showValidationError(fieldId, message) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        const inputElement = this.elements[fieldId];
        
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = message ? 'block' : 'none';
        }
        
        if (inputElement) {
            if (message) {
                inputElement.classList.add('validation-error');
                inputElement.classList.remove('validation-success');
            } else {
                inputElement.classList.remove('validation-error');
                inputElement.classList.remove('validation-success');
            }
        }
    }

    clearValidationErrors() {
        const errorElements = document.querySelectorAll('.validation-error');
        errorElements.forEach(element => {
            element.style.display = 'none';
            element.textContent = '';
        });
        
        // Clear validation CSS classes from all form inputs
        const formInputs = document.querySelectorAll('.form-group input, .form-group select');
        formInputs.forEach(input => {
            input.classList.remove('validation-error', 'validation-success');
        });
    }

    validateFieldFormats() {
        // Validate article code format
        const articleCode = this.elements.articleCode.value.trim();
        if (articleCode) {
            const articleCodePattern = /^(P0|P9|ISP|BLKC)\w+$/;
            if (!articleCodePattern.test(articleCode)) {
                this.showValidationError('articleCode', 'Article code must follow format: P0XXXX, P9XXXX, ISPXXXXX, or BLKCXXXX');
            }
        }
        
        // Validate production lot format
        const productionLot = this.elements.productionLot.value.trim();
        if (productionLot) {
            const lotPattern = /^AAPU\d{3}$/;
            if (!lotPattern.test(productionLot)) {
                this.showValidationError('productionLot', 'Production lot must follow format: AAPU###');
            }
        }
    }

    validateFieldFormat(input) {
        const fieldId = input.id;
        const value = input.value.trim();
        
        // Clear previous error for this field
        this.showValidationError(fieldId, '');
        
        if (!value) return; // Skip validation for empty fields
        
        switch (fieldId) {
            case 'articleCode':
                const articleCodePattern = /^(P0|P9|ISP|BLKC)\w+$/;
                if (!articleCodePattern.test(value)) {
                    this.showValidationError(fieldId, 'Article code must follow format: P0XXXX, P9XXXX, ISPXXXXX, or BLKCXXXX');
                }
                break;
                
            case 'productionLot':
                const lotPattern = /^AAPU\d{3}$/;
                if (!lotPattern.test(value)) {
                    this.showValidationError(fieldId, 'Production lot must follow format: AAPU###');
                }
                break;
        }
    }

    calculateProduction() {
        console.log('calculateProduction called');
        const odpData = this.collectODPFormData();
        console.log('Collected ODP data:', odpData);
        
        if (!this.validateODPData(odpData)) {
            console.log('Validation failed');
            return;
        }

        try {
            console.log('Performing calculations...');
            const calculation = this.performODPCalculations(odpData);
            console.log('Calculation result:', calculation);
            this.displayODPResults(calculation);
            this.currentCalculation = calculation;
            this.elements.createTaskBtn.disabled = false;
            console.log('Calculation completed successfully');
        } catch (error) {
            console.error('ODP Calculation error:', error);
            this.showMessage('Calculation failed: ' + error.message, 'error');
        }
    }

    collectODPFormData() {
        return {
            // IDENTIFICAZIONE
            odp_number: this.elements.odpNumber.value.trim(),
            article_code: this.elements.articleCode.value.trim(),
            production_lot: this.elements.productionLot.value.trim(),
            work_center: this.elements.workCenter.value,
            
            // SPECIFICHE TECNICHE
            bag_height: parseInt(this.elements.bagHeight.value) || 0,
            bag_width: parseInt(this.elements.bagWidth.value) || 0,
            bag_step: parseInt(this.elements.bagStep.value) || 0,
            seal_sides: parseInt(this.elements.sealSides.value) || 3,
            product_type: this.elements.productType.value,
            quantity: parseInt(this.elements.quantity.value) || 0,
            
            // PIANIFICAZIONE
            production_start: this.elements.productionStart.value,
            delivery_date: this.elements.deliveryDate.value,
            
            // DATI COMMERCIALI
            internal_customer_code: this.elements.internalCustomerCode.value.trim(),
            external_customer_code: this.elements.externalCustomerCode.value.trim(),
            customer_order_ref: this.elements.customerOrderRef.value.trim(),
            
            // DATI LAVORAZIONE
            tipo_lavorazione: this.elements.tipoLavorazione.value,
            fase: this.elements.fase.value
        };
    }

    validateODPData(odpData) {
        console.log('Validating ODP data:', odpData);
        
        // For calculation, we only need the essential fields, not all fields
        if (!odpData.bag_height || !odpData.bag_width || !odpData.bag_step || !odpData.quantity) {
            this.showMessage('Please fill in all technical specifications (bag height, width, step, quantity)', 'error');
            return false;
        }
        
        if (!odpData.tipo_lavorazione || !odpData.fase) {
            this.showMessage('Please select processing type and phase', 'error');
            return false;
        }
        
        // Validate numeric values (only if they have values)
        if (odpData.bag_height <= 0 || odpData.bag_width <= 0 || odpData.bag_step <= 0 || odpData.quantity <= 0) {
            this.showMessage('All numeric values must be greater than 0', 'error');
            return false;
        }
        
        // Validate bag dimensions make sense
        if (odpData.bag_width < odpData.bag_step) {
            this.showMessage('Bag width must be greater than or equal to bag step', 'error');
            return false;
        }
        
        // Validate dates if both are provided
        if (odpData.production_start && odpData.delivery_date) {
            const startDate = new Date(odpData.production_start);
            const deliveryDate = new Date(odpData.delivery_date);
            
            if (startDate >= deliveryDate) {
                this.showMessage('Production start date must be before delivery date', 'error');
                return false;
            }
        }
        
        // Only validate article code and production lot if they are provided
        if (odpData.article_code) {
            const articleCodePattern = /^(P0|P9|ISP|BLKC)\w+$/;
            if (!articleCodePattern.test(odpData.article_code)) {
                this.showMessage('Article code must follow format: P0XXXX, P9XXXX, ISPXXXXX, or BLKCXXXX', 'error');
                return false;
            }
        }
        
        if (odpData.production_lot) {
            const lotPattern = /^AAPU\d{3}$/;
            if (!lotPattern.test(odpData.production_lot)) {
                this.showMessage('Production lot must follow format: AAPU###', 'error');
                return false;
            }
        }
        
        console.log('Validation passed');
        return true;
    }

    performODPCalculations(odpData) {
        // Get the selected phase for calculations
        const selectedPhase = this.storageService.getPhaseById(odpData.fase);
        if (!selectedPhase) {
            throw new Error('Selected phase not found');
        }

        const result = {
            materialQuantity: 0,
            printing: { time: 0, cost: 0 },
            packaging: { time: 0, cost: 0 },
            total: { duration: 0, cost: 0 }
        };

        // Calculate material quantity: MQ_INCARTO = MT_LINEARI * (FASCIA / 1000)
        const mtLineari = (odpData.quantity * odpData.bag_step) / 1000;
        const fascia = odpData.bag_width;
        result.materialQuantity = Utils.calculateMaterialQuantity(mtLineari, fascia);

        // Calculate based on processing type
        if (odpData.tipo_lavorazione === 'printing') {
            // Printing calculations using phase parameters
            const vStampa = selectedPhase.V_STAMPA || 0; // mt/min
            const tSetupStampa = selectedPhase.T_SETUP_STAMPA || 0; // minutes
            const costoHStampa = selectedPhase.COSTO_H_STAMPA || 0; // €/h

            if (vStampa > 0) {
                // Calculate printing time in minutes
                const tStampaMin = mtLineari / vStampa;
                result.printing.time = tStampaMin;
                
                // Calculate printing cost using precise formula
                result.printing.cost = Utils.calculatePrintingCost(tStampaMin, tSetupStampa, costoHStampa);
            }
        } else if (odpData.tipo_lavorazione === 'packaging') {
            // Packaging calculations using phase parameters
            const vConf = selectedPhase.V_CONF || 0; // pz/h
            const tSetupConf = selectedPhase.T_SETUP_CONF || 0; // minutes
            const costoHConf = selectedPhase.COSTO_H_CONF || 0; // €/h

            if (vConf > 0) {
                // Calculate packaging time in hours
                const tConfOre = odpData.quantity / vConf;
                result.packaging.time = tConfOre;
                
                // Calculate packaging cost using precise formula
                result.packaging.cost = Utils.calculatePackagingCost(tConfOre, tSetupConf, costoHConf);
            }
        }

        // Calculate totals
        result.total.duration = result.printing.time + result.packaging.time;
        result.total.cost = result.printing.cost + result.packaging.cost;

        return result;
    }

    displayODPResults(calculation) {
        // Display material quantity
        this.elements.materialQuantity.textContent = `${calculation.materialQuantity.toFixed(2)} m²`;
        
        // Display printing results
        if (calculation.printing.time > 0) {
            this.elements.printingTime.textContent = `${calculation.printing.time.toFixed(2)} min`;
            this.elements.printingCost.textContent = `€${calculation.printing.cost.toFixed(2)}`;
        } else {
            this.elements.printingTime.textContent = '-';
            this.elements.printingCost.textContent = '-';
        }
        
        // Display packaging results
        if (calculation.packaging.time > 0) {
            this.elements.packagingTime.textContent = `${calculation.packaging.time.toFixed(2)} h`;
            this.elements.packagingCost.textContent = `€${calculation.packaging.cost.toFixed(2)}`;
        } else {
            this.elements.packagingTime.textContent = '-';
            this.elements.packagingCost.textContent = '-';
        }
        
        // Display totals
        this.elements.totalDuration.textContent = `${calculation.total.duration.toFixed(2)} h`;
        this.elements.totalCost.textContent = `€${calculation.total.cost.toFixed(2)}`;
        
        this.elements.calculationResults.style.display = 'block';
    }

    addToBacklog() {
        if (!this.currentCalculation) {
            this.showMessage('Please calculate first', 'error');
            return;
        }

        const odpData = this.collectODPFormData();
        
        // Create ODP order with calculated values
        const odpOrder = {
            ...odpData,
            duration: this.currentCalculation.total.duration,
            cost: this.currentCalculation.total.cost,
            status: 'DRAFT',
            title: `${odpData.article_code} - ${odpData.production_lot}`,
            description: `${odpData.tipo_lavorazione} production order`,
            priority: 'medium'
        };

        try {
            // Add ODP order to storage
            const newOrder = this.storageService.addODPOrder(odpOrder);
            
            this.showMessage(`ODP Order ${newOrder.odp_number} added to backlog`, 'success');
            this.clearForm();
            this.loadBacklog();
        } catch (error) {
            this.showMessage('Error adding ODP to backlog: ' + error.message, 'error');
        }
    }

    clearForm() {
        this.clearFormFields();
        this.elements.calculationResults.style.display = 'none';
        this.elements.createTaskBtn.disabled = true;
        this.currentCalculation = null;
        this.validateForm();
        this.updatePreview(); // Reset preview
    }

    loadBacklog() {
        const odpOrders = this.storageService.getODPOrders();
        this.renderBacklog(odpOrders);
    }

    renderData() {
        this.loadBacklog();
    }

    renderBacklog(orders) {
        const tableBody = this.elements.backlogTableBody;
        
        if (!orders || orders.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center" style="padding: 2rem; color: #6b7280;">
                        No ODP orders found. Create production orders to get started.
                    </td>
                </tr>
            `;
            return;
        }

        // Get existing rows for comparison
        const existingRows = Array.from(tableBody.querySelectorAll('tr[data-task-id]'));
        const existingIds = new Set(existingRows.map(row => row.dataset.taskId));
        const newIds = new Set(orders.map(order => String(order.id)));

        // Remove rows that no longer exist
        existingRows.forEach(row => {
            const taskId = row.dataset.taskId;
            if (!newIds.has(taskId)) {
                row.remove();
            }
        });

        // Update existing rows or add new ones
        orders.forEach(order => {
            const orderId = String(order.id);
            const existingRow = tableBody.querySelector(`tr[data-task-id="${orderId}"]`);
            
            if (existingRow) {
                // Update existing row incrementally
                this.updateTaskRow(existingRow, order);
            } else {
                // Add new row
                const newRow = this.createTaskRowElement(order);
                tableBody.appendChild(newRow);
            }
        });
    }

    updateTaskRow(row, order) {
        // Update only the cells that have changed
        const cells = row.querySelectorAll('.editable-cell');
        
        cells.forEach(cell => {
            const field = cell.dataset.field;
            const staticValue = cell.querySelector('.static-value');
            const editInput = cell.querySelector('.edit-input, .edit-select');
            
            if (!staticValue || !editInput) return;
            
            let newValue = order[field];
            
            // Format dates for display
            if (field === 'delivery_date' && newValue) {
                newValue = new Date(newValue).toLocaleDateString();
            } else if (field === 'production_start' && newValue) {
                newValue = new Date(newValue).toLocaleDateString();
            } else if (field === 'fase') {
                newValue = this.getPhaseName(newValue);
            }
            
            // Only update if value has changed
            if (staticValue.textContent !== String(newValue || '-')) {
                staticValue.textContent = newValue || '-';
                
                // Update edit input as well
                if (editInput.tagName === 'INPUT') {
                    editInput.value = order[field] || '';
                } else if (editInput.tagName === 'SELECT') {
                    editInput.value = order[field] || '';
                }
            }
        });
    }

    createTaskRowElement(order) {
        const row = document.createElement('tr');
        row.dataset.taskId = order.id;
        row.innerHTML = this.createTaskRow(order);
        return row;
    }

    createTaskRow(order) {
        const deliveryDate = order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : '-';
        const productionStart = order.production_start ? new Date(order.production_start).toLocaleDateString() : '-';
        const statusClass = order.status === 'DRAFT' ? 'status-draft' : order.status === 'IN_PROGRESS' ? 'status-progress' : 'status-completed';
        
        return `
            <tr data-task-id="${order.id}">
                <td class="editable-cell" data-field="odp_number">
                    <span class="static-value"><strong>${order.odp_number}</strong></span>
                    ${this.editManager.createEditInput('text', order.odp_number)}
                </td>
                <td class="editable-cell" data-field="article_code">
                    <span class="static-value">${order.article_code}</span>
                    ${this.editManager.createEditInput('text', order.article_code)}
                </td>
                <td class="editable-cell" data-field="production_lot">
                    <span class="static-value">${order.production_lot}</span>
                    ${this.editManager.createEditInput('text', order.production_lot)}
                </td>
                <td class="editable-cell" data-field="work_center">
                    <span class="static-value">${order.work_center}</span>
                    ${this.editManager.createEditInput('select', order.work_center, {
                        options: [
                            { value: 'ZANICA', label: 'ZANICA' },
                            { value: 'BUSTO_GAROLFO', label: 'BUSTO GAROLFO' }
                        ]
                    })}
                </td>
                <td class="editable-cell" data-field="bag_height">
                    <span class="static-value">${order.bag_height || '-'}</span>
                    ${this.editManager.createEditInput('number', order.bag_height, { min: 1 })}
                </td>
                <td class="editable-cell" data-field="bag_width">
                    <span class="static-value">${order.bag_width || '-'}</span>
                    ${this.editManager.createEditInput('number', order.bag_width, { min: 1 })}
                </td>
                <td class="editable-cell" data-field="bag_step">
                    <span class="static-value">${order.bag_step || '-'}</span>
                    ${this.editManager.createEditInput('number', order.bag_step, { min: 1 })}
                </td>
                <td class="editable-cell" data-field="seal_sides">
                    <span class="static-value">${order.seal_sides || '-'}</span>
                    ${this.editManager.createEditInput('select', order.seal_sides, {
                        options: [
                            { value: '3', label: '3 sides' },
                            { value: '4', label: '4 sides' }
                        ]
                    })}
                </td>
                <td class="editable-cell" data-field="product_type">
                    <span class="static-value">${order.product_type || '-'}</span>
                    ${this.editManager.createEditInput('select', order.product_type, {
                        options: [
                            { value: 'LIQUID', label: 'Liquid' },
                            { value: 'POWDER', label: 'Powder' }
                        ]
                    })}
                </td>
                <td class="editable-cell" data-field="quantity">
                    <span class="static-value">${order.quantity || '-'}</span>
                    ${this.editManager.createEditInput('number', order.quantity, { min: 1 })}
                </td>
                <td class="editable-cell" data-field="production_start">
                    <span class="static-value">${productionStart}</span>
                    ${this.editManager.createEditInput('datetime-local', order.production_start)}
                </td>
                <td class="editable-cell" data-field="delivery_date">
                    <span class="static-value">${deliveryDate}</span>
                    ${this.editManager.createEditInput('date', order.delivery_date)}
                </td>
                <td class="editable-cell" data-field="internal_customer_code">
                    <span class="static-value">${order.internal_customer_code || '-'}</span>
                    ${this.editManager.createEditInput('text', order.internal_customer_code)}
                </td>
                <td class="editable-cell" data-field="external_customer_code">
                    <span class="static-value">${order.external_customer_code || '-'}</span>
                    ${this.editManager.createEditInput('text', order.external_customer_code)}
                </td>
                <td class="editable-cell" data-field="customer_order_ref">
                    <span class="static-value">${order.customer_order_ref || '-'}</span>
                    ${this.editManager.createEditInput('text', order.customer_order_ref)}
                </td>
                <td class="editable-cell" data-field="tipo_lavorazione">
                    <span class="static-value">
                        <span class="btn btn-primary" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                            ${order.tipo_lavorazione}
                        </span>
                    </span>
                    ${this.editManager.createEditInput('select', order.tipo_lavorazione, {
                        options: [
                            { value: 'printing', label: 'Printing' },
                            { value: 'packaging', label: 'Packaging' }
                        ]
                    })}
                </td>
                <td class="editable-cell" data-field="fase">
                    <span class="static-value">${this.getPhaseName(order.fase) || '-'}</span>
                    ${this.editManager.createEditInput('text', order.fase)}
                </td>
                <td class="editable-cell" data-field="duration">
                    <span class="static-value">${order.duration ? order.duration.toFixed(2) + 'h' : '-'}</span>
                    ${this.editManager.createEditInput('number', order.duration, { min: 0.1, step: 0.1 })}
                </td>
                <td class="editable-cell" data-field="cost">
                    <span class="static-value">€${order.cost ? order.cost.toFixed(2) : '-'}</span>
                    ${this.editManager.createEditInput('number', order.cost, { min: 0, step: 0.01 })}
                </td>
                <td class="editable-cell" data-field="status">
                    <span class="static-value">
                        <span class="status-badge ${statusClass}">${order.status}</span>
                    </span>
                    ${this.editManager.createEditInput('select', order.status, {
                        options: [
                            { value: 'DRAFT', label: 'Draft' },
                            { value: 'IN_PROGRESS', label: 'In Progress' },
                            { value: 'COMPLETED', label: 'Completed' }
                        ]
                    })}
                </td>
                <td class="text-center">
                    ${this.editManager.createActionButtons()}
                </td>
            </tr>
        `;
    }

    deleteTask(taskId) {
        console.log('deleteTask called with taskId:', taskId);
        const order = this.storageService.getODPOrderById(taskId);
        console.log('Order found:', order);
        
        try {
            // Check if order can be deleted (not scheduled on Gantt)
            this.storageService.validateTaskCanBeDeleted(taskId);
            
            const message = order ? 
                `Are you sure you want to delete ODP "${order.odp_number}"? This action cannot be undone.` :
                'Are you sure you want to delete this ODP order? This action cannot be undone.';
                
            console.log('About to call showDeleteConfirmation with message:', message);
            showDeleteConfirmation(message, () => {
                console.log('Delete confirmation callback executed');
                try {
                    this.storageService.removeODPOrder(taskId);
                    this.loadBacklog();
                    this.showMessage('ODP order deleted successfully', 'success');
                } catch (error) {
                    this.showMessage('Error deleting ODP order: ' + error.message, 'error');
                }
            });
        } catch (error) {
            // Order is scheduled - show specific error
            this.showMessage(error.message + ' Move the order back to the pool first.', 'error');
        }
    }

    toggleEdit(taskId) {
        const row = document.querySelector(`tr[data-task-id="${taskId}"]`);
        if (!row) return;

        const isEditing = row.classList.contains('editing');
        
        if (isEditing) {
            this.cancelEdit(taskId);
        } else {
            this.startEdit(taskId);
        }
    }

    startEdit(taskId) {
        const row = document.querySelector(`tr[data-task-id="${taskId}"]`);
        if (!row) return;

        // Store original values for cancel
        const originalData = {};
        row.querySelectorAll('.editable-cell').forEach(cell => {
            const field = cell.dataset.field;
            const staticValue = cell.querySelector('.static-value');
            originalData[field] = staticValue.textContent.trim();
        });
        row.dataset.originalData = JSON.stringify(originalData);

        // Show edit mode
        row.classList.add('editing');
        row.querySelectorAll('.static-value').forEach(el => el.style.display = 'none');
        row.querySelectorAll('.edit-input, .edit-select').forEach(el => el.style.display = 'block');
        row.querySelectorAll('.edit-color-container').forEach(el => el.style.display = 'block');
        row.querySelector('.action-buttons').style.display = 'none';
        row.querySelector('.save-cancel-buttons').style.display = 'block';

        // Focus first input
        const firstInput = row.querySelector('.edit-input, .edit-select');
        if (firstInput) firstInput.focus();

        // Add keyboard event listeners
        row.querySelectorAll('.edit-input, .edit-select').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.saveEdit(taskId);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelEdit(taskId);
                }
            });
        });
    }

    cancelEdit(taskId) {
        const row = document.querySelector(`tr[data-task-id="${taskId}"]`);
        if (!row) return;

        // Restore original values
        const originalData = JSON.parse(row.dataset.originalData || '{}');
        row.querySelectorAll('.editable-cell').forEach(cell => {
            const field = cell.dataset.field;
            const staticValue = cell.querySelector('.static-value');
            if (originalData[field]) {
                staticValue.textContent = originalData[field];
            }
        });

        // Hide edit mode
        row.classList.remove('editing');
        row.querySelectorAll('.static-value').forEach(el => el.style.display = 'block');
        row.querySelectorAll('.edit-input, .edit-select').forEach(el => el.style.display = 'none');
        row.querySelectorAll('.edit-color-container').forEach(el => el.style.display = 'none');
        row.querySelector('.action-buttons').style.display = 'block';
        row.querySelector('.save-cancel-buttons').style.display = 'none';
    }

    saveEdit(row) {
        const taskId = row.dataset.taskId;
        if (!taskId) {
            console.error('No task ID found in row');
            return;
        }

        // Collect edited values using the edit manager
        const updatedData = this.editManager.collectEditedValues(row);

        console.log('Collected updated data:', updatedData);

        // Try to find the task as an ODP order first
        const task = this.storageService.getODPOrderById(taskId);

        if (!task) {
            this.showMessage('Task not found', 'error');
            return;
        }

        try {
            // Handle ODP order updates
            const updatedOrder = {
                ...task,
                odp_number: updatedData.odp_number?.trim() || task.odp_number,
                article_code: updatedData.article_code?.trim() || task.article_code,
                production_lot: updatedData.production_lot?.trim() || task.production_lot,
                work_center: updatedData.work_center || task.work_center,
                bag_height: parseFloat(updatedData.bag_height) || task.bag_height,
                bag_width: parseFloat(updatedData.bag_width) || task.bag_width,
                bag_step: parseFloat(updatedData.bag_step) || task.bag_step,
                seal_sides: updatedData.seal_sides || task.seal_sides,
                product_type: updatedData.product_type || task.product_type,
                quantity: parseFloat(updatedData.quantity) || task.quantity,
                production_start: updatedData.production_start || task.production_start,
                delivery_date: updatedData.delivery_date || task.delivery_date,
                internal_customer_code: updatedData.internal_customer_code?.trim() || task.internal_customer_code,
                external_customer_code: updatedData.external_customer_code?.trim() || task.external_customer_code,
                customer_order_ref: updatedData.customer_order_ref?.trim() || task.customer_order_ref,
                tipo_lavorazione: updatedData.tipo_lavorazione || task.tipo_lavorazione,
                fase: updatedData.fase || task.fase,
                duration: parseFloat(updatedData.duration) || task.duration,
                cost: parseFloat(updatedData.cost) || task.cost,
                status: updatedData.status || task.status
            };

            // Validate required fields for ODP orders
            if (!updatedOrder.odp_number || updatedOrder.odp_number.trim() === '') {
                this.showMessage('ODP number cannot be empty', 'error');
                return;
            }

            if (!updatedOrder.article_code || updatedOrder.article_code.trim() === '') {
                this.showMessage('Article code cannot be empty', 'error');
                return;
            }

            console.log('Original ODP order:', task);
            console.log('Updated ODP order:', updatedOrder);

            // Update ODP order
            this.storageService.updateODPOrder(taskId, updatedOrder);

            // Exit edit mode
            this.editManager.cancelEdit(row);

            // Update display
            this.loadBacklog();
            this.showMessage('Task updated successfully', 'success');

        } catch (error) {
            this.showMessage('Error updating task: ' + error.message, 'error');
        }
    }


}

// Initialize when DOM is loaded and storage service is available
document.addEventListener('DOMContentLoaded', () => {
    // Wait for storage service to be available
    const initializeManager = () => {
        if (window.storageService) {
            window.newBacklogManager = new NewBacklogManager();
        } else {
            // If storage service not ready, wait a bit and try again
            setTimeout(initializeManager, 50);
        }
    };
    
    initializeManager();
});