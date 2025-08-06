/**
 * New Machinery Manager - Handles printing and packaging machinery with specific properties
 */
class NewMachineryManager extends BaseManager {
    constructor() {
        super(window.storageService);
        this.editManager = window.editManager;
        this.currentEditingType = null;
        this.currentEditingId = null;
        this.init(this.getElementMap());
    }

    init(elementMap) {
        // Ensure storage service is available
        if (!this.storageService) {
            console.error('StorageService not available');
            return;
        }
        
        if (super.init(elementMap)) {
            this.loadMachinery();
            this.setupFormValidation();
            
            // Initialize edit functionality
            if (this.editManager) {
                const machineryTable = document.querySelector('#machinery-table-body').closest('.modern-table');
                
                if (machineryTable) {
                    this.editManager.initTableEdit(machineryTable);
                }
                
                // Override saveEdit method
                this.editManager.saveEdit = (row) => this.saveEdit(row);
                
                // Handle delete events
                if (machineryTable) {
                    machineryTable.addEventListener('deleteRow', (e) => {
                            const row = e.detail.row;
                            const machineId = row.dataset.machineId;
                            if (machineId) {
                                this.deleteMachine(machineId);
                            }
                        });
                    }
            }
        }
    }

    getElementMap() {
        return {
            // IDENTIFICAZIONE elements
            machineType: document.getElementById('machineType'),
            machineName: document.getElementById('machineName'),
            machineSite: document.getElementById('machineSite'),
            machineDepartment: document.getElementById('machineDepartment'),

            // CAPACITÀ TECNICHE elements
            minWebWidth: document.getElementById('minWebWidth'),
            maxWebWidth: document.getElementById('maxWebWidth'),
            minBagHeight: document.getElementById('minBagHeight'),
            maxBagHeight: document.getElementById('maxBagHeight'),
            maxColors: document.getElementById('maxColors'),
            supportedMaterials: document.getElementById('supportedMaterials'),

            // PERFORMANCE elements
            standardSpeed: document.getElementById('standardSpeed'),
            efficiencyFactor: document.getElementById('efficiencyFactor'),
            setupTimeStandard: document.getElementById('setupTimeStandard'),
            changeoverColor: document.getElementById('changeoverColor'),
            changeoverMaterial: document.getElementById('changeoverMaterial'),

            // DISPONIBILITÀ elements
            activeShifts: document.querySelectorAll('input[type="checkbox"][value^="T"]'),
            hoursPerShift: document.getElementById('hoursPerShift'),

            // Machine Button
            addBtn: document.getElementById('addMachine'),

            // Machine Table body
            machineryTableBody: document.getElementById('machinery-table-body'),


        };
    }

