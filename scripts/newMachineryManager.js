/**
 * New Machinery Manager - Handles printing and packaging machinery with specific properties
 */
class NewMachineryManager {
    constructor() {
        this.storageService = window.storageService;
        this.editManager = window.editManager;
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
        
        // Initialize edit functionality
        if (this.editManager) {
            // Initialize for both tables specifically
            const printingTable = document.querySelector('#printing-machinery-table-body').closest('.modern-table');
            const packagingTable = document.querySelector('#packaging-machinery-table-body').closest('.modern-table');
            
            if (printingTable) {
                this.editManager.initTableEdit(printingTable);
            }
            if (packagingTable) {
                this.editManager.initTableEdit(packagingTable);
            }
            
            // Override saveEdit method
            this.editManager.saveEdit = (row) => this.saveEdit(row);
            
            // Handle delete events for both tables
            [printingTable, packagingTable].forEach(table => {
                if (table) {
                    table.addEventListener('deleteRow', (e) => {
                        const row = e.detail.row;
                        const machineId = row.dataset.machineId;
                        if (machineId) {
                            this.deleteMachine(machineId);
                        }
                    });
                }
            });
        }
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
            
            // Force cleanup of any orphan data and reload
            this.storageService.syncGanttChartData();
            this.loadMachinery();
            
            // Force refresh the page to ensure clean display
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
            this.showMessage('Machine added successfully! Refreshing page...', 'success');
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
        // Clean up any invalid machines first
        const cleanedCount = this.storageService.cleanupInvalidMachines();
        if (cleanedCount > 0) {
            console.log(`Cleaned up ${cleanedCount} invalid machines`);
        }
        
        // Get only valid machines for display (strict filtering)
        const allMachines = this.storageService.getValidMachinesForDisplay();
        const printingMachines = allMachines.filter(m => m.type === 'printing');
        const packagingMachines = allMachines.filter(m => m.type === 'packaging');
        
        this.renderPrintingMachines(printingMachines);
        this.renderPackagingMachines(packagingMachines);
        
        // Check for orphaned machines
        const allStoredMachines = this.storageService.getMachines();
        const orphanedMachines = allStoredMachines.filter(machine => !allMachines.find(vm => 
            (vm.name || vm.nominazione) === (machine.name || machine.nominazione)
        ));
        
        if (orphanedMachines.length > 0) {
            console.warn('Orphaned machines detected in machinery list:', orphanedMachines);
        }
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
            <tr data-machine-id="${machine.id}">
                <td class="editable-cell" data-field="numeroMacchina">
                    <span class="static-value"><strong>${machine.numeroMacchina}</strong></span>
                    ${this.editManager.createEditInput('text', machine.numeroMacchina)}
                </td>
                <td class="editable-cell" data-field="nominazione">
                    <span class="static-value">${machine.nominazione}</span>
                    ${this.editManager.createEditInput('text', machine.nominazione)}
                </td>
                <td class="editable-cell" data-field="city">
                    <span class="static-value">${machine.city}</span>
                    ${this.editManager.createEditInput('select', machine.city, {
                        options: [
                            { value: 'Milan', label: 'Milan' },
                            { value: 'Tallinn', label: 'Tallinn' }
                        ]
                    })}
                </td>
                <td class="editable-cell" data-field="numeroColori">
                    <span class="static-value">${machine.numeroColori}</span>
                    ${this.editManager.createEditInput('number', machine.numeroColori, { min: 1, max: 12 })}
                </td>
                <td class="editable-cell" data-field="fasciaMassima">
                    <span class="static-value">${machine.fasciaMassima}mm</span>
                    ${this.editManager.createEditInput('number', machine.fasciaMassima, { min: 1 })}
                </td>
                <td class="editable-cell" data-field="live">
                    <span class="static-value">
                        <span class="badge ${machine.live ? 'badge-green' : 'badge-gray'}">
                            ${machine.live ? 'Yes' : 'No'}
                        </span>
                    </span>
                    ${this.editManager.createEditInput('select', machine.live.toString(), {
                        options: [
                            { value: 'true', label: 'Yes' },
                            { value: 'false', label: 'No' }
                        ]
                    })}
                </td>
                <td class="text-center">
                    <a href="machine_settings.html?machine=${encodedName}" 
                       class="action-btn" 
                       title="Edit Availability">⚙️</a>
                </td>
                <td class="text-center">
                    ${this.editManager.createActionButtons()}
                </td>
            </tr>
        `;
    }

    createPackagingMachineRow(machine) {
        const encodedName = encodeURIComponent(machine.name || machine.nominazione);
        
        return `
            <tr data-machine-id="${machine.id}">
                <td class="editable-cell" data-field="numeroMacchina">
                    <span class="static-value"><strong>${machine.numeroMacchina}</strong></span>
                    ${this.editManager.createEditInput('text', machine.numeroMacchina)}
                </td>
                <td class="editable-cell" data-field="nominazione">
                    <span class="static-value">${machine.nominazione}</span>
                    ${this.editManager.createEditInput('text', machine.nominazione)}
                </td>
                <td class="editable-cell" data-field="city">
                    <span class="static-value">${machine.city}</span>
                    ${this.editManager.createEditInput('select', machine.city, {
                        options: [
                            { value: 'Milan', label: 'Milan' },
                            { value: 'Tallinn', label: 'Tallinn' }
                        ]
                    })}
                </td>
                <td class="editable-cell" data-field="tipologiaMateriale">
                    <span class="static-value">${machine.tipologiaMateriale}</span>
                    ${this.editManager.createEditInput('text', machine.tipologiaMateriale)}
                </td>
                <td class="editable-cell" data-field="erogazione">
                    <span class="static-value">${machine.erogazione}</span>
                    ${this.editManager.createEditInput('text', machine.erogazione)}
                </td>
                <td class="editable-cell" data-field="passo">
                    <span class="static-value">${machine.passo}mm</span>
                    ${this.editManager.createEditInput('number', machine.passo, { min: 1 })}
                </td>
                <td class="editable-cell" data-field="fascia">
                    <span class="static-value">${machine.fascia}mm</span>
                    ${this.editManager.createEditInput('number', machine.fascia, { min: 1 })}
                </td>
                <td class="editable-cell" data-field="produzioneGemellare">
                    <span class="static-value">
                        <span class="badge ${machine.produzioneGemellare ? 'badge-green' : 'badge-gray'}">
                            ${machine.produzioneGemellare ? 'Yes' : 'No'}
                        </span>
                    </span>
                    ${this.editManager.createEditInput('select', machine.produzioneGemellare.toString(), {
                        options: [
                            { value: 'true', label: 'Yes' },
                            { value: 'false', label: 'No' }
                        ]
                    })}
                </td>
                <td class="editable-cell" data-field="live">
                    <span class="static-value">
                        <span class="badge ${machine.live ? 'badge-green' : 'badge-gray'}">
                            ${machine.live ? 'Yes' : 'No'}
                        </span>
                    </span>
                    ${this.editManager.createEditInput('select', machine.live.toString(), {
                        options: [
                            { value: 'true', label: 'Yes' },
                            { value: 'false', label: 'No' }
                        ]
                    })}
                </td>
                <td class="text-center">
                    <a href="machine_settings.html?machine=${encodedName}" 
                       class="action-btn" 
                       title="Edit Availability">⚙️</a>
                </td>
                <td class="text-center">
                    ${this.editManager.createActionButtons()}
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

    saveEdit(row) {
        const machineId = row.dataset.machineId;
        if (!machineId) {
            console.error('No machine ID found in row');
            return;
        }

        // Collect edited values using the edit manager
        const updatedData = this.editManager.collectEditedValues(row);

        console.log('Collected updated machine data:', updatedData);

        // Validate data
        if (!updatedData.nominazione || updatedData.nominazione.trim() === '') {
            this.showMessage('Machine name cannot be empty', 'error');
            return;
        }

        try {
            // Get current machine
            const machines = this.storageService.getMachines();
            const machine = machines.find(m => String(m.id) === String(machineId));
            if (!machine) {
                this.showMessage('Machine not found', 'error');
                return;
            }

            // Update machine with new values
            const updatedMachine = {
                ...machine,
                nominazione: updatedData.nominazione.trim(),
                name: updatedData.nominazione.trim(), // Also update name field for consistency
                numeroMacchina: updatedData.numeroMacchina,
                city: updatedData.city,
                live: updatedData.live === 'true'
            };

            // Add type-specific fields
            if (machine.type === 'printing') {
                updatedMachine.numeroColori = parseInt(updatedData.numeroColori) || machine.numeroColori;
                updatedMachine.fasciaMassima = parseInt(updatedData.fasciaMassima) || machine.fasciaMassima;
            } else if (machine.type === 'packaging') {
                updatedMachine.tipologiaMateriale = updatedData.tipologiaMateriale;
                updatedMachine.erogazione = updatedData.erogazione;
                updatedMachine.passo = parseInt(updatedData.passo) || machine.passo;
                updatedMachine.fascia = parseInt(updatedData.fascia) || machine.fascia;
                updatedMachine.produzioneGemellare = updatedData.produzioneGemellare === 'true';
            }

            console.log('Original machine:', machine);
            console.log('Updated machine:', updatedMachine);

            // Save updated machine
            const updatedMachines = machines.map(m => 
                String(m.id) === String(machineId) ? updatedMachine : m
            );
            this.storageService.saveMachinesWithSync(updatedMachines);

            // Exit edit mode
            this.editManager.cancelEdit(row);

            // Update display
            this.loadMachinery();
            this.showMessage('Machine updated successfully', 'success');

        } catch (error) {
            this.showMessage('Error updating machine: ' + error.message, 'error');
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