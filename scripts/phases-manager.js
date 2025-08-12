/**
 * Phases Manager - Handles production phases management
 */
class PhasesManager extends BaseManager {
    constructor() {
        super(window.storageService);
        this.editManager = window.editManager;
        this.init();
    }

    init() {
        if (!this.validateStorageService()) return;
        
        if (super.init(this.getElementMap())) {
            this.loadPhases();
            this.setupFormValidation();
            
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
                        const phaseId = row.dataset.phaseId;
                        if (phaseId) {
                            this.deletePhase(phaseId);
                        }
                    });
                }
            }
        }
    }

    getElementMap() {
        return {
            // Phase Management elements
            phaseName: document.getElementById('phaseName'),
            phaseType: document.getElementById('phaseType'),
            addPhaseBtn: document.getElementById('addPhaseBtn'),
            printingParams: document.getElementById('printingParams'),
            packagingParams: document.getElementById('packagingParams'),
            vStampa: document.getElementById('vStampa'),
            tSetupStampa: document.getElementById('tSetupStampa'),
            costoHStampa: document.getElementById('costoHStampa'),
            vConf: document.getElementById('vConf'),
            tSetupConf: document.getElementById('tSetupConf'),
            costoHConf: document.getElementById('costoHConf'),
            phasesTableBody: document.getElementById('phases-table-body')
        };
    }

    attachEventListeners() {
        // Phase management event listeners
        if (this.elements.addPhaseBtn) {
            this.elements.addPhaseBtn.addEventListener('click', () => this.handleAddPhase());
        }

        if (this.elements.phaseType) {
            this.elements.phaseType.addEventListener('change', () => this.handlePhaseTypeChange());
        }

        // Phase form validation
        const phaseInputs = [
            this.elements.phaseName, this.elements.vStampa, this.elements.tSetupStampa, this.elements.costoHStampa,
            this.elements.vConf, this.elements.tSetupConf, this.elements.costoHConf
        ];

        phaseInputs.forEach(input => {
            if (input) {
                input.addEventListener('input', () => this.validatePhaseForm());
                input.addEventListener('change', () => this.validatePhaseForm());
            }
        });
    }

    setupFormValidation() {
        this.validatePhaseForm();
    }

    loadPhases() {
        const phases = this.storageService.getPhases();

        this.renderPhases(phases);
    }

    renderPhases(phases) {
        if (!phases || phases.length === 0) {
            this.elements.phasesTableBody.innerHTML = `
                <tr>
                    <td colspan="12" class="text-center" style="padding: 2rem; color: #6b7280;">
                        No phases found. Add phases to get started.
                    </td>
                </tr>
            `;
            return;
        }

        this.elements.phasesTableBody.innerHTML = phases.map(phase => this.createPhaseRow(phase)).join('');
    }

    createPhaseRow(phase) {
        const createdDate = phase.created_at ? new Date(phase.created_at).toLocaleDateString() : '-';
        const updatedDate = phase.updated_at ? new Date(phase.updated_at).toLocaleDateString() : '-';
        
        return `
            <tr data-phase-id="${phase.id}">
                <!-- IDENTIFICAZIONE (Identification) -->
                <td class="editable-cell" data-field="id">
                    <span class="static-value">${phase.id}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', phase.id) : ''}
                </td>
                <td class="editable-cell" data-field="name">
                    <span class="static-value">${phase.name || '-'}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', phase.name) : ''}
                </td>
                <td class="editable-cell" data-field="type">
                    <span class="static-value">
                        <span class="btn btn-primary" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                            ${phase.type || '-'}
                        </span>
                    </span>
                    ${this.editManager ? this.editManager.createEditInput('select', phase.type, {
                        options: [
                            { value: 'printing', label: 'Printing' },
                            { value: 'packaging', label: 'Packaging' }
                        ]
                    }) : ''}
                </td>
                
                <!-- PRINTING PARAMETERS -->
                <td class="editable-cell" data-field="V_STAMPA">
                    <span class="static-value">${phase.V_STAMPA || 0} mt/h</span>
                    ${this.editManager ? this.editManager.createEditInput('number', phase.V_STAMPA || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="T_SETUP_STAMPA">
                    <span class="static-value">${phase.T_SETUP_STAMPA || 0} h</span>
                    ${this.editManager ? this.editManager.createEditInput('number', phase.T_SETUP_STAMPA || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="COSTO_H_STAMPA">
                    <span class="static-value">€${phase.COSTO_H_STAMPA || 0}/h</span>
                    ${this.editManager ? this.editManager.createEditInput('number', phase.COSTO_H_STAMPA || 0, { min: 0, step: 0.01 }) : ''}
                </td>
                
                <!-- PACKAGING PARAMETERS -->
                <td class="editable-cell" data-field="V_CONF">
                    <span class="static-value">${phase.V_CONF || 0} pz/h</span>
                    ${this.editManager ? this.editManager.createEditInput('number', phase.V_CONF || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="T_SETUP_CONF">
                    <span class="static-value">${phase.T_SETUP_CONF || 0} h</span>
                    ${this.editManager ? this.editManager.createEditInput('number', phase.T_SETUP_CONF || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="COSTO_H_CONF">
                    <span class="static-value">€${phase.COSTO_H_CONF || 0}/h</span>
                    ${this.editManager ? this.editManager.createEditInput('number', phase.COSTO_H_CONF || 0, { min: 0, step: 0.01 }) : ''}
                </td>
                
                <!-- TIMESTAMPS -->
                <td class="editable-cell" data-field="created_at">
                    <span class="static-value">${createdDate}</span>
                    ${this.editManager ? this.editManager.createEditInput('datetime-local', phase.created_at) : ''}
                </td>
                <td class="editable-cell" data-field="updated_at">
                    <span class="static-value">${updatedDate}</span>
                    ${this.editManager ? this.editManager.createEditInput('datetime-local', phase.updated_at) : ''}
                </td>
                
                <!-- Actions -->
                <td class="text-center">
                    ${this.editManager ? this.editManager.createActionButtons() : ''}
                </td>
            </tr>
        `;
    }

    handlePhaseTypeChange() {
        const phaseType = this.elements.phaseType.value;
        
        // Hide all parameter sections
        this.elements.printingParams.style.display = 'none';
        this.elements.packagingParams.style.display = 'none';
        
        // Show relevant parameter section
        if (phaseType === 'printing') {
            this.elements.printingParams.style.display = 'block';
        } else if (phaseType === 'packaging') {
            this.elements.packagingParams.style.display = 'block';
        }
        
        this.validatePhaseForm();
    }

    validatePhaseForm() {
        const baseFields = ['phaseName', 'phaseType'];
        const baseData = {
            phaseName: this.elements.phaseName.value.trim(),
            phaseType: this.elements.phaseType.value
        };
        
        const baseValid = Utils.hasRequiredFields(baseData, baseFields);
        
        if (this.elements.phaseType.value === 'printing') {
            const printingFields = ['vStampa', 'tSetupStampa', 'costoHStampa'];
            const printingData = {
                vStampa: this.elements.vStampa.value,
                tSetupStampa: this.elements.tSetupStampa.value,
                costoHStampa: this.elements.costoHStampa.value
            };
            const printingValid = Utils.hasRequiredFields(printingData, printingFields);
            this.elements.addPhaseBtn.disabled = !(baseValid && printingValid);
        } else if (this.elements.phaseType.value === 'packaging') {
            const packagingFields = ['vConf', 'tSetupConf', 'costoHConf'];
            const packagingData = {
                vConf: this.elements.vConf.value,
                tSetupConf: this.elements.tSetupConf.value,
                costoHConf: this.elements.costoHConf.value
            };
            const packagingValid = Utils.hasRequiredFields(packagingData, packagingFields);
            this.elements.addPhaseBtn.disabled = !(baseValid && packagingValid);
        } else {
            this.elements.addPhaseBtn.disabled = true;
        }
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

    handleAddPhase() {
        // Clear previous validation errors
        this.clearValidationErrors();
        
        const phaseData = this.collectPhaseData();
        
        if (!phaseData) {
            this.showValidationError('phaseName', 'Phase name is required');
            this.showValidationError('phaseType', 'Phase type is required');
            return;
        }

        // Use consolidated validation for numeric fields
        const validationConfig = {
            numericFields: phaseData.type === 'printing' ? 
                ['V_STAMPA', 'T_SETUP_STAMPA', 'COSTO_H_STAMPA'] : 
                ['V_CONF', 'T_SETUP_CONF', 'COSTO_H_CONF'],
            fieldLabels: {
                            V_STAMPA: 'Printing speed (mt/h)',
            T_SETUP_STAMPA: 'Printing setup time (h)',
            COSTO_H_STAMPA: 'Printing hourly cost',
            V_CONF: 'Packaging speed (pz/h)',
            T_SETUP_CONF: 'Packaging setup time (h)',
            COSTO_H_CONF: 'Packaging hourly cost'
            }
        };
        
        const validation = this.validateForm(phaseData, validationConfig);
        if (!validation.isValid) {
            // Show inline validation errors
            validation.errors.forEach(error => {
                if (error.includes('Printing speed')) {
                    this.showValidationError('vStampa', error);
                } else if (error.includes('Printing setup time')) {
                    this.showValidationError('tSetupStampa', error);
                } else if (error.includes('Printing hourly cost')) {
                    this.showValidationError('costoHStampa', error);
                } else if (error.includes('Packaging speed')) {
                    this.showValidationError('vConf', error);
                } else if (error.includes('Packaging setup time')) {
                    this.showValidationError('tSetupConf', error);
                } else if (error.includes('Packaging hourly cost')) {
                    this.showValidationError('costoHConf', error);
                }
            });
            return;
        }

        try {
            const newPhase = this.storageService.addPhase(phaseData);
            this.clearPhaseForm();
            this.loadPhases();
            this.showSuccessMessage('Phase added', newPhase.name);
        } catch (error) {
            this.showErrorMessage('adding phase', error);
        }
    }

    collectPhaseData() {
        const phaseType = this.elements.phaseType.value;
        
        const baseData = {
            name: this.elements.phaseName.value.trim(),
            type: phaseType
        };

        if (phaseType === 'printing') {
            return {
                ...baseData,
                V_STAMPA: parseInt(this.elements.vStampa.value),
                T_SETUP_STAMPA: parseFloat(this.elements.tSetupStampa.value),
                COSTO_H_STAMPA: parseFloat(this.elements.costoHStampa.value)
            };
        } else if (phaseType === 'packaging') {
            return {
                ...baseData,
                V_CONF: parseInt(this.elements.vConf.value),
                T_SETUP_CONF: parseFloat(this.elements.tSetupConf.value),
                COSTO_H_CONF: parseFloat(this.elements.costoHConf.value)
            };
        }

        return null;
    }

    clearPhaseForm() {
        // Use base manager method to clear all form fields
        this.clearFormFields();
        
        // Reset specific display states
        this.elements.printingParams.style.display = 'none';
        this.elements.packagingParams.style.display = 'none';
        
        // Set default values for new phases
        if (this.elements.vStampa) this.elements.vStampa.value = '6000'; // Default printing speed mt/h
        if (this.elements.tSetupStampa) this.elements.tSetupStampa.value = '0.5'; // Default setup time h
        if (this.elements.costoHStampa) this.elements.costoHStampa.value = '50'; // Default hourly cost
        if (this.elements.vConf) this.elements.vConf.value = '1000'; // Default packaging speed pz/h
        if (this.elements.tSetupConf) this.elements.tSetupConf.value = '0.25'; // Default setup time h
        if (this.elements.costoHConf) this.elements.costoHConf.value = '40'; // Default hourly cost
        
        this.validatePhaseForm();
    }

    saveEdit(row) {
        const phaseId = row.dataset.phaseId;
        if (!phaseId) {
            console.error('No phase ID found in row');
            return;
        }

        // Use consolidated validation for edit row
        const updatedData = this.validateEditRow(
            row,
            [], // No required fields for phases edit
            ['V_STAMPA', 'T_SETUP_STAMPA', 'COSTO_H_STAMPA', 'V_CONF', 'T_SETUP_CONF', 'COSTO_H_CONF'], // Numeric fields
            {
                V_STAMPA: 'V Stampa',
                T_SETUP_STAMPA: 'T Setup Stampa', 
                COSTO_H_STAMPA: 'Costo H Stampa',
                V_CONF: 'V Conf',
                T_SETUP_CONF: 'T Setup Conf',
                COSTO_H_CONF: 'Costo H Conf'
            }
        );
        
        if (!updatedData) {
            return; // Validation failed, error already shown
        }

        try {
            // Get current phase
            const phase = this.storageService.getPhaseById(phaseId);
            if (!phase) {
                this.showMessage('Phase not found', 'error');
                return;
            }

            // Update phase with new values
            const updatedPhase = {
                ...phase,
                name: updatedData.name || phase.name,
                type: updatedData.type || phase.type,
                V_STAMPA: parseInt(updatedData.V_STAMPA) || phase.V_STAMPA,
                T_SETUP_STAMPA: parseFloat(updatedData.T_SETUP_STAMPA) || phase.T_SETUP_STAMPA,
                COSTO_H_STAMPA: parseFloat(updatedData.COSTO_H_STAMPA) || phase.COSTO_H_STAMPA,
                V_CONF: parseInt(updatedData.V_CONF) || phase.V_CONF,
                T_SETUP_CONF: parseFloat(updatedData.T_SETUP_CONF) || phase.T_SETUP_CONF,
                COSTO_H_CONF: parseFloat(updatedData.COSTO_H_CONF) || phase.COSTO_H_CONF
            };





            // Update phase
            this.storageService.updatePhase(phaseId, updatedPhase);

            // Exit edit mode
            this.editManager.cancelEdit(row);

            // Update display
            this.loadPhases();
            this.showSuccessMessage('Phase updated');

        } catch (error) {
            this.showErrorMessage('updating phase', error);
        }
    }

    deletePhase(phaseId) {
        const phase = this.storageService.getPhaseById(phaseId);
        const phaseName = phase ? phase.name : 'this phase';
        
        const message = `Are you sure you want to delete "${phaseName}"? This action cannot be undone.`;
        
        showDeleteConfirmation(message, () => {
            try {
                this.storageService.removePhase(phaseId);
                this.loadPhases();
                this.showSuccessMessage('Phase deleted');
            } catch (error) {
                this.showErrorMessage('deleting phase', error);
            }
        });
    }
}

// Initialize when DOM is loaded and storage service is available
document.addEventListener('DOMContentLoaded', () => {
    BaseManager.initializeManager(PhasesManager, 'phasesManager');
}); 