/**
 * New Machinery Manager - Handles printing and packaging machinery with specific properties
 * 
 * UNIFIED MACHINE MODEL DEFINITION:
 * This is the single source of truth for all machine data in the application.
 */





class MachineryManager extends BaseManager {
    constructor() {
        super(window.storageService);
        this.editManager = window.editManager;
        this.currentEditingType = null;
        this.currentEditingId = null;
        
        // Initialize centralized services
        this.validationService = new ValidationService();
        this.businessLogic = new BusinessLogicService();
        
        this.init(this.getElementMap());
    }



    // Machine helper methods moved to BusinessLogicService



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
                const machineryTable = document.querySelector('#machinery-table-body')?.closest('.modern-table');
                if (machineryTable) {
                    this.editManager.initTableEdit(machineryTable);
                    this.editManager.registerSaveHandler(machineryTable, (row) => this.saveEdit(row));
                    machineryTable.addEventListener('deleteRow', (e) => {
                        const row = e.detail.row;
                        const machineId = row.dataset.machineId;
                        if (machineId) {
                            this.deleteMachine(machineId);
                        }
                    });
                }
            }
            
            // Initialize changeover field visibility
            this.updateChangeoverFieldVisibility();
        }
    }
    
    updateChangeoverFieldVisibility() {
        const dep = this.elements.machineDepartment?.value;
        const depKey = (dep || '').toUpperCase();
        const changeoverColor = document.getElementById('changeoverColor');
        const changeoverMaterial = document.getElementById('changeoverMaterial');
        const changeoverColorLabel = changeoverColor?.previousElementSibling;
        const changeoverMaterialLabel = changeoverMaterial?.previousElementSibling;
        
        if (depKey === 'STAMPA') {
            if (changeoverColor) changeoverColor.style.display = 'block';
            if (changeoverColorLabel) changeoverColorLabel.style.display = 'block';
            if (changeoverMaterial) changeoverMaterial.style.display = 'none';
            if (changeoverMaterialLabel) changeoverMaterialLabel.style.display = 'none';
        } else if (depKey === 'CONFEZIONAMENTO') {
            if (changeoverColor) changeoverColor.style.display = 'none';
            if (changeoverColorLabel) changeoverColorLabel.style.display = 'none';
            if (changeoverMaterial) changeoverMaterial.style.display = 'block';
            if (changeoverMaterialLabel) changeoverMaterialLabel.style.display = 'block';
        } else {
            // No department selected - hide both
            if (changeoverColor) changeoverColor.style.display = 'none';
            if (changeoverColorLabel) changeoverColorLabel.style.display = 'none';
            if (changeoverMaterial) changeoverMaterial.style.display = 'none';
            if (changeoverMaterialLabel) changeoverMaterialLabel.style.display = 'none';
        }
    }

    getElementMap() {
        return {
            // IDENTIFICAZIONE elements
            machineType: document.getElementById('machineType'),
            machineName: document.getElementById('machineName'),
            machineWorkCenter: document.getElementById('machineSite'),
            machineDepartment: document.getElementById('machineDepartment'),

            // CAPACITÀ TECNICHE elements
            minWebWidth: document.getElementById('minWebWidth'),
            maxWebWidth: document.getElementById('maxWebWidth'),
            minBagHeight: document.getElementById('minBagHeight'),
            maxBagHeight: document.getElementById('maxBagHeight'),

            // PERFORMANCE elements
            standardSpeed: document.getElementById('standardSpeed'),
            setupTimeStandard: document.getElementById('setupTimeStandard'),
            changeoverColor: document.getElementById('changeoverColor'),
            changeoverMaterial: document.getElementById('changeoverMaterial'),

            // DISPONIBILITÀ elements
            activeShifts: document.querySelectorAll('input[type="checkbox"][value^="T"]'),

            // Machine Button
            addBtn: document.getElementById('addMachine'),

            // Machine Table body
            machineryTableBody: document.getElementById('machinery-table-body'),


        };
    }

    attachEventListeners() {
        // Add machine button
        this.elements.addBtn.addEventListener('click', () => this.handleAddMachine());
        // Dynamic machineType options based on department
        if (this.elements.machineDepartment && this.elements.machineType) {
            const updateMachineTypes = () => {
                const dep = this.elements.machineDepartment.value;
                const typeSelect = this.elements.machineType;
                const validTypes = this.businessLogic.getValidMachineTypes(dep);
                
                typeSelect.innerHTML = '<option value="">Select machine type</option>' + 
                    validTypes.map(value => `<option value="${value}">${value}</option>`).join('');
                
                // Show/hide changeover fields based on department
                this.updateChangeoverFieldVisibility();
            };
            this.elements.machineDepartment.addEventListener('change', updateMachineTypes);
            updateMachineTypes();
        }

        // Form validation for all inputs
        const allInputs = [
            this.elements.machineType, this.elements.machineName, this.elements.machineSite, this.elements.machineDepartment,
            this.elements.minWebWidth, this.elements.maxWebWidth, this.elements.minBagHeight, this.elements.maxBagHeight,
            this.elements.standardSpeed, this.elements.setupTimeStandard, this.elements.changeoverColor, this.elements.changeoverMaterial
        ];

        allInputs.forEach(input => {
            if (input) {
            input.addEventListener('input', () => this.validateFormFields());
            input.addEventListener('change', () => this.validateFormFields());
            }
        });
        
        // Checkbox validation for shifts
        this.elements.activeShifts.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.validateFormFields());
        });


    }

    setupFormValidation() {
        this.validateFormFields();
    }



    validateFormFields() {
        // Use centralized validation service
        const machineData = this.collectMachineData();
        const validation = this.validationService.validateMachine(machineData);
        
        // Check that at least one shift is selected
        const hasShifts = Array.from(this.elements.activeShifts).some(checkbox => checkbox.checked);
        
        this.elements.addBtn.disabled = !(validation.isValid && hasShifts);
        
        // Show validation errors if any
        if (!validation.isValid) {
            validation.errors.forEach(error => {
                console.warn('Validation error:', error);
            });
        }
    }

    handleAddMachine() {
        const machineData = this.collectMachineData();
        
        if (!machineData) {
            this.showErrorMessage('adding machine', new Error('Please fill in all required fields'));
            return;
        }

        // Use consolidated validation
        const validationConfig = {
            numericFields: ['standardSpeed', 'min_web_width', 'max_web_width', 'min_bag_height', 'max_bag_height'],
            fieldLabels: {
                standardSpeed: 'Standard speed',
                min_web_width: 'Min web width',
                max_web_width: 'Max web width',
                min_bag_height: 'Min bag height',
                max_bag_height: 'Max bag height'
            }
        };
        
        const validation = this.validateForm(machineData, validationConfig);
        if (!validation.isValid) {
            this.showErrorMessage('validating machine data', new Error(validation.errors.join(', ')));
            return;
        }



        try {
            // Check for duplicate machine name
            const existingMachines = this.storageService.getMachines();
            const isDuplicate = existingMachines.some(machine => 
                machine.machine_name === machineData.machine_name && 
                machine.work_center === machineData.work_center
            );
            
            if (isDuplicate) {
                this.showErrorMessage('adding machine', new Error('A machine with this name already exists at this work center'));
                return;
            }

            // Generate machine ID using business logic service
            if (!machineData.machine_id) {
                machineData.machine_id = this.businessLogic.generateMachineId(machineData.machine_type, machineData.work_center);
            }

            // Add machine using the storage service
            const newMachine = this.storageService.addMachine(machineData);

            
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
        // Get selected shifts
        const selectedShifts = Array.from(this.elements.activeShifts)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

        const machineData = {
            // IDENTIFICAZIONE
            machine_type: Utils.normalizeCode(this.elements.machineType.value),
            machine_name: Utils.normalizeName(this.elements.machineName.value),
            work_center: Utils.normalizeCode(this.elements.machineWorkCenter.value),
            department: Utils.normalizeCode(this.elements.machineDepartment.value),
            status: 'ACTIVE',
            
            // CAPACITÀ TECNICHE
            min_web_width: parseInt(this.elements.minWebWidth.value) || null,
            max_web_width: parseInt(this.elements.maxWebWidth.value),
            min_bag_height: parseInt(this.elements.minBagHeight.value) || null,
            max_bag_height: parseInt(this.elements.maxBagHeight.value),
            // removed fields: max_colors, supported_materials
            
            // PERFORMANCE
            standard_speed: parseInt(this.elements.standardSpeed.value) || null,
            setup_time_standard: parseFloat(this.elements.setupTimeStandard.value) || null,
            changeover_color: this.elements.machineDepartment.value === 'STAMPA' ? (parseFloat(this.elements.changeoverColor.value) || null) : null,
            changeover_material: this.elements.machineDepartment.value === 'CONFEZIONAMENTO' ? (parseFloat(this.elements.changeoverMaterial.value) || null) : null,
            
            // DISPONIBILITÀ
            active_shifts: selectedShifts
        };

        return machineData;
    }



    clearForm() {
        // Use base manager method to clear all form fields
        this.clearFormFields();

        // Reset to default values and special cases
        this.elements.setupTimeStandard.value = '0.5';
        this.elements.changeoverColor.value = '0.25';
        this.elements.changeoverMaterial.value = '0.75';
        
        // Reset checkboxes and set T1 as default
        this.elements.activeShifts.forEach(checkbox => checkbox.checked = false);
        if (this.elements.activeShifts[0]) {
            this.elements.activeShifts[0].checked = true; // T1 by default
        }

        this.validateFormFields();
        this.updateChangeoverFieldVisibility();
    }

    loadMachinery() {
        // Get all machines for display (don't clean up on every load)
        const allMachines = this.storageService.getMachines();

        this.renderMachinery(allMachines);
    }

    renderMachinery(machines) {

        
        if (!machines || machines.length === 0) {
            this.elements.machineryTableBody.innerHTML = `
                <tr>
                    <td colspan="22" class="text-center" style="padding: 2rem; color: #6b7280;">
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
        const createdDate = machine.created_at ? new Date(machine.created_at).toLocaleDateString() : '-';
        const updatedDate = machine.updated_at ? new Date(machine.updated_at).toLocaleDateString() : '-';
        
        // Use unified model helper for display name
        const displayName = this.businessLogic.getMachineDisplayName(machine);
        const isActive = this.businessLogic.isActiveMachine(machine);
        
        return `
            <tr data-machine-id="${machine.id}" class="${!isActive ? 'machine-inactive' : ''}">
                <!-- IDENTIFICAZIONE (Identification) -->
                <td class="editable-cell" data-field="machine_id">
                    <span class="static-value"><strong>${machine.machine_id || machine.id}</strong></span>
                    ${this.editManager ? this.editManager.createEditInput('text', machine.machine_id || machine.id) : ''}
                </td>
                <td class="editable-cell" data-field="machine_type">
                    <span class="static-value">
                        <span class="btn btn-primary" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                            ${machine.machine_type || '-'}
                        </span>
                    </span>
                    ${this.editManager ? this.editManager.createEditInput('select', machine.machine_type, {
                        options: [
                            { value: 'DIGITAL_PRINT', label: 'Digital Print' },
                            { value: 'FLEXO_PRINT', label: 'Flexo Print' },
                            { value: 'ROTOGRAVURE', label: 'Rotogravure' },
                            { value: 'PACKAGING', label: 'Packaging' },
                            { value: 'DOYPACK', label: 'Doypack' }
                        ]
                    }) : ''}
                </td>
                <td class="editable-cell" data-field="machine_name">
                    <span class="static-value">${displayName || '-'}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', displayName) : ''}
                </td>
                <td class="editable-cell" data-field="work_center">
                                            <span class="static-value">${machine.work_center || '-'}</span>
                                            ${this.editManager ? this.editManager.createEditInput('select', machine.work_center, {
                        options: [
                            { value: 'ZANICA', label: 'ZANICA' },
                            { value: 'BUSTO_GAROLFO', label: 'BUSTO GAROLFO' }
                        ]
                    }) : ''}
                </td>
                <td class="editable-cell" data-field="department">
                    <span class="static-value">${machine.department || '-'}</span>
                    ${this.editManager ? this.editManager.createEditInput('select', machine.department, {
                        options: [
                            { value: 'STAMPA', label: 'STAMPA' },
                            { value: 'CONFEZIONAMENTO', label: 'CONFEZIONAMENTO' }
                        ]
                    }) : ''}
                </td>
                <td class="editable-cell" data-field="status">
                    <span class="static-value">
                        <span class="status-badge status-active">${machine.status || 'Active'}</span>
                    </span>
                    ${this.editManager ? this.editManager.createEditInput('select', machine.status || 'active', {
                        options: [
                            { value: 'active', label: 'Active' },
                            { value: 'maintenance', label: 'Maintenance' },
                            { value: 'inactive', label: 'Inactive' }
                        ]
                    }) : ''}
                </td>
                
                <!-- CAPACITÀ TECNICHE (Technical Capabilities) -->
                <td class="editable-cell" data-field="min_web_width">
                    <span class="static-value">${machine.min_web_width || 0}</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.min_web_width || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="max_web_width">
                    <span class="static-value">${machine.max_web_width || 0}</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.max_web_width || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="min_bag_height">
                    <span class="static-value">${machine.min_bag_height || 0}</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.min_bag_height || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="max_bag_height">
                    <span class="static-value">${machine.max_bag_height || 0}</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.max_bag_height || 0, { min: 0 }) : ''}
                </td>

                
                <!-- PERFORMANCE -->
                <td class="editable-cell" data-field="standard_speed">
                    <span class="static-value">${machine.standard_speed || 0}</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.standard_speed || 0, { min: 1 }) : ''}
                </td>

                <td class="editable-cell" data-field="setup_time_standard">
                    <span class="static-value">${machine.setup_time_standard || 0} h</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.setup_time_standard || 0, { min: 0, step: 0.1 }) : ''}
                </td>
                <td class="editable-cell" data-field="changeover_color">
                    <span class="static-value">${machine.changeover_color || 0} h</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.changeover_color || 0, { min: 0, step: 0.1 }) : ''}
                </td>
                <td class="editable-cell" data-field="changeover_material">
                    <span class="static-value">${machine.changeover_material || 0} h</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.changeover_material || 0, { min: 0, step: 0.1 }) : ''}
                </td>
                
                <!-- DISPONIBILITÀ (Availability) -->
                <td class="editable-cell" data-field="active_shifts">
                    <span class="static-value">${Array.isArray(machine.active_shifts) ? machine.active_shifts.join(', ') : machine.active_shifts || '-'}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', Array.isArray(machine.active_shifts) ? machine.active_shifts.join(', ') : machine.active_shifts) : ''}
                </td>

                

                <td class="editable-cell" data-field="created_at">
                    <span class="static-value">${createdDate}</span>
                    ${this.editManager ? this.editManager.createEditInput('datetime-local', machine.created_at) : ''}
                </td>
                <td class="editable-cell" data-field="updated_at">
                    <span class="static-value">${updatedDate}</span>
                    ${this.editManager ? this.editManager.createEditInput('datetime-local', machine.updated_at) : ''}
                </td>
                
                <!-- Actions -->
                <td class="text-center">
                                           <a href="machine-settings-page.html?machine=${encodeURIComponent(machine.machine_name)}" 
                       class="btn btn-secondary btn-small">
                        📅
                    </a>
                </td>
                <td class="text-center">
                    ${this.editManager ? this.editManager.createActionButtons() : ''}
                </td>
            </tr>
        `;
    }







    editMachine(machineId) {
        // Basic edit functionality - redirect to machine settings page
        const machine = this.storageService.getMachines().find(m => m.id === machineId);
        if (machine) {
            const encodedName = encodeURIComponent(machine.machine_name);
            window.location.href = `machine-settings-page.html?machine=${encodedName}`;
        } else {
            this.showMessage('Machine not found', 'error');
        }
    }

    deleteMachine(machineId) {
        const machine = this.storageService.getMachines().find(m => m.id === machineId);
        const machineName = machine ? machine.machine_name : 'this machine';
        
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
        if (window.DEBUG) console.log('saveEdit called with row:', row);
        const machineId = row.dataset.machineId;
        if (!machineId) {
            console.error('No machine ID found in row');
            return;
        }

        // Use consolidated validation for edit row
        if (window.DEBUG) console.log('About to call validateEditRow with:', {
            row,
            requiredFields: ['machine_name'],
            numericFields: ['standard_speed', 'setup_time_standard', 'changeover_color', 'changeover_material'],
            fieldLabels: {
                machine_name: 'Machine name',
                standard_speed: 'Standard speed',
                setup_time_standard: 'Setup time standard',
                changeover_color: 'Color changeover time',
                changeover_material: 'Material changeover time'
            }
        });
        
        const updatedData = this.validateEditRow(
            row,
            ['machine_name'], // Required fields
            ['standard_speed', 'setup_time_standard', 'changeover_color', 'changeover_material'], // Numeric fields
            {
                machine_name: 'Machine name',
                standard_speed: 'Standard speed',
                setup_time_standard: 'Setup time standard',
                changeover_color: 'Color changeover time',
                changeover_material: 'Material changeover time'
            }
        );
        
        if (!updatedData) {
            return; // Validation failed, error already shown
        }

        try {
            // Get current machine
            const machines = this.storageService.getMachines();
            const machine = machines.find(m => String(m.id) === String(machineId));
            if (!machine) {
                this.showMessage('Machine not found', 'error');
                return;
            }
            
            if (window.DEBUG) console.log('Processing machine update:', {
                machineId,
                currentMachine: machine,
                updatedData: updatedData
            });

            // Update machine with new values
            const updatedMachine = {
                ...machine,
                // New field names
                machine_name: updatedData.machine_name ? updatedData.machine_name.trim() : machine.machine_name,
                machine_type: updatedData.machine_type || machine.machine_type, // Prevent null
                work_center: updatedData.work_center || machine.work_center,
                department: updatedData.department || machine.department,
                standard_speed: updatedData.standard_speed ? parseInt(updatedData.standard_speed) || machine.standard_speed : machine.standard_speed,
                status: updatedData.status || machine.status,
                
                // Field names for compatibility
                name: updatedData.machine_name ? updatedData.machine_name.trim() : machine.machine_name,
                machine_name: updatedData.machine_name ? updatedData.machine_name.trim() : machine.machine_name,
                type: updatedData.machine_type || machine.machine_type, // Prevent null
                numeroMacchina: updatedData.machine_id || machine.machine_id || machine.numeroMacchina,
                work_center: updatedData.work_center || machine.work_center,
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
            
            if (window.DEBUG) console.log('Final updated machine object:', updatedMachine);





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
            window.machineryManager = new MachineryManager();
        } else {
            // If storage service not ready, wait a bit and try again
            setTimeout(initializeManager, 50);
        }
    };
    
    initializeManager();
});