    attachEventListeners() {
        // Add machine button
        this.elements.addBtn.addEventListener('click', () => this.handleAddMachine());

        // Form validation for all inputs
        const allInputs = [
            this.elements.machineType, this.elements.machineName, this.elements.machineSite, this.elements.machineDepartment,
            this.elements.minWebWidth, this.elements.maxWebWidth, this.elements.minBagHeight, this.elements.maxBagHeight,
            this.elements.maxColors, this.elements.standardSpeed, this.elements.efficiencyFactor,
            this.elements.setupTimeStandard, this.elements.changeoverColor, this.elements.changeoverMaterial,
            this.elements.hoursPerShift
        ];

        allInputs.forEach(input => {
            if (input) {
            input.addEventListener('input', () => this.validateForm());
            input.addEventListener('change', () => this.validateForm());
            }
        });

        // Multi-select validation
        if (this.elements.supportedMaterials) {
            this.elements.supportedMaterials.addEventListener('change', () => this.validateForm());
        }

        // Checkbox validation for shifts
        this.elements.activeShifts.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.validateForm());
        });


    }

    setupFormValidation() {
        this.validateForm();
    }



    validateForm() {
        // Check required identification fields
        const isValid = 
            this.elements.machineType.value &&
            this.elements.machineName.value.trim() &&
            this.elements.machineSite.value &&
            this.elements.machineDepartment.value &&
            
            // Check technical capabilities
            this.elements.minWebWidth.value &&
            this.elements.maxWebWidth.value &&
            this.elements.minBagHeight.value &&
            this.elements.maxBagHeight.value &&
            this.elements.maxColors.value &&
            
            // Check performance fields
            this.elements.standardSpeed.value &&
            this.elements.efficiencyFactor.value &&
            this.elements.setupTimeStandard.value &&
            this.elements.changeoverColor.value &&
            this.elements.changeoverMaterial.value &&
            this.elements.hoursPerShift.value &&
            
            // Check that at least one shift is selected
            Array.from(this.elements.activeShifts).some(checkbox => checkbox.checked);
        
        this.elements.addBtn.disabled = !isValid;
    }

    handleAddMachine() {
        const machineData = this.collectMachineData();
        
        if (!machineData) {
            this.showMessage('Please fill in all required fields', 'error');
            return;
        }

        console.log('Adding machine with data:', machineData);

        try {
            // Check for duplicate machine name
            const existingMachines = this.storageService.getMachines();
            const isDuplicate = existingMachines.some(machine => 
                machine.machine_name === machineData.machine_name && 
                machine.site === machineData.site
            );
            
            if (isDuplicate) {
                this.showMessage('A machine with this name already exists at this site', 'error');
                return;
            }

            // Add machine using the new storage service method
            const newMachine = this.storageService.addMachine(machineData);
            console.log('Machine added successfully:', newMachine);
            
            this.clearForm();
            
            // Reload the machinery list
            this.loadMachinery();
            
            this.showMessage(`Machine "${newMachine.machine_name}" added successfully!`, 'success');
        } catch (error) {
            console.error('Error adding machine:', error);
            this.showMessage('Error adding machine: ' + error.message, 'error');
        }
    }

    collectMachineData() {
        // Get selected materials
        const selectedMaterials = Array.from(this.elements.supportedMaterials.selectedOptions).map(option => option.value);
        
        // Get selected shifts
        const selectedShifts = Array.from(this.elements.activeShifts)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

            return {
            // IDENTIFICAZIONE
            machine_type: this.elements.machineType.value,
            machine_name: this.elements.machineName.value.trim(),
            site: this.elements.machineSite.value,
            department: this.elements.machineDepartment.value,
            
            // CAPACITÀ TECNICHE
            min_web_width: parseInt(this.elements.minWebWidth.value),
            max_web_width: parseInt(this.elements.maxWebWidth.value),
            min_bag_height: parseInt(this.elements.minBagHeight.value),
            max_bag_height: parseInt(this.elements.maxBagHeight.value),
            max_colors: parseInt(this.elements.maxColors.value),
            supported_materials: selectedMaterials,
            
            // PERFORMANCE
            standard_speed: parseInt(this.elements.standardSpeed.value),
            efficiency_factor: parseFloat(this.elements.efficiencyFactor.value),
            setup_time_standard: parseInt(this.elements.setupTimeStandard.value),
            changeover_color: parseInt(this.elements.changeoverColor.value),
            changeover_material: parseInt(this.elements.changeoverMaterial.value),
            
            // DISPONIBILITÀ
            active_shifts: selectedShifts,
            hours_per_shift: parseFloat(this.elements.hoursPerShift.value),
            
                // Legacy compatibility
            type: this.elements.machineType.value === 'DIGITAL_PRINT' || this.elements.machineType.value === 'FLEXO_PRINT' || this.elements.machineType.value === 'ROTOGRAVURE' ? 'printing' : 'packaging',
            name: this.elements.machineName.value.trim()
        };
    }



    clearForm() {
        // Clear identification fields
        this.elements.machineType.value = '';
        this.elements.machineName.value = '';
        this.elements.machineSite.value = '';
        this.elements.machineDepartment.value = '';

        // Clear technical capabilities
        this.elements.minWebWidth.value = '';
        this.elements.maxWebWidth.value = '';
        this.elements.minBagHeight.value = '';
        this.elements.maxBagHeight.value = '';
        this.elements.maxColors.value = '';
        this.elements.supportedMaterials.selectedIndex = -1;

        // Clear performance fields
        this.elements.standardSpeed.value = '';
        this.elements.efficiencyFactor.value = '';
        this.elements.setupTimeStandard.value = '';
        this.elements.changeoverColor.value = '';
        this.elements.changeoverMaterial.value = '';

        // Clear availability fields
        this.elements.activeShifts.forEach(checkbox => checkbox.checked = false);
        this.elements.hoursPerShift.value = '8.0';

        // Reset to default values
        this.elements.efficiencyFactor.value = '0.85';
        this.elements.activeShifts[0].checked = true; // T1 by default

        this.validateForm();
    }

    loadMachinery() {
        // Get all machines for display (don't clean up on every load)
        const allMachines = this.storageService.getMachines();
        console.log('Loading machinery:', allMachines.length, 'machines found');
        this.renderMachinery(allMachines);
    }

    renderMachinery(machines) {
        console.log('Rendering machinery table with', machines.length, 'machines');
        console.log('Table body element:', this.elements.machineryTableBody);
        
        if (!machines || machines.length === 0) {
            this.elements.machineryTableBody.innerHTML = `
                <tr>
                    <td colspan="12" class="text-center" style="padding: 2rem; color: #6b7280;">
                        No machines available. Add machines to get started.
                    </td>
                </tr>
            `;
            return;
        }

        this.elements.machineryTableBody.innerHTML = machines.map(machine => 
            this.createMachineRow(machine)
        ).join('');
    }

    createMachineRow(machine) {
        const webWidthRange = `${machine.min_web_width || 0}-${machine.max_web_width || 0}`;
        const bagHeightRange = `${machine.min_bag_height || 0}-${machine.max_bag_height || 0}`;
        const efficiencyPercent = Math.round((machine.efficiency_factor || 0.85) * 100);
        
        return `
            <tr data-machine-id="${machine.id}">
                <td class="editable-cell" data-field="machine_id">
                    <span class="static-value"><strong>${machine.machine_id || machine.id}</strong></span>
                    ${this.editManager ? this.editManager.createEditInput('text', machine.machine_id || machine.id) : ''}
                </td>
                <td class="editable-cell" data-field="machine_name">
                    <span class="static-value">${machine.machine_name || machine.name}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', machine.machine_name || machine.name) : ''}
                </td>
                <td class="editable-cell" data-field="machine_type">
                    <span class="static-value">
                        <span class="btn btn-primary" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                            ${machine.machine_type || machine.type}
                        </span>
                    </span>
                    ${this.editManager ? this.editManager.createEditInput('select', machine.machine_type || machine.type, {
                        options: [
                            { value: 'DIGITAL_PRINT', label: 'Digital Print' },
                            { value: 'FLEXO_PRINT', label: 'Flexo Print' },
                            { value: 'ROTOGRAVURE', label: 'Rotogravure' },
                            { value: 'PACKAGING', label: 'Packaging' },
                            { value: 'DOYPACK', label: 'Doypack' }
                        ]
                    }) : ''}
                </td>
                <td class="editable-cell" data-field="site">
                    <span class="static-value">${machine.site}</span>
                    ${this.editManager ? this.editManager.createEditInput('select', machine.site, {
                        options: [
                            { value: 'ZANICA', label: 'ZANICA' },
                            { value: 'BUSTO_GAROLFO', label: 'BUSTO GAROLFO' }
                        ]
                    }) : ''}
                </td>
                <td class="editable-cell" data-field="department">
                    <span class="static-value">${machine.department}</span>
                    ${this.editManager ? this.editManager.createEditInput('select', machine.department, {
                        options: [
                            { value: 'STAMPA', label: 'STAMPA' },
                            { value: 'CONFEZIONAMENTO', label: 'CONFEZIONAMENTO' }
                        ]
                    }) : ''}
                </td>
                <td class="editable-cell" data-field="web_width">
                    <span class="static-value">${webWidthRange}mm</span>
                    ${this.editManager ? this.editManager.createEditInput('text', webWidthRange) : ''}
                </td>
                <td class="editable-cell" data-field="bag_height">
                    <span class="static-value">${bagHeightRange}mm</span>
                    ${this.editManager ? this.editManager.createEditInput('text', bagHeightRange) : ''}
                </td>
                <td class="editable-cell" data-field="supported_materials">
                    <span class="static-value">${Array.isArray(machine.supported_materials) ? machine.supported_materials.join(', ') : machine.supported_materials || '-'}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', Array.isArray(machine.supported_materials) ? machine.supported_materials.join(', ') : machine.supported_materials) : ''}
                </td>
                <td class="editable-cell" data-field="max_colors">
                    <span class="static-value">${machine.max_colors || 0}</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.max_colors || 0, { min: 1, max: 12 }) : ''}
                </td>
                <td class="editable-cell" data-field="standard_speed">
                    <span class="static-value">${machine.standard_speed || 0}</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.standard_speed || 0, { min: 1 }) : ''}
                </td>
                <td class="editable-cell" data-field="efficiency_factor">
                    <span class="static-value">${efficiencyPercent}%</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.efficiency_factor || 0.85, { min: 0, max: 1, step: 0.01 }) : ''}
                </td>
                <td class="editable-cell" data-field="setup_time_standard">
                    <span class="static-value">${machine.setup_time_standard || 0} min</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.setup_time_standard || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="changeover_color">
                    <span class="static-value">${machine.changeover_color || 0} min</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.changeover_color || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="changeover_material">
                    <span class="static-value">${machine.changeover_material || 0} min</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.changeover_material || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="active_shifts">
                    <span class="static-value">${Array.isArray(machine.active_shifts) ? machine.active_shifts.join(', ') : machine.active_shifts || '-'}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', Array.isArray(machine.active_shifts) ? machine.active_shifts.join(', ') : machine.active_shifts) : ''}
                </td>
                <td class="editable-cell" data-field="hours_per_shift">
                    <span class="static-value">${machine.hours_per_shift || 8.0}h</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.hours_per_shift || 8.0, { min: 1, max: 24, step: 0.5 }) : ''}
                </td>
                <td class="editable-cell" data-field="status">
                    <span class="static-value">
                        <span class="status-badge status-active">Active</span>
                    </span>
                    ${this.editManager ? this.editManager.createEditInput('select', 'active', {
                        options: [
                            { value: 'active', label: 'Active' },
                            { value: 'maintenance', label: 'Maintenance' },
                            { value: 'inactive', label: 'Inactive' }
                        ]
                    }) : ''}
                </td>
                <td class="text-center">
                    <a href="machine_settings.html?machine=${encodeURIComponent(machine.machine_name || machine.name)}" 
                       class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                        📅
                    </a>
                </td>
                <td class="text-center">
                    ${this.editManager ? this.editManager.createActionButtons() : ''}
                </td>
            </tr>
        `;
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
                    ${this.editManager ? this.editManager.createEditInput('text', machine.numeroMacchina) : ''}
                </td>
                <td class="editable-cell" data-field="nominazione">
                    <span class="static-value">${machine.nominazione}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', machine.nominazione) : ''}
                </td>
                <td class="editable-cell" data-field="city">
                    <span class="static-value">${machine.city}</span>
                    ${this.editManager ? this.editManager.createEditInput('select', machine.city, {
                        options: [
                            { value: 'Milan', label: 'Milan' },
                            { value: 'Tallinn', label: 'Tallinn' }
                        ]
                    }) : ''}
                </td>
                <td class="editable-cell" data-field="numeroColori">
                    <span class="static-value">${machine.numeroColori}</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.numeroColori, { min: 1, max: 12 }) : ''}
                </td>
                <td class="editable-cell" data-field="fasciaMassima">
                    <span class="static-value">${machine.fasciaMassima}mm</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.fasciaMassima, { min: 1 }) : ''}
                </td>
                <td class="editable-cell" data-field="live">
                    <span class="static-value">
                        <span class="btn ${machine.live ? 'btn-primary' : 'btn-secondary'}" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                            ${machine.live ? 'Yes' : 'No'}
                        </span>
                    </span>
                    ${this.editManager ? this.editManager.createEditInput('select', machine.live.toString(), {
                        options: [
                            { value: 'true', label: 'Yes' },
                            { value: 'false', label: 'No' }
                        ]
                    }) : ''}
                </td>
                <td class="text-center">
                    <a href="machine_settings.html?machine=${encodedName}" 
                       class="action-btn" 
                       title="Edit Availability">⚙️</a>
                </td>
                <td class="text-center">
                    ${this.editManager ? this.editManager.createActionButtons() : ''}
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
                    ${this.editManager ? this.editManager.createEditInput('text', machine.numeroMacchina) : ''}
                </td>
                <td class="editable-cell" data-field="nominazione">
                    <span class="static-value">${machine.nominazione}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', machine.nominazione) : ''}
                </td>
                <td class="editable-cell" data-field="city">
                    <span class="static-value">${machine.city}</span>
                    ${this.editManager ? this.editManager.createEditInput('select', machine.city, {
                        options: [
                            { value: 'Milan', label: 'Milan' },
                            { value: 'Tallinn', label: 'Tallinn' }
                        ]
                    }) : ''}
                </td>
                <td class="editable-cell" data-field="tipologiaMateriale">
                    <span class="static-value">${machine.tipologiaMateriale}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', machine.tipologiaMateriale) : ''}
                </td>
                <td class="editable-cell" data-field="erogazione">
                    <span class="static-value">${machine.erogazione}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', machine.erogazione) : ''}
                </td>
                <td class="editable-cell" data-field="passo">
                    <span class="static-value">${machine.passo}mm</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.passo, { min: 1 }) : ''}
                </td>
                <td class="editable-cell" data-field="fascia">
                    <span class="static-value">${machine.fascia}mm</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.fascia, { min: 1 }) : ''}
                </td>
                <td class="editable-cell" data-field="produzioneGemellare">
                    <span class="static-value">
                        <span class="btn ${machine.produzioneGemellare ? 'btn-primary' : 'btn-secondary'}" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                            ${machine.produzioneGemellare ? 'Yes' : 'No'}
                        </span>
                    </span>
                    ${this.editManager ? this.editManager.createEditInput('select', machine.produzioneGemellare.toString(), {
                        options: [
                            { value: 'true', label: 'Yes' },
                            { value: 'false', label: 'No' }
                        ]
                    }) : ''}
                </td>
                <td class="editable-cell" data-field="live">
                    <span class="static-value">
                        <span class="btn ${machine.live ? 'btn-primary' : 'btn-secondary'}" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                            ${machine.live ? 'Yes' : 'No'}
                        </span>
                    </span>
                    ${this.editManager ? this.editManager.createEditInput('select', machine.live.toString(), {
                        options: [
                            { value: 'true', label: 'Yes' },
                            { value: 'false', label: 'No' }
                        ]
                    }) : ''}
                </td>
                <td class="text-center">
                    <a href="machine_settings.html?machine=${encodedName}" 
                       class="action-btn" 
                       title="Edit Availability">⚙️</a>
                </td>
                <td class="text-center">
                    ${this.editManager ? this.editManager.createActionButtons() : ''}
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

        // Validate data - check for machine_name first, then fall back to legacy fields
        const machineName = updatedData.machine_name || updatedData.nominazione || updatedData.name;
        if (!machineName || machineName.trim() === '') {
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

            // Update machine with new values - handle both new and legacy field names
            const updatedMachine = {
                ...machine,
                // New field names
                machine_name: machineName.trim(),
                machine_type: updatedData.machine_type || machine.machine_type || machine.type, // Prevent null
                site: updatedData.site || machine.site,
                department: updatedData.department || machine.department,
                max_colors: parseInt(updatedData.max_colors) || machine.max_colors,
                standard_speed: parseInt(updatedData.standard_speed) || machine.standard_speed,
                efficiency_factor: parseFloat(updatedData.efficiency_factor) || machine.efficiency_factor,
                status: updatedData.status || machine.status,
                
                // Legacy field names for backward compatibility
                name: machineName.trim(),
                nominazione: machineName.trim(),
                type: updatedData.machine_type || machine.machine_type || machine.type, // Prevent null
                numeroMacchina: updatedData.machine_id || machine.machine_id || machine.numeroMacchina,
                city: updatedData.site || machine.site || machine.city,
                live: updatedData.status === 'active' ? true : (updatedData.status === 'inactive' ? false : machine.live)
            };

            // Handle web width and bag height ranges if provided
            if (updatedData.web_width) {
                const [minWidth, maxWidth] = updatedData.web_width.split('-').map(w => parseInt(w));
                if (!isNaN(minWidth)) updatedMachine.min_web_width = minWidth;
                if (!isNaN(maxWidth)) updatedMachine.max_web_width = maxWidth;
            }

            if (updatedData.bag_height) {
                const [minHeight, maxHeight] = updatedData.bag_height.split('-').map(h => parseInt(h));
                if (!isNaN(minHeight)) updatedMachine.min_bag_height = minHeight;
                if (!isNaN(maxHeight)) updatedMachine.max_bag_height = maxHeight;
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


}

// Initialize when DOM is loaded and storage service is available
document.addEventListener('DOMContentLoaded', () => {
    // Wait for storage service to be available
    const initializeManager = () => {
        if (window.storageService) {
            window.machineryManager = new NewMachineryManager();
        } else {
            // If storage service not ready, wait a bit and try again
            setTimeout(initializeManager, 50);
        }
    };
    
    initializeManager();
});