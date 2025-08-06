/**
 * Phases Manager - Handles production phases management
 */
class PhasesManager extends BaseManager {
    constructor() {
        super(window.storageService);
        this.init();
    }

    init() {
        if (super.init(this.getElementMap())) {
            this.loadPhases();
            this.setupFormValidation();
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
                <td>${phase.name}</td>
                <td>
                    <span class="btn btn-primary" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                        ${phase.type}
                    </span>
                </td>
                <td>${phase.V_STAMPA || 0} mt/min</td>
                <td>${phase.T_SETUP_STAMPA || 0} min</td>
                <td>€${phase.COSTO_H_STAMPA || 0}/h</td>
                <td>${phase.V_CONF || 0} pz/h</td>
                <td>${phase.T_SETUP_CONF || 0} min</td>
                <td>€${phase.COSTO_H_CONF || 0}/h</td>
                <td class="text-center">
                    <button class="btn btn-danger btn-sm" onclick="window.phasesManager.deletePhase('${phase.id}')">
                        Delete
                    </button>
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
        const isValid = 
            this.elements.phaseName.value.trim() &&
            this.elements.phaseType.value;
        
        if (this.elements.phaseType.value === 'printing') {
            const printingValid = 
                this.elements.vStampa.value &&
                this.elements.tSetupStampa.value &&
                this.elements.costoHStampa.value;
            this.elements.addPhaseBtn.disabled = !(isValid && printingValid);
        } else if (this.elements.phaseType.value === 'packaging') {
            const packagingValid = 
                this.elements.vConf.value &&
                this.elements.tSetupConf.value &&
                this.elements.costoHConf.value;
            this.elements.addPhaseBtn.disabled = !(isValid && packagingValid);
        } else {
            this.elements.addPhaseBtn.disabled = true;
        }
    }

    handleAddPhase() {
        const phaseData = this.collectPhaseData();
        
        if (!phaseData) {
            this.showMessage('Please fill in all required fields', 'error');
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

    deletePhase(phaseId) {
        try {
            this.storageService.removePhase(phaseId);
            this.loadPhases();
            this.showMessage('Phase deleted successfully', 'success');
        } catch (error) {
            this.showMessage('Error deleting phase: ' + error.message, 'error');
        }
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