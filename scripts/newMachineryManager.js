/**
 * New Machinery Manager - Handles printing and packaging machinery with specific properties
 */
class NewMachineryManager {
    constructor() {
        this.storageService = window.storageService;
        this.elements = {};
        this.currentEditingType = null;
        this.currentEditingId = null;
        this.init();
    }

    init() {
        // Ensure storage service is available
        if (!this.storageService) {
            console.error('StorageService not available');
            return;
        }
        
        this.bindElements();
        this.attachEventListeners();
        this.loadMachinery();
        this.setupFormValidation();
    }

    bindElements() {
        this.elements = {
            // Common form elements
            machineType: document.getElementById('machineType'),
            machineCity: document.getElementById('machineCity'),
            machineLive: document.getElementById('machineLive'),
            addBtn: document.getElementById('addMachine'),

            // Form sections
            printingForm: document.getElementById('printingMachineForm'),
            packagingForm: document.getElementById('packagingMachineForm'),

            // Printing machine elements
            printingNumeroMacchina: document.getElementById('printingNumeroMacchina'),
            printingNominazione: document.getElementById('printingNominazione'),
            printingNumeroColori: document.getElementById('printingNumeroColori'),
            printingFasciaMassima: document.getElementById('printingFasciaMassima'),

            // Packaging machine elements
            packagingNumeroMacchina: document.getElementById('packagingNumeroMacchina'),
            packagingNominazione: document.getElementById('packagingNominazione'),
            packagingTipologiaMateriale: document.getElementById('packagingTipologiaMateriale'),
            packagingErogazione: document.getElementById('packagingErogazione'),
            packagingPasso: document.getElementById('packagingPasso'),
            packagingFascia: document.getElementById('packagingFascia'),
            packagingProduzioneGemellare: document.getElementById('packagingProduzioneGemellare'),

            // Table bodies
            printingTableBody: document.getElementById('printing-machinery-table-body'),
            packagingTableBody: document.getElementById('packaging-machinery-table-body')
        };
    }

    attachEventListeners() {
        // Machine type change
        this.elements.machineType.addEventListener('change', () => this.handleMachineTypeChange());
        
        // Add machine button
        this.elements.addBtn.addEventListener('click', () => this.handleAddMachine());

        // Form validation
        const allInputs = [
            this.elements.machineCity, this.elements.machineLive,
            this.elements.printingNumeroMacchina, this.elements.printingNominazione,
            this.elements.printingNumeroColori, this.elements.printingFasciaMassima,
            this.elements.packagingNumeroMacchina, this.elements.packagingNominazione,
            this.elements.packagingTipologiaMateriale, this.elements.packagingErogazione,
            this.elements.packagingPasso, this.elements.packagingFascia
        ];

        allInputs.forEach(input => {
            input.addEventListener('input', () => this.validateForm());
            input.addEventListener('change', () => this.validateForm());
        });
    }

    setupFormValidation() {
        this.validateForm();
    }

    handleMachineTypeChange() {
        const selectedType = this.elements.machineType.value;
        
        // Hide all forms first
        this.elements.printingForm.style.display = 'none';
        this.elements.packagingForm.style.display = 'none';
        
        // Show relevant form
        if (selectedType === 'printing') {
            this.elements.printingForm.style.display = 'block';
        } else if (selectedType === 'packaging') {
            this.elements.packagingForm.style.display = 'block';
        }
        
        this.validateForm();
    }

    validateForm() {
        const type = this.elements.machineType.value;
        const city = this.elements.machineCity.value;
        const live = this.elements.machineLive.value;
        
        let isValid = type && city && live;
        
        if (type === 'printing') {
            isValid = isValid && 
                this.elements.printingNumeroMacchina.value.trim() &&
                this.elements.printingNominazione.value.trim() &&
                this.elements.printingNumeroColori.value &&
                this.elements.printingFasciaMassima.value;
        } else if (type === 'packaging') {
            isValid = isValid && 
                this.elements.packagingNumeroMacchina.value.trim() &&
                this.elements.packagingNominazione.value.trim() &&
                this.elements.packagingTipologiaMateriale.value.trim() &&
                this.elements.packagingErogazione.value.trim() &&
                this.elements.packagingPasso.value &&
                this.elements.packagingFascia.value;
        }
        
        this.elements.addBtn.disabled = !isValid;
    }

