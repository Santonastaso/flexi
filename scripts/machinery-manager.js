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
        this.current_editing_type = null;
        this.current_editing_id = null;
        
        // Initialize centralized services
        this.validationService = new ValidationService();
        this.businessLogic = new BusinessLogicService();
        
        // Don't call init here - wait for proper initialization
        // this.init(this.get_element_map());
    }



    // Machine helper methods moved to BusinessLogicService



    init(elementMap) {
        // Set up storage service reference
        this.storageService = window.storageService;
        
        // Ensure storage service is available
        if (!this.storageService) {
            console.error('StorageService not available');
            return false;
        }
        
        // Ensure validation and business logic services are available
        if (!this.validationService || !this.businessLogic) {
            console.error('Required services not available');
            return false;
        }
        
        if (super.init(elementMap)) {
            this.load_machinery();
            this.setup_form_validation();
            
            // Attach event listeners for form interactions
            this.attach_event_listeners();
            
            // Initialize edit functionality
            if (this.editManager) {
                const machineryTable = document.querySelector('#machinery-table-body')?.closest('.modern-table');
                if (machineryTable) {
                    this.editManager.init_table_edit(machineryTable);
                    this.editManager.register_save_handler(machineryTable, (row) => this.save_edit(row));
                    machineryTable.addEventListener('deleteRow', (e) => {
                        const row = e.detail.row;
                        const machineId = row.dataset.machineId;
                        if (machineId) {
                            this.delete_machine(machineId);
                        }
                    });
                }
            }
            
            // Initialize changeover field visibility
            this.update_changeover_field_visibility();
            return true;
        }
        return false;
    }
    
    update_changeover_field_visibility() {
        const dep = this.elements.machine_department?.value;
        const dep_key = (dep || '').toUpperCase();
        const changeover_color = document.getElementById('changeover_color');
        const changeover_material = document.getElementById('changeover_material');
        const changeover_color_label = changeover_color?.previousElementSibling;
        const changeover_material_label = changeover_material?.previousElementSibling;
        
        if (dep_key === 'STAMPA') {
            if (changeover_color) changeover_color.style.display = 'block';
            if (changeover_color_label) changeover_color_label.style.display = 'block';
            if (changeover_material) changeover_material.style.display = 'none';
            if (changeover_material_label) changeover_material_label.style.display = 'none';
        } else if (dep_key === 'CONFEZIONAMENTO') {
            if (changeover_color) changeover_color.style.display = 'none';
            if (changeover_color_label) changeover_color_label.style.display = 'none';
            if (changeover_material) changeover_material.style.display = 'block';
            if (changeover_material_label) changeover_material_label.style.display = 'block';
        } else {
            // No department selected - hide both
            if (changeover_color) changeover_color.style.display = 'none';
            if (changeover_color_label) changeover_color_label.style.display = 'none';
            if (changeover_material) changeover_material.style.display = 'none';
            if (changeover_material_label) changeover_material_label.style.display = 'none';
        }
    }

    get_element_map() {
        try {
            const elementMap = {
                // IDENTIFICAZIONE elements
                machine_type: document.getElementById('machine_type'),
                machine_name: document.getElementById('machine_name'),
                machine_work_center: document.getElementById('machine_site'),
                machine_department: document.getElementById('machine_department'),

                // CAPACITÀ TECNICHE elements
                min_web_width: document.getElementById('min_web_width'),
                max_web_width: document.getElementById('max_web_width'),
                min_bag_height: document.getElementById('min_bag_height'),
                max_bag_height: document.getElementById('max_bag_height'),
                
                // PERFORMANCE elements
                standard_speed: document.getElementById('standard_speed'),
                setup_time_standard: document.getElementById('setup_time_standard'),
                changeover_color: document.getElementById('changeover_color'),
                changeover_material: document.getElementById('changeover_material'),
                
                // DISPONIBILITÀ elements
                active_shifts: document.querySelectorAll('input[type="checkbox"][value^="T"]'),
                
                // Action elements
                add_btn: document.getElementById('add_machine'),
                
                // Table elements
                machinery_table_body: document.getElementById('machinery_table_body')
            };
            
            // Check if critical elements exist
            const criticalElements = ['machine_type', 'machine_name', 'machine_work_center', 'machine_department', 'add_btn'];
            const missingElements = criticalElements.filter(key => !elementMap[key]);
            
            if (missingElements.length > 0) {
                // Some critical elements not found
                return null;
            }
            
            return elementMap;
        } catch (error) {
            console.error('Error getting element map:', error);
            return null;
        }
    }

    attach_event_listeners() {
        // Add machine button
        this.elements.add_btn.addEventListener('click', () => this.handle_add_machine());
        // Dynamic machine_type options based on department
        if (this.elements.machine_department && this.elements.machine_type) {
            const update_machine_types = () => {
                const dep = this.elements.machine_department.value;
                const type_select = this.elements.machine_type;
                const valid_types = this.businessLogic.get_valid_machine_types(dep);
                
                type_select.innerHTML = '<option value="">Select machine type</option>' + 
                    valid_types.map(value => `<option value="${value}">${value}</option>`).join('');
                
                // Show/hide changeover fields based on department
                this.update_changeover_field_visibility();
            };
            this.elements.machine_department.addEventListener('change', update_machine_types);
            update_machine_types();
        }

        // Form validation for all inputs
        const allInputs = [
            this.elements.machine_type, this.elements.machine_name, this.elements.machine_work_center, this.elements.machine_department,
            this.elements.min_web_width, this.elements.max_web_width, this.elements.min_bag_height, this.elements.max_bag_height,
            this.elements.standard_speed, this.elements.setup_time_standard, this.elements.changeover_color, this.elements.changeover_material
        ];

        allInputs.forEach(input => {
            if (input) {
            input.addEventListener('input', () => this.validate_form_fields());
            input.addEventListener('change', () => this.validate_form_fields());
            }
        });
        
        // Checkbox validation for shifts
        this.elements.active_shifts.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.validate_form_fields());
        });


    }

    setup_form_validation() {
        this.validate_form_fields();
    }



    validate_form_fields() {
        // Use centralized validation service
        const machineData = this.collect_machine_data();
        const validation = this.validationService.validate_machine(machineData);
        
        // Check that at least one shift is selected
        const has_shifts = Array.from(this.elements.active_shifts).some(checkbox => checkbox.checked);
        
        this.elements.add_btn.disabled = !(validation.isValid && has_shifts);
        
        // Show validation errors if any
        if (!validation.isValid) {
            // Validation errors handled by UI
        }
    }

    handle_add_machine() {
        const machineData = this.collect_machine_data();
        
        if (!machineData) {
            this.show_error_message('adding machine', new Error('Please fill in all required fields'));
            return;
        }

        // Use consolidated validation
        const validationConfig = {
            numericFields: ['standard_speed', 'min_web_width', 'max_web_width', 'min_bag_height', 'max_bag_height'],
            field_labels: {
                standard_speed: 'Standard speed',
                min_web_width: 'Min web width',
                max_web_width: 'Max web width',
                min_bag_height: 'Min bag height',
                max_bag_height: 'Max bag height'
            }
        };
        
        const validation = this.validate_form(machineData, validationConfig);
        if (!validation.isValid) {
            this.show_error_message('validating machine data', new Error(validation.errors.join(', ')));
            return;
        }



        try {
            // Check for duplicate machine name
            const existingMachines = this.storageService.get_machines();
            const isDuplicate = existingMachines.some(machine => 
                machine.machine_name === machineData.machine_name && 
                machine.work_center === machineData.work_center
            );
            
            if (isDuplicate) {
                this.show_error_message('adding machine', new Error('A machine with this name already exists at this work center'));
                return;
            }

            // Generate machine ID using business logic service
            if (!machineData.machine_id) {
                machineData.machine_id = this.businessLogic.generate_machine_id(machineData.machine_type, machineData.work_center);
            }

            // Add machine using the storage service
            const newMachine = this.storageService.add_machine(machineData);

            
            this.clear_form();
            
            // Reload the machinery list
            this.load_machinery();
            
            this.showMessage(`Machine "${newMachine.machine_name}" added successfully!`, 'success');
        } catch (error) {
            console.error('Error adding machine:', error);
            this.showMessage('Error adding machine: ' + error.message, 'error');
        }
    }

    collect_machine_data() {
        // Get selected shifts
        const selected_shifts = Array.from(this.elements.active_shifts)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

        const machineData = {
            // IDENTIFICAZIONE
            machine_type: Utils.normalize_code(this.elements.machine_type.value),
            machine_name: Utils.normalize_name(this.elements.machine_name.value),
            work_center: Utils.normalize_code(this.elements.machine_work_center.value),
            department: Utils.normalize_code(this.elements.machine_department.value),
            status: 'ACTIVE',
            
            // CAPACITÀ TECNICHE
            min_web_width: parseInt(this.elements.min_web_width.value) || null,
            max_web_width: parseInt(this.elements.max_web_width.value),
            min_bag_height: parseInt(this.elements.min_bag_height.value) || null,
            max_bag_height: parseInt(this.elements.max_bag_height.value),
            // removed fields: max_colors, supported_materials
            
            // PERFORMANCE
            standard_speed: parseInt(this.elements.standard_speed.value) || null,
            setup_time_standard: parseFloat(this.elements.setup_time_standard.value) || null,
            changeover_color: this.elements.machine_department.value === 'STAMPA' ? (parseFloat(this.elements.changeover_color.value) || null) : null,
            changeover_material: this.elements.machine_department.value === 'CONFEZIONAMENTO' ? (parseFloat(this.elements.changeover_material.value) || null) : null,
            
            // DISPONIBILITÀ
            active_shifts: selected_shifts
        };

        return machineData;
    }



    clear_form() {
        // Use base manager method to clear all form fields
        this.clear_form_fields();

        // Reset to default values and special cases
        this.elements.setup_time_standard.value = '0.5';
        this.elements.changeover_color.value = '0.25';
        this.elements.changeover_material.value = '0.75';
        
        // Reset checkboxes and set T1 as default
        this.elements.active_shifts.forEach(checkbox => checkbox.checked = false);
        if (this.elements.active_shifts[0]) {
            this.elements.active_shifts[0].checked = true; // T1 by default
        }

        this.validate_form_fields();
        this.update_changeover_field_visibility();
    }

    load_machinery() {
        // Get all machines for display (don't clean up on every load)
        const allMachines = this.storageService.get_machines();

        this.render_machinery(allMachines);
    }

    render_machinery(machines) {

        
        if (!machines || machines.length === 0) {
            this.elements.machinery_table_body.innerHTML = `
                <tr>
                    <td colspan="22" class="text-center" style="padding: 2rem; color: #6b7280;">
                        No machines available. Add machines to get started.
                    </td>
                </tr>
            `;
            return;
        }

        this.elements.machinery_table_body.innerHTML = machines.map(machine => 
            this.create_machine_row(machine)
        ).join('');
    }

    create_machine_row(machine) {
        const web_width_range = `${machine.min_web_width || 0}-${machine.max_web_width || 0}`;
        const bag_height_range = `${machine.min_bag_height || 0}-${machine.max_bag_height || 0}`;
        const created_date = machine.created_at ? new Date(machine.created_at).toLocaleDateString() : '-';
        const updated_date = machine.updated_at ? new Date(machine.updated_at).toLocaleDateString() : '-';
        
        // Use unified model helper for display name
        const display_name = machine.machine_name || machine.name || machine.id || 'Unknown Machine';
        const is_active = machine.status === 'active' || machine.live === true || machine.status === 'ACTIVE';
        
        return `
            <tr data-machine-id="${machine.id}" class="${!is_active ? 'machine-inactive' : ''}">
                <!-- IDENTIFICAZIONE (Identification) -->
                <td class="editable-cell" data-field="machine_id">
                    <span class="static-value"><strong>${machine.machine_id || machine.id}</strong></span>
                    ${this.editManager ? this.editManager.create_edit_input('text', machine.machine_id || machine.id) : ''}
                </td>
                <td class="editable-cell" data-field="machine_type">
                    <span class="static-value">
                        <span class="btn btn-primary" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                            ${machine.machine_type || '-'}
                        </span>
                    </span>
                    ${this.editManager ? this.editManager.create_edit_input('select', machine.machine_type, {
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
                    <span class="static-value">${display_name || '-'}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', display_name) : ''}
                </td>
                <td class="editable-cell" data-field="work_center">
                                            <span class="static-value">${machine.work_center || '-'}</span>
                                            ${this.editManager ? this.editManager.create_edit_input('select', machine.work_center, {
                        options: [
                            { value: 'ZANICA', label: 'ZANICA' },
                            { value: 'BUSTO_GAROLFO', label: 'BUSTO GAROLFO' }
                        ]
                    }) : ''}
                </td>
                <td class="editable-cell" data-field="department">
                    <span class="static-value">${machine.department || '-'}</span>
                    ${this.editManager ? this.editManager.create_edit_input('select', machine.department, {
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
                    ${this.editManager ? this.editManager.create_edit_input('select', machine.status || 'active', {
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
                    ${this.editManager ? this.editManager.create_edit_input('number', machine.min_web_width || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="max_web_width">
                    <span class="static-value">${machine.max_web_width || 0}</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', machine.max_web_width || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="min_bag_height">
                    <span class="static-value">${machine.min_bag_height || 0}</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', machine.min_bag_height || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="max_bag_height">
                    <span class="static-value">${machine.max_bag_height || 0}</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', machine.max_bag_height || 0, { min: 0 }) : ''}
                </td>

                
                <!-- PERFORMANCE -->
                <td class="editable-cell" data-field="standard_speed">
                    <span class="static-value">${machine.standard_speed || 0}</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', machine.standard_speed || 0, { min: 1 }) : ''}
                </td>

                <td class="editable-cell" data-field="setup_time_standard">
                    <span class="static-value">${machine.setup_time_standard || 0} h</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', machine.setup_time_standard || 0, { min: 0, step: 0.1 }) : ''}
                </td>
                <td class="editable-cell" data-field="changeover_color">
                    <span class="static-value">${machine.changeover_color || 0} h</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', machine.changeover_color || 0, { min: 0, step: 0.1 }) : ''}
                </td>
                <td class="editable-cell" data-field="changeover_material">
                    <span class="static-value">${machine.changeover_material || 0} h</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', machine.changeover_material || 0, { min: 0, step: 0.1 }) : ''}
                </td>
                
                <!-- DISPONIBILITÀ (Availability) -->
                <td class="editable-cell" data-field="active_shifts">
                    <span class="static-value">${Array.isArray(machine.active_shifts) ? machine.active_shifts.join(', ') : machine.active_shifts || '-'}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', Array.isArray(machine.active_shifts) ? machine.active_shifts.join(', ') : machine.active_shifts) : ''}
                </td>

                

                <td class="editable-cell" data-field="created_at">
                    <span class="static-value">${created_date}</span>
                    ${this.editManager ? this.editManager.create_edit_input('datetime-local', machine.created_at) : ''}
                </td>
                <td class="editable-cell" data-field="updated_at">
                    <span class="static-value">${updated_date}</span>
                    ${this.editManager ? this.editManager.create_edit_input('datetime-local', machine.updated_at) : ''}
                </td>
                
                <!-- Actions -->
                <td class="text-center">
                                           <a href="machine-settings-page.html?machine=${encodeURIComponent(machine.machine_name)}" 
                       class="btn btn-secondary btn-small">
                        📅
                    </a>
                </td>
                <td class="text-center">
                    ${this.editManager ? this.editManager.create_action_buttons() : ''}
                </td>
            </tr>
        `;
    }







    editMachine(machineId) {
        // Basic edit functionality - redirect to machine settings page
        const machine = this.storageService.get_machines().find(m => m.id === machineId);
        if (machine) {
            const encodedName = encodeURIComponent(machine.machine_name);
            window.location.href = `machine-settings-page.html?machine=${encodedName}`;
        } else {
            this.showMessage('Machine not found', 'error');
        }
    }

    delete_machine(machineId) {
        const machine = this.storageService.getMachines().find(m => m.id === machineId);
        const machine_name = machine ? machine.machine_name : 'this machine';
        
        try {
            // Check if machine can be deleted (not scheduled)
            this.storageService.validate_machineCanBeDeleted(machine_name);
            
            const message = `Are you sure you want to delete "${machine_name}"? This action cannot be undone.`;
            
            show_delete_confirmation(message, () => {
                try {
                    const machines = this.storageService.get_machines();
                    const filteredMachines = machines.filter(m => m.id !== machineId);
                    this.storageService.saveMachinesWithSync(filteredMachines);
                    this.load_machinery();
                    this.showMessage('Machine deleted successfully', 'success');
                } catch (error) {
                    this.showMessage('Error deleting machine: ' + error.message, 'error');
                }
            });
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    save_edit(row) {
        const machine_id = row.dataset.machineId;
        if (!machine_id) {
            console.error('No machine ID found in row');
            return;
        }

        // Use consolidated validation for edit row
        
        const updatedData = this.validate_edit_row(
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
            const machines = this.storageService.get_machines();
            const machine = machines.find(m => String(m.id) === String(machine_id));
            if (!machine) {
                this.showMessage('Machine not found', 'error');
                return;
            }
            


            // Update machine with new values
            const updated_machine = {
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
                numero_macchina: updatedData.machine_id || machine.machine_id || machine.numero_macchina,
                work_center: updatedData.work_center || machine.work_center,
                live: updatedData.status === 'active' ? true : (updatedData.status === 'inactive' ? false : machine.live)
            };

            // Handle web width and bag height ranges if provided
            if (updatedData.web_width) {
                const [min_width, max_width] = updatedData.web_width.split('-').map(w => parseInt(w));
                if (!isNaN(min_width)) updated_machine.min_web_width = min_width;
                if (!isNaN(max_width)) updated_machine.max_web_width = max_width;
            }

            if (updatedData.bag_height) {
                const [min_height, max_height] = updatedData.bag_height.split('-').map(h => parseInt(h));
                if (!isNaN(min_height)) updated_machine.min_bag_height = min_height;
                if (!isNaN(max_height)) updated_machine.max_bag_height = max_height;
            }
            






            // Save updated machine
            const updated_machines = machines.map(m => 
                String(m.id) === String(machine_id) ? updated_machine : m
            );
            this.storageService.saveMachinesWithSync(updated_machines);

            // Exit edit mode
            this.editManager.cancel_edit(row);

            // Update display
            this.load_machinery();
            this.showMessage('Machine updated successfully', 'success');

        } catch (error) {
            this.showMessage('Error updating machine: ' + error.message, 'error');
        }
    }


}

// Try immediate initialization if services are already available
if (window.storageService && 
    typeof ValidationService !== 'undefined' && 
    typeof BusinessLogicService !== 'undefined' &&
    typeof BaseManager !== 'undefined') {
    

    window.machineryManager = new MachineryManager();
    const elementMap = window.machineryManager.get_element_map();
    if (elementMap) {
        const initSuccess = window.machineryManager.init(elementMap);
                    if (initSuccess) {
                // MachineryManager initialized successfully
            }
    }
}

// Initialize when all resources are loaded and storage service is available
window.addEventListener('load', () => {
    // Wait for storage service to be available
    const initialize_manager = () => {
        try {
            // Check if all required services are available
            if (window.storageService && 
                typeof ValidationService !== 'undefined' && 
                typeof BusinessLogicService !== 'undefined' &&
                typeof BaseManager !== 'undefined') {
                

                
                // Create the manager instance
                window.machineryManager = new MachineryManager();
                
                // Initialize with proper error handling
                const elementMap = window.machineryManager.get_element_map();
                if (elementMap) {
                    const initSuccess = window.machineryManager.init(elementMap);
                    if (initSuccess) {
                        // MachineryManager initialized successfully
                    } else {
                        console.error('❌ Failed to initialize MachineryManager');
                    }
                } else {
                    console.error('❌ Failed to get element map for MachineryManager');
                }
            } else {
                // Log what's missing
                const missing = [];
                if (!window.storageService) missing.push('StorageService');
                if (typeof ValidationService === 'undefined') missing.push('ValidationService');
                if (typeof BusinessLogicService === 'undefined') missing.push('BusinessLogicService');
                if (typeof BaseManager === 'undefined') missing.push('BaseManager');
                

                
                // If services not ready, wait a bit and try again
                setTimeout(initialize_manager, 200);
            }
        } catch (error) {
            console.error('❌ Error initializing MachineryManager:', error);
            // Retry after a longer delay on error
            setTimeout(initialize_manager, 1000);
        }
    };
    
    // Start initialization process
    initialize_manager();
});