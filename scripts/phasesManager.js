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
        console.log('Loading phases:', phases.length, 'phases found');
        this.renderPhases(phases);
    }

    renderPhases(phases) {
        if (!phases || phases.length === 0) {
            this.elements.phasesTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center" style="padding: 2rem; color: #6b7280;">
                        No phases found. Add phases to get started.
                    </td>
                </tr>
            `;
            return;
        }

        this.elements.phasesTableBody.innerHTML = phases.map(phase => this.createPhaseRow(phase)).join('');
    }

    createPhaseRow(phase) {
        return `
            <tr data-phase-id="${phase.id}">
                <td class="editable-cell" data-field="name">
                    <span class="static-value">${phase.name}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', phase.name) : ''}
                </td>
                <td class="editable-cell" data-field="type">
                    <span class="static-value">
                        <span class="btn btn-primary" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                            ${phase.type}
                        </span>
                    </span>
                    ${this.editManager ? this.editManager.createEditInput('select', phase.type, {
                        options: [
                            { value: 'printing', label: 'Printing' },
                            { value: 'packaging', label: 'Packaging' }
                        ]
                    }) : ''}
                </td>
                <td class="editable-cell" data-field="V_STAMPA">
                    <span class="static-value">${phase.V_STAMPA || 0} mt/min</span>
                    ${this.editManager ? this.editManager.createEditInput('number', phase.V_STAMPA || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="T_SETUP_STAMPA">
                    <span class="static-value">${phase.T_SETUP_STAMPA || 0} min</span>
                    ${this.editManager ? this.editManager.createEditInput('number', phase.T_SETUP_STAMPA || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="COSTO_H_STAMPA">
                    <span class="static-value">€${phase.COSTO_H_STAMPA || 0}/h</span>
                    ${this.editManager ? this.editManager.createEditInput('number', phase.COSTO_H_STAMPA || 0, { min: 0, step: 0.01 }) : ''}
                </td>
                <td class="editable-cell" data-field="V_CONF">
                    <span class="static-value">${phase.V_CONF || 0} pz/h</span>
                    ${this.editManager ? this.editManager.createEditInput('number', phase.V_CONF || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="T_SETUP_CONF">
                    <span class="static-value">${phase.T_SETUP_CONF || 0} min</span>
                    ${this.editManager ? this.editManager.createEditInput('number', phase.T_SETUP_CONF || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="COSTO_H_CONF">
                    <span class="static-value">€${phase.COSTO_H_CONF || 0}/h</span>
                    ${this.editManager ? this.editManager.createEditInput('number', phase.COSTO_H_CONF || 0, { min: 0, step: 0.01 }) : ''}
                </td>
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

    validatePhaseNumericFields(phaseData) {
        const fieldLabels = {
            V_STAMPA: 'Printing speed',
            T_SETUP_STAMPA: 'Printing setup time',
            COSTO_H_STAMPA: 'Printing hourly cost',
            V_CONF: 'Packaging speed',
            T_SETUP_CONF: 'Packaging setup time',
            COSTO_H_CONF: 'Packaging hourly cost'
        };

        if (phaseData.type === 'printing') {
            return Utils.validateNumericFields(['V_STAMPA', 'T_SETUP_STAMPA', 'COSTO_H_STAMPA'], phaseData, fieldLabels);
        } else if (phaseData.type === 'packaging') {
            return Utils.validateNumericFields(['V_CONF', 'T_SETUP_CONF', 'COSTO_H_CONF'], phaseData, fieldLabels);
        }
        
        return { isValid: true, errors: [] };
    }

    handleAddPhase() {
        const phaseData = this.collectPhaseData();
        
        if (!phaseData) {
            this.showMessage('Please fill in all required fields', 'error');
            return;
        }

        // Validate numeric fields are non-negative
        const numericValidation = this.validatePhaseNumericFields(phaseData);
        if (!numericValidation.isValid) {
            this.showMessage(numericValidation.errors.join(', '), 'error');
            return;
        }

        try {
            const newPhase = this.storageService.addPhase(phaseData);
            this.clearPhaseForm();
            this.loadPhases();
            this.showMessage(`Phase "${newPhase.name}" added successfully!`, 'success');
        } catch (error) {
            this.showMessage('Error adding phase: ' + error.message, 'error');
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
                T_SETUP_STAMPA: parseInt(this.elements.tSetupStampa.value),
                COSTO_H_STAMPA: parseFloat(this.elements.costoHStampa.value)
            };
        } else if (phaseType === 'packaging') {
            return {
                ...baseData,
                V_CONF: parseInt(this.elements.vConf.value),
                T_SETUP_CONF: parseInt(this.elements.tSetupConf.value),
                COSTO_H_CONF: parseFloat(this.elements.costoHConf.value)
            };
        }

        return null;
    }

    clearPhaseForm() {
        this.elements.phaseName.value = '';
        this.elements.phaseType.value = '';
        this.elements.vStampa.value = '';
        this.elements.tSetupStampa.value = '';
        this.elements.costoHStampa.value = '';
        this.elements.vConf.value = '';
        this.elements.tSetupConf.value = '';
        this.elements.costoHConf.value = '';
        
        this.elements.printingParams.style.display = 'none';
        this.elements.packagingParams.style.display = 'none';
        
        this.validatePhaseForm();
    }

    saveEdit(row) {
        const phaseId = row.dataset.phaseId;
        if (!phaseId) {
            console.error('No phase ID found in row');
            return;
        }

        // Collect edited values using the edit manager
        const updatedData = this.editManager.collectEditedValues(row);

        console.log('Collected updated phase data:', updatedData);

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
                T_SETUP_STAMPA: parseInt(updatedData.T_SETUP_STAMPA) || phase.T_SETUP_STAMPA,
                COSTO_H_STAMPA: parseFloat(updatedData.COSTO_H_STAMPA) || phase.COSTO_H_STAMPA,
                V_CONF: parseInt(updatedData.V_CONF) || phase.V_CONF,
                T_SETUP_CONF: parseInt(updatedData.T_SETUP_CONF) || phase.T_SETUP_CONF,
                COSTO_H_CONF: parseFloat(updatedData.COSTO_H_CONF) || phase.COSTO_H_CONF
            };

            console.log('Original phase:', phase);
            console.log('Updated phase:', updatedPhase);

            // Validate numeric fields are non-negative
            const numericValidation = this.validatePhaseNumericFields(updatedPhase);
            if (!numericValidation.isValid) {
                this.showMessage(numericValidation.errors.join(', '), 'error');
                return;
            }

            // Update phase
            this.storageService.updatePhase(phaseId, updatedPhase);

            // Exit edit mode
            this.editManager.cancelEdit(row);

            // Update display
            this.loadPhases();
            this.showMessage('Phase updated successfully', 'success');

        } catch (error) {
            this.showMessage('Error updating phase: ' + error.message, 'error');
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
                this.showMessage('Phase deleted successfully', 'success');
            } catch (error) {
                this.showMessage('Error deleting phase: ' + error.message, 'error');
            }
        });
    }
}

// Initialize when DOM is loaded and storage service is available
document.addEventListener('DOMContentLoaded', () => {
    // Wait for storage service to be available
    const initializeManager = () => {
        if (window.storageService) {
            window.phasesManager = new PhasesManager();
        } else {
            // If storage service not ready, wait a bit and try again
            setTimeout(initializeManager, 50);
        }
    };
    
    initializeManager();
}); 