    handleAddMachine() {
        const machineData = this.collectMachineData();
        
        if (!machineData) {
            this.showMessage('Please fill in all required fields', 'error');
            return;
        }

        try {
            // Check for duplicate numero macchina
            if (this.isDuplicateNumeroMacchina(machineData.numeroMacchina, machineData.type)) {
                this.showMessage('A machine with this Numero Macchina already exists', 'error');
                return;
            }

            this.storageService.addMachineWithSync(machineData);
            this.clearForm();
            this.loadMachinery();
            this.showMessage('Machine added successfully!', 'success');
        } catch (error) {
            this.showMessage('Error adding machine: ' + error.message, 'error');
        }
    }

    collectMachineData() {
        const type = this.elements.machineType.value;
        const baseData = {
            id: Date.now().toString(),
            type: type,
            city: this.elements.machineCity.value,
            live: this.elements.machineLive.value === 'true',
            createdAt: new Date().toISOString()
        };

        if (type === 'printing') {
            return {
                ...baseData,
                numeroMacchina: this.elements.printingNumeroMacchina.value.trim(),
                nominazione: this.elements.printingNominazione.value.trim(),
                numeroColori: parseInt(this.elements.printingNumeroColori.value),
                fasciaMassima: parseInt(this.elements.printingFasciaMassima.value),
                // Legacy compatibility
                name: this.elements.printingNominazione.value.trim()
            };
        } else if (type === 'packaging') {
            return {
                ...baseData,
                numeroMacchina: this.elements.packagingNumeroMacchina.value.trim(),
                nominazione: this.elements.packagingNominazione.value.trim(),
                tipologiaMateriale: this.elements.packagingTipologiaMateriale.value.trim(),
                erogazione: this.elements.packagingErogazione.value.trim(),
                passo: parseInt(this.elements.packagingPasso.value),
                fascia: parseInt(this.elements.packagingFascia.value),
                produzioneGemellare: this.elements.packagingProduzioneGemellare.checked,
                // Legacy compatibility
                name: this.elements.packagingNominazione.value.trim()
            };
        }

        return null;
    }

    isDuplicateNumeroMacchina(numeroMacchina, type, excludeId = null) {
        const machines = this.storageService.getMachines();
        return machines.some(machine => 
            machine.numeroMacchina === numeroMacchina && 
            machine.type === type &&
            machine.id !== excludeId
        );
    }

    clearForm() {
        this.elements.machineType.value = '';
        this.elements.machineCity.value = '';
        this.elements.machineLive.value = 'true';

        // Clear printing form
        this.elements.printingNumeroMacchina.value = '';
        this.elements.printingNominazione.value = '';
        this.elements.printingNumeroColori.value = '';
        this.elements.printingFasciaMassima.value = '';

        // Clear packaging form
        this.elements.packagingNumeroMacchina.value = '';
        this.elements.packagingNominazione.value = '';
        this.elements.packagingTipologiaMateriale.value = '';
        this.elements.packagingErogazione.value = '';
        this.elements.packagingPasso.value = '';
        this.elements.packagingFascia.value = '';
        this.elements.packagingProduzioneGemellare.checked = false;

        // Hide forms
        this.elements.printingForm.style.display = 'none';
        this.elements.packagingForm.style.display = 'none';

        this.validateForm();
    }

    loadMachinery() {
        const machines = this.storageService.getMachines();
        
        const printingMachines = machines.filter(m => m.type === 'printing');
        const packagingMachines = machines.filter(m => m.type === 'packaging');
        
        this.renderPrintingMachines(printingMachines);
        this.renderPackagingMachines(packagingMachines);
    }

    renderPrintingMachines(machines) {
        if (!machines || machines.length === 0) {
            this.elements.printingTableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center" style="padding: 2rem; color: #6b7280;">
                        No printing machines available. Add printing machines to get started.
                    </td>
                </tr>
            `;
            return;
        }

        this.elements.printingTableBody.innerHTML = machines.map(machine => 
            this.createPrintingMachineRow(machine)
        ).join('');
    }

    renderPackagingMachines(machines) {
        if (!machines || machines.length === 0) {
            this.elements.packagingTableBody.innerHTML = `
                <tr>
                    <td colspan="12" class="text-center" style="padding: 2rem; color: #6b7280;">
                        No packaging machines available. Add packaging machines to get started.
                    </td>
                </tr>
            `;
            return;
        }

        this.elements.packagingTableBody.innerHTML = machines.map(machine => 
            this.createPackagingMachineRow(machine)
        ).join('');
    }

    createPrintingMachineRow(machine) {
        const encodedName = encodeURIComponent(machine.name || machine.nominazione);
        
        return `
            <tr>
                <td><strong>${machine.numeroMacchina}</strong></td>
                <td>${machine.nominazione}</td>
                <td>${machine.city}</td>
                <td>${machine.numeroColori}</td>
                <td>${machine.fasciaMassima}mm</td>
                <td>
                    <span class="badge ${machine.live ? 'badge-green' : 'badge-gray'}">
                        ${machine.live ? 'Yes' : 'No'}
                    </span>
                </td>
                <td class="text-center">
                    <a href="machine_settings.html?machine=${encodedName}" 
                       class="action-btn" 
                       title="Edit Availability">⚙️</a>
                </td>
                <td class="text-center">
                    <button class="action-btn edit-btn" 
                            onclick="newMachineryManager.editMachine('${machine.id}')" 
                            title="Edit Machine">✏️</button>
                </td>
                <td class="text-center">
                    <button class="btn-delete" 
                            onclick="newMachineryManager.deleteMachine('${machine.id}')" 
                            title="Delete Machine">🗑️</button>
                </td>
            </tr>
        `;
    }

    createPackagingMachineRow(machine) {
        const encodedName = encodeURIComponent(machine.name || machine.nominazione);
        
        return `
            <tr>
                <td><strong>${machine.numeroMacchina}</strong></td>
                <td>${machine.nominazione}</td>
                <td>${machine.city}</td>
                <td>${machine.tipologiaMateriale}</td>
                <td>${machine.erogazione}</td>
                <td>${machine.passo}mm</td>
                <td>${machine.fascia}mm</td>
                <td>
                    <span class="badge ${machine.produzioneGemellare ? 'badge-green' : 'badge-gray'}">
                        ${machine.produzioneGemellare ? 'Yes' : 'No'}
                    </span>
                </td>
                <td>
                    <span class="badge ${machine.live ? 'badge-green' : 'badge-gray'}">
                        ${machine.live ? 'Yes' : 'No'}
                    </span>
                </td>
                <td class="text-center">
                    <a href="machine_settings.html?machine=${encodedName}" 
                       class="action-btn" 
                       title="Edit Availability">⚙️</a>
                </td>
                <td class="text-center">
                    <button class="action-btn edit-btn" 
                            onclick="newMachineryManager.editMachine('${machine.id}')" 
                            title="Edit Machine">✏️</button>
                </td>
                <td class="text-center">
                    <button class="btn-delete" 
                            onclick="newMachineryManager.deleteMachine('${machine.id}')" 
                            title="Delete Machine">🗑️</button>
                </td>
            </tr>
        `;
    }

    editMachine(machineId) {
        // TODO: Implement inline editing similar to old system
        this.showMessage('Edit functionality coming soon', 'info');
    }

    deleteMachine(machineId) {
        const machine = this.storageService.getMachines().find(m => m.id === machineId);
        const machineName = machine ? (machine.name || machine.nominazione) : 'this machine';
        
        try {
            // Check if machine can be deleted (not scheduled)
            this.storageService.validateMachineCanBeDeleted(machineName);
            
            const message = `Are you sure you want to delete "${machineName}"? This action cannot be undone.`;
            
            showDeleteConfirmation(message, () => {
                try {
                    const machines = this.storageService.getMachines();
                    const filteredMachines = machines.filter(m => m.id !== machineId);
                    this.storageService.saveMachinesWithSync(filteredMachines);
                    this.loadMachinery();
                    this.showMessage('Machine deleted successfully', 'success');
                } catch (error) {
                    this.showMessage('Error deleting machine: ' + error.message, 'error');
                }
            });
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    showMessage(message, type = 'info') {
        // Use the banner system
        showBanner(message, type);
    }
}

// Initialize when DOM is loaded and storage service is available
document.addEventListener('DOMContentLoaded', () => {
    // Wait for storage service to be available
    const initializeManager = () => {
        if (window.storageService) {
            window.newMachineryManager = new NewMachineryManager();
        } else {
            // If storage service not ready, wait a bit and try again
            setTimeout(initializeManager, 50);
        }
    };
    
    initializeManager();
});