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
        this.init(this.getElementMap());
    }



    /**
     * Check if a machine is available for production
     * @param {Object} machine - Machine object
     * @returns {boolean} - True if machine is available
     */
    static isActiveMachine(machine) {
        return machine && machine.status && machine.status.toUpperCase() === 'ACTIVE';
    }

    /**
     * Get display name for machine (with fallback to legacy fields)
     * @param {Object} machine - Machine object
     * @returns {string} - Display name
     */
    static getMachineDisplayName(machine) {
        return machine.machine_name || machine.name || machine.nominazione || 'Unknown Machine';
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
            input.addEventListener('input', () => this.validateFormFields());
            input.addEventListener('change', () => this.validateFormFields());
            }
        });

        // Multi-select validation
                if (this.elements.supportedMaterials) {
            this.elements.supportedMaterials.addEventListener('change', () => this.validateFormFields());
        }
        
        // Checkbox validation for shifts
        this.elements.activeShifts.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.validateFormFields());
        });


    }

    setupFormValidation() {
        this.validateFormFields();
    }



    validateFormFields() {
        // Check required identification fields
        const requiredFields = ['machineType', 'machineName', 'machineSite', 'machineDepartment', 'minWebWidth', 'maxWebWidth', 'minBagHeight', 'maxBagHeight', 'maxColors', 'standardSpeed', 'efficiencyFactor', 'setupTimeStandard', 'changeoverColor', 'changeoverMaterial', 'hoursPerShift'];
        
        const fieldData = {
            machineType: this.elements.machineType.value,
            machineName: this.elements.machineName.value.trim(),
            machineSite: this.elements.machineSite.value,
            machineDepartment: this.elements.machineDepartment.value,
            minWebWidth: this.elements.minWebWidth.value,
            maxWebWidth: this.elements.maxWebWidth.value,
            minBagHeight: this.elements.minBagHeight.value,
            maxBagHeight: this.elements.maxBagHeight.value,
            maxColors: this.elements.maxColors.value,
            standardSpeed: this.elements.standardSpeed.value,
            efficiencyFactor: this.elements.efficiencyFactor.value,
            setupTimeStandard: this.elements.setupTimeStandard.value,
            changeoverColor: this.elements.changeoverColor.value,
            changeoverMaterial: this.elements.changeoverMaterial.value,
            hoursPerShift: this.elements.hoursPerShift.value
        };
        
        const hasRequiredFields = Utils.hasRequiredFields(fieldData, requiredFields);
        
        // Check that at least one shift is selected
        const hasShifts = Array.from(this.elements.activeShifts).some(checkbox => checkbox.checked);
        
        this.elements.addBtn.disabled = !(hasRequiredFields && hasShifts);
    }

    validateMachineNumericFields(machineData) {
        const fieldLabels = {
            min_web_width: 'Minimum web width',
            max_web_width: 'Maximum web width',
            min_bag_height: 'Minimum bag height',
            max_bag_height: 'Maximum bag height',
            max_colors: 'Maximum colors',
            standard_speed: 'Standard speed',
            efficiency_factor: 'Efficiency factor',
            setup_time_standard: 'Setup time',
            changeover_color: 'Color changeover time',
            changeover_material: 'Material changeover time',
            hours_per_shift: 'Hours per shift'
        };

        const numericFields = [
            'min_web_width', 'max_web_width', 'min_bag_height', 'max_bag_height', 'max_colors',
            'standard_speed', 'efficiency_factor', 'setup_time_standard', 'changeover_color',
            'changeover_material', 'hours_per_shift'
        ];

        return Utils.validateNumericFields(numericFields, machineData, fieldLabels);
    }

    handleAddMachine() {
        const machineData = this.collectMachineData();
        
        if (!machineData) {
            this.showErrorMessage('adding machine', new Error('Please fill in all required fields'));
            return;
        }

        // Use consolidated validation
        const validationConfig = {
            numericFields: ['maxColors', 'standardSpeed', 'hoursPerShift', 'min_web_width', 'max_web_width', 'min_bag_height', 'max_bag_height'],
            fieldLabels: {
                maxColors: 'Max colors',
                standardSpeed: 'Standard speed',
                hoursPerShift: 'Hours per shift',
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
                machine.site === machineData.site
            );
            
            if (isDuplicate) {
                this.showErrorMessage('adding machine', new Error('A machine with this name already exists at this site'));
                return;
            }

            // Add machine using the new storage service method
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
        // Get selected materials
        const selectedMaterials = Array.from(this.elements.supportedMaterials.selectedOptions).map(option => option.value);
        
        // Get selected shifts
        const selectedShifts = Array.from(this.elements.activeShifts)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

        const machineData = {
            // IDENTIFICAZIONE
            machine_type: this.elements.machineType.value,
            machine_name: this.elements.machineName.value.trim(),
            site: this.elements.machineSite.value,
            department: this.elements.machineDepartment.value,
            status: 'ACTIVE', // Default to active for new machines
            
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
            setup_time_standard: parseFloat(this.elements.setupTimeStandard.value),
            changeover_color: parseFloat(this.elements.changeoverColor.value),
            changeover_material: parseFloat(this.elements.changeoverMaterial.value),
            
            // DISPONIBILITÀ
            active_shifts: selectedShifts,
            hours_per_shift: parseFloat(this.elements.hoursPerShift.value),
            maintenance_schedule: {},
            availability_calendar: {}
        };

        return machineData;
    }



    clearForm() {
        // Use base manager method to clear all form fields
        this.clearFormFields();

        // Reset to default values and special cases
        this.elements.hoursPerShift.value = '8.0';
        this.elements.efficiencyFactor.value = '0.85';
        this.elements.setupTimeStandard.value = '0.5';
        this.elements.changeoverColor.value = '0.25';
        this.elements.changeoverMaterial.value = '0.75';
        this.elements.supportedMaterials.selectedIndex = -1;
        
        // Reset checkboxes and set T1 as default
        this.elements.activeShifts.forEach(checkbox => checkbox.checked = false);
        if (this.elements.activeShifts[0]) {
            this.elements.activeShifts[0].checked = true; // T1 by default
        }

        this.validateFormFields();
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
                    <td colspan="28" class="text-center" style="padding: 2rem; color: #6b7280;">
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
        const createdDate = machine.created_at ? new Date(machine.created_at).toLocaleDateString() : '-';
        const updatedDate = machine.updated_at ? new Date(machine.updated_at).toLocaleDateString() : '-';
        
        // Use unified model helper for display name
        const displayName = MachineryManager.getMachineDisplayName(machine);
        const isActive = MachineryManager.isActiveMachine(machine);
        
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
                            ${machine.machine_type || machine.type || '-'}
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
                <td class="editable-cell" data-field="machine_name">
                    <span class="static-value">${displayName || '-'}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', displayName) : ''}
                </td>
                <td class="editable-cell" data-field="site">
                    <span class="static-value">${machine.site || '-'}</span>
                    ${this.editManager ? this.editManager.createEditInput('select', machine.site, {
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
                <td class="editable-cell" data-field="supported_materials">
                    <span class="static-value">${Array.isArray(machine.supported_materials) ? machine.supported_materials.join(', ') : machine.supported_materials || '-'}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', Array.isArray(machine.supported_materials) ? machine.supported_materials.join(', ') : machine.supported_materials) : ''}
                </td>
                <td class="editable-cell" data-field="max_colors">
                    <span class="static-value">${machine.max_colors || 0}</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.max_colors || 0, { min: 1, max: 12 }) : ''}
                </td>
                
                <!-- PERFORMANCE -->
                <td class="editable-cell" data-field="standard_speed">
                    <span class="static-value">${machine.standard_speed || 0}</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.standard_speed || 0, { min: 1 }) : ''}
                </td>
                <td class="editable-cell" data-field="efficiency_factor">
                    <span class="static-value">${efficiencyPercent}%</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.efficiency_factor || 0.85, { min: 0, max: 1, step: 0.01 }) : ''}
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
                <td class="editable-cell" data-field="hours_per_shift">
                    <span class="static-value">${machine.hours_per_shift || 8.0}h</span>
                    ${this.editManager ? this.editManager.createEditInput('number', machine.hours_per_shift || 8.0, { min: 1, max: 24, step: 0.5 }) : ''}
                </td>
                
                <!-- Additional fields for compatibility -->
                <td class="editable-cell" data-field="name">
                    <span class="static-value">${machine.name || '-'}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', machine.name) : ''}
                </td>
                <td class="editable-cell" data-field="nominazione">
                    <span class="static-value">${machine.nominazione || '-'}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', machine.nominazione) : ''}
                </td>
                <td class="editable-cell" data-field="type">
                    <span class="static-value">${machine.type || '-'}</span>
                    ${this.editManager ? this.editManager.createEditInput('text', machine.type) : ''}
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
                    <a href="machine-settings-page.html?machine=${encodeURIComponent(machine.machine_name || machine.name)}" 
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
                    <a href="machine-settings-page.html?machine=${encodedName}" 
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
                    <a href="machine-settings-page.html?machine=${encodedName}" 
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
        console.log('saveEdit called with row:', row);
        const machineId = row.dataset.machineId;
        if (!machineId) {
            console.error('No machine ID found in row');
            return;
        }

        // Use consolidated validation for edit row
        console.log('About to call validateEditRow with:', {
            row,
            requiredFields: ['machine_name'],
            numericFields: ['machine_id', 'max_colors', 'standard_speed', 'efficiency_factor', 'setup_time_standard', 'changeover_color', 'changeover_material', 'hours_per_shift'],
            fieldLabels: {
                machine_name: 'Machine name',
                machine_id: 'Machine ID',
                max_colors: 'Max colors',
                standard_speed: 'Standard speed',
                efficiency_factor: 'Efficiency factor',
                setup_time_standard: 'Setup time standard',
                changeover_color: 'Color changeover time',
                changeover_material: 'Material changeover time',
                hours_per_shift: 'Hours per shift'
            }
        });
        
        const updatedData = this.validateEditRow(
            row,
            ['machine_name'], // Required fields
            ['max_colors', 'standard_speed', 'efficiency_factor', 'setup_time_standard', 'changeover_color', 'changeover_material', 'hours_per_shift'], // Numeric fields
            {
                machine_name: 'Machine name',
                max_colors: 'Max colors',
                standard_speed: 'Standard speed',
                efficiency_factor: 'Efficiency factor',
                setup_time_standard: 'Setup time standard',
                changeover_color: 'Color changeover time',
                changeover_material: 'Material changeover time',
                hours_per_shift: 'Hours per shift'
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
            
            console.log('Processing machine update:', {
                machineId,
                currentMachine: machine,
                updatedData: updatedData
            });

            // Update machine with new values - handle both new and legacy field names
            const updatedMachine = {
                ...machine,
                // New field names
                machine_name: updatedData.machine_name ? updatedData.machine_name.trim() : machine.machine_name,
                machine_type: updatedData.machine_type || machine.machine_type || machine.type, // Prevent null
                site: updatedData.site || machine.site,
                department: updatedData.department || machine.department,
                max_colors: updatedData.max_colors ? parseInt(updatedData.max_colors) || machine.max_colors : machine.max_colors,
                standard_speed: updatedData.standard_speed ? parseInt(updatedData.standard_speed) || machine.standard_speed : machine.standard_speed,
                efficiency_factor: updatedData.efficiency_factor ? parseFloat(updatedData.efficiency_factor) || machine.efficiency_factor : machine.efficiency_factor,
                status: updatedData.status || machine.status,
                
                // Legacy field names for backward compatibility
                name: updatedData.machine_name ? updatedData.machine_name.trim() : machine.machine_name,
                nominazione: updatedData.machine_name ? updatedData.machine_name.trim() : machine.machine_name,
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
            
            console.log('Final updated machine object:', updatedMachine);





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