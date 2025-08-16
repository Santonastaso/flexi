/**
 * New Machinery Manager - Handles printing and packaging machinery with specific properties
 * * UNIFIED MACHINE MODEL DEFINITION:
 * This is the single source of truth for all machine data in the application.
 */

import { BaseManager } from './baseManager.js';
import { ValidationService } from './validationService.js';
import { BusinessLogicService } from './businessLogicService.js';
import { storageService } from './storageService.js';
import { editManager } from './editManager.js';
import { Utils } from './utils.js';

export class MachineryManager extends BaseManager {
    constructor() {
        super(storageService);
        this.editManager = editManager;
        this.current_editing_type = null;
        this.current_editing_id = null;

        // Initialize centralized services
        this.validationService = new ValidationService();
        this.businessLogic = new BusinessLogicService();
    }

    async init(elementMap) {
        this.storageService = storageService;
        if (!this.storageService || !this.validationService || !this.businessLogic) {
            console.error('Required services not available');
            return false;
        }

        if (super.init(elementMap)) {
            this.setup_form_validation();
            this.attach_event_listeners();
            this.update_changeover_field_visibility();
            
            // Load machinery first, then initialize edit functionality
            await this.load_machinery();
            this.initialize_edit_functionality();
            
            return true;
        }
        return false;
    }

    initialize_edit_functionality() {
        if (this.editManager) {
            const table = document.querySelector('.modern-table');
            if (table) {
                this.editManager.init_table_edit(table);
                this.editManager.register_save_handler(table, (row) => {
                    return this.save_edit(row);
                });
                table.addEventListener('deleteRow', (e) => {
                    const machineId = e.detail.row.dataset.machineId;
                    if (machineId) {
                        this.delete_machine(machineId).catch(error => console.error('Error deleting machine:', error));
                    }
                });
            } else {
                console.error('❌ Table not found for edit functionality');
            }
        } else {
            console.error('❌ EditManager not available');
        }
    }

    update_changeover_field_visibility() {
        const dep_key = (this.elements.machine_department?.value || '').toUpperCase();
        const color_group = document.querySelector('label[for="changeover_color"]')?.closest('.form-group');
        const material_group = document.querySelector('label[for="changeover_material"]')?.closest('.form-group');

        if (color_group) color_group.style.display = (dep_key === 'STAMPA') ? 'block' : 'none';
        if (material_group) material_group.style.display = (dep_key === 'CONFEZIONAMENTO') ? 'block' : 'none';
    }


    get_element_map() {
        try {
            const elementIds = [
                'machine_type', 'machine_name', 'machine_site', 'machine_department',
                'min_web_width', 'max_web_width', 'min_bag_height', 'max_bag_height',
                'standard_speed', 'setup_time_standard', 'changeover_color', 'changeover_material',
                'add_machine', 'machinery_table_body'
            ];

            const elementMap = this.get_elements_by_id(elementIds);

            // Remap aliases
            elementMap.machine_work_center = elementMap.machine_site;
            elementMap.add_btn = elementMap.add_machine;
            elementMap.active_shifts = document.querySelectorAll('input[type="checkbox"][value^="T"]');

            const criticalElements = ['machine_type', 'machine_name', 'machine_work_center', 'machine_department', 'add_btn'];
            if (criticalElements.some(key => !elementMap[key])) return null;

            return elementMap;
        } catch (error) {
            console.error('Error getting element map:', error);
            return null;
        }
    }

    attach_event_listeners() {
        // Prevent duplicate event listeners
        if (this.elements.add_btn.dataset.listenerAttached) return;
        this.elements.add_btn.dataset.listenerAttached = 'true';
        
        this.elements.add_btn.addEventListener('click', () => this.handle_add_machine());

        if (this.elements.machine_department && this.elements.machine_type) {
            const update_machine_types = () => {
                const dep = this.elements.machine_department.value;
                const type_select = this.elements.machine_type;
                const valid_types = this.businessLogic.get_valid_machine_types(dep);
                type_select.innerHTML = '<option value="">Select machine type</option>' +
                    valid_types.map(value => `<option value="${value}">${value}</option>`).join('');
                this.update_changeover_field_visibility();
            };
            this.elements.machine_department.addEventListener('change', update_machine_types);
            update_machine_types(); // Initial call
        }

        const allInputs = [
            this.elements.machine_type, this.elements.machine_name, this.elements.machine_work_center,
            this.elements.machine_department, this.elements.min_web_width, this.elements.max_web_width,
            this.elements.min_bag_height, this.elements.max_bag_height, this.elements.standard_speed,
            this.elements.setup_time_standard, this.elements.changeover_color, this.elements.changeover_material
        ];

        allInputs.forEach(input => {
            if (input) {
                input.addEventListener('input', () => this.validate_form_fields());
                input.addEventListener('change', () => this.validate_form_fields());
            }
        });

        this.elements.active_shifts.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.validate_form_fields());
        });
    }

    setup_form_validation() {
        this.validate_form_fields();
    }

    validate_form_fields() {
        const machineData = this.collect_machine_data();
        if (!machineData) {
            this.elements.add_btn.disabled = true;
            return false;
        }

        const formData = {
            ...machineData,
            active_shifts: Array.from(this.elements.active_shifts).map(checkbox => checkbox.checked)
        };

        const validation = this.validationService.validate_machine(formData, { returnFieldMapping: true });
        return this.validate_form_with_button_state(validation, this.elements.add_btn);
    }

    // Validation methods now inherited from BaseManager

    async handle_add_machine() {
        if (this.elements.add_btn.disabled) return;
        
        // Prevent double-clicking
        if (this.elements.add_btn.dataset.processing === 'true') return;
        this.elements.add_btn.dataset.processing = 'true';
        this.elements.add_btn.disabled = true;

        try {
            const machineData = this.collect_machine_data();
            if (!machineData || !this.validate_form_fields()) {
                throw new Error('Please fill in all required fields correctly.');
            }

            const existingMachines = await this.storageService.get_machines();
            if (existingMachines.some(m => m.machine_name === machineData.machine_name && m.work_center === machineData.work_center)) {
                throw new Error('A machine with this name already exists at this work center.');
            }

            if (!machineData.machine_id) {
                machineData.machine_id = this.businessLogic.generate_machine_id(machineData.machine_type, machineData.work_center);
            }

            const newMachine = await this.storageService.add_machine(machineData);
            this.clear_form();
            await this.load_machinery();
            this.show_success_message(`Machine "${newMachine.machine_name}" added successfully!`);
        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error?.message || error));
            this.show_error_message('adding machine', errorObj);
        } finally {
            this.elements.add_btn.disabled = false;
            this.elements.add_btn.dataset.processing = 'false';
        }
    }

    collect_machine_data() {
        return {
            machine_type: Utils.normalize_code(this.elements.machine_type.value),
            machine_name: Utils.normalize_name(this.elements.machine_name.value),
            work_center: Utils.normalize_code(this.elements.machine_work_center.value),
            department: Utils.normalize_code(this.elements.machine_department.value),
            status: 'ACTIVE',
            min_web_width: parseInt(this.elements.min_web_width.value) || null,
            max_web_width: parseInt(this.elements.max_web_width.value) || null,
            min_bag_height: parseInt(this.elements.min_bag_height.value) || null,
            max_bag_height: parseInt(this.elements.max_bag_height.value) || null,
            standard_speed: parseInt(this.elements.standard_speed.value) || null,
            setup_time_standard: parseFloat(this.elements.setup_time_standard.value) || null,
            changeover_color: this.elements.machine_department.value === 'STAMPA' ? (parseFloat(this.elements.changeover_color.value) || null) : null,
            changeover_material: this.elements.machine_department.value === 'CONFEZIONAMENTO' ? (parseFloat(this.elements.changeover_material.value) || null) : null,
            active_shifts: Array.from(this.elements.active_shifts).filter(cb => cb.checked).map(cb => cb.value)
        };
    }

    clear_form() {
        // Use the base class method to clear all form fields
        this.clear_form_fields();
    }

    /**
     * Custom form clearing logic for machinery
     * Called automatically by the base class clear_form_fields method
     */
    custom_clear_form() {
        // Set default values for machinery-specific fields
        this.elements.setup_time_standard.value = '0.5';
        this.elements.changeover_color.value = '0.25';
        this.elements.changeover_material.value = '0.75';
        this.elements.active_shifts.forEach(checkbox => checkbox.checked = (checkbox.value === 'T1'));
        
        // Validate the form after clearing
        this.validate_form_fields();
        this.update_changeover_field_visibility();
    }

    async load_machinery() {
        try {
            const allMachines = await this.storageService.get_machines();
            this.render_machinery(allMachines);
        } catch (error) {
            console.error('Error loading machinery:', error);
            this.render_machinery([]);
        }
    }

    render_machinery(machines) {
        if (!machines || !Array.isArray(machines) || machines.length === 0) {
            this.elements.machinery_table_body.innerHTML = `<tr><td colspan="22" class="text-center" style="padding: 2rem; color: #6b7280;">No machines available. Add machines to get started.</td></tr>`;
            return;
        }
        this.elements.machinery_table_body.innerHTML = machines.map(m => this.create_machine_row(m)).join('');
    }

    create_machine_row(machine) {
        // This function is primarily HTML generation and remains unchanged for brevity.
        const created_date = machine.created_at ? new Date(machine.created_at).toLocaleDateString() : '-';
        const updated_date = machine.updated_at ? new Date(machine.updated_at).toLocaleDateString() : '-';
        const display_name = machine.machine_name || machine.id || 'Unknown Machine';
        const is_active = machine.status === 'ACTIVE';
        return `
            <tr data-machine-id="${machine.id}" class="${!is_active ? 'machine-inactive' : ''}">
                <td class="editable-cell" data-field="machine_id"><span class="static-value"><strong>${machine.machine_id || machine.id}</strong></span>${this.editManager.create_edit_input('text', machine.machine_id || machine.id)}</td>
                <td class="editable-cell" data-field="machine_type"><span class="static-value">${machine.machine_type||'-'}</span>${this.editManager.create_edit_input('select',machine.machine_type,{options:[{value:'DIGITAL_PRINT',label:'Digital Print'},{value:'FLEXO_PRINT',label:'Flexo Print'},{value:'ROTOGRAVURE',label:'Rotogravure'},{value:'PACKAGING',label:'Packaging'},{value:'DOYPACK',label:'Doypack'}]})}</td>
                <td class="editable-cell" data-field="machine_name"><span class="static-value">${display_name||'-'}</span>${this.editManager.create_edit_input('text',display_name)}</td>
                <td class="editable-cell" data-field="work_center"><span class="static-value">${machine.work_center||'-'}</span>${this.editManager.create_edit_input('select',machine.work_center,{options:[{value:'ZANICA',label:'ZANICA'},{value:'BUSTO_GAROLFO',label:'BUSTO GAROLFO'}]})}</td>
                <td class="editable-cell" data-field="department"><span class="static-value"><span class="btn btn-primary" style="font-size:12px;padding:6px 12px;min-height:28px;">${machine.department||'-'}</span></span>${this.editManager.create_edit_input('select',machine.department,{options:[{value:'STAMPA',label:'STAMPA'},{value:'CONFEZIONAMENTO',label:'CONFEZIONAMENTO'}]})}</td>
                <td class="editable-cell" data-field="status"><span class="static-value"><span class="status-badge status-active">${machine.status||'Active'}</span></span>${this.editManager.create_edit_input('select',machine.status||'active',{options:[{value:'active',label:'Active'},{value:'maintenance',label:'Maintenance'},{value:'inactive',label:'Inactive'}]})}</td>
                <td class="editable-cell" data-field="min_web_width"><span class="static-value">${machine.min_web_width||0}</span>${this.editManager.create_edit_input('number',machine.min_web_width||0,{min:0})}</td>
                <td class="editable-cell" data-field="max_web_width"><span class="static-value">${machine.max_web_width||0}</span>${this.editManager.create_edit_input('number',machine.max_web_width||0,{min:0})}</td>
                <td class="editable-cell" data-field="min_bag_height"><span class="static-value">${machine.min_bag_height||0}</span>${this.editManager.create_edit_input('number',machine.min_bag_height||0,{min:0})}</td>
                <td class="editable-cell" data-field="max_bag_height"><span class="static-value">${machine.max_bag_height||0}</span>${this.editManager.create_edit_input('number',machine.max_bag_height||0,{min:0})}</td>
                <td class="editable-cell" data-field="standard_speed"><span class="static-value">${machine.standard_speed||0}</span>${this.editManager.create_edit_input('number',machine.standard_speed||0,{min:1})}</td>
                <td class="editable-cell" data-field="setup_time_standard"><span class="static-value">${machine.setup_time_standard||0} h</span>${this.editManager.create_edit_input('number',machine.setup_time_standard||0,{min:0,step:0.1})}</td>
                <td class="editable-cell" data-field="changeover_color"><span class="static-value">${machine.changeover_color||0} h</span>${this.editManager.create_edit_input('number',machine.changeover_color||0,{min:0,step:0.1})}</td>
                <td class="editable-cell" data-field="changeover_material"><span class="static-value">${machine.changeover_material||0} h</span>${this.editManager.create_edit_input('number',machine.changeover_material||0,{min:0,step:0.1})}</td>
                <td class="editable-cell" data-field="active_shifts"><span class="static-value">${Array.isArray(machine.active_shifts)?machine.active_shifts.join(', '):machine.active_shifts||'-'}</span>${this.editManager.create_edit_input('shifts',machine.active_shifts)}</td>
                <td class="editable-cell" data-field="created_at"><span class="static-value">${created_date}</span>${this.editManager.create_edit_input('datetime-local',machine.created_at)}</td>
                <td class="editable-cell" data-field="updated_at"><span class="static-value">${updated_date}</span>${this.editManager.create_edit_input('datetime-local',machine.updated_at)}</td>
                <td class="text-center"><a href="machine-settings-page.html?machine=${encodeURIComponent(machine.machine_name)}" class="btn btn-secondary btn-small">📅</a></td>
                <td class="text-center">${this.editManager.create_action_buttons()}</td>
            </tr>
        `;
    }

    async editMachine(machineId) {
        try {
            const machine = await this.storageService.get_machine_by_id(machineId); // Assuming this method exists for efficiency
            if (machine) {
                window.location.href = `machine-settings-page.html?machine=${encodeURIComponent(machine.machine_name)}`;
            } else {
                this.show_error_message('finding machine', new Error('Machine not found'));
            }
        } catch (error) {
            this.show_error_message('finding machine', new Error('Failed to find machine'));
        }
    }

    async delete_machine(machineId) {
        try {
            const machine = await this.storageService.get_machine_by_id(machineId);
            const machine_name = machine?.machine_name || 'this machine';
            await this.storageService.validate_machine_can_be_deleted(machineId);
            const message = `Are you sure you want to delete "${machine_name}"? This action cannot be undone.`;

            if (typeof window.show_delete_confirmation === 'function') {
                window.show_delete_confirmation(message, async () => {
                    try {
                        await this.storageService.remove_machine(machineId);
                        await this.load_machinery();
                        this.show_success_message('Machine deleted successfully');
                    } catch (error) {
                        this.show_error_message('deleting machine', new Error('Failed to delete machine'));
                    }
                });
            } else {
                throw new Error('Delete confirmation dialog not available');
            }
        } catch (error) {
            this.show_error_message('deleting machine', error);
        }
    }

    async save_edit(row) {
        if (row.dataset.saving === 'true') {
            return;
        }
        
        const machine_id = row.dataset.machineId;
        
        if (!machine_id) {
            console.error('❌ No machine ID found in row dataset');
            return;
        }
        
        row.dataset.saving = 'true';

        try {
            const currentMachine = await this.storageService.get_machine_by_id(machine_id);
            const department = currentMachine?.department || 'STAMPA';

            const numericFields = ['standard_speed', 'setup_time_standard', department === 'STAMPA' ? 'changeover_color' : 'changeover_material'];
            const field_labels = {
                machine_name: 'Machine name',
                standard_speed: 'Standard speed',
                setup_time_standard: 'Setup time standard',
                changeover_color: 'Color changeover time',
                changeover_material: 'Material changeover time'
            };

            const updatedData = this.validate_edit_row(row, ['machine_name'], numericFields, field_labels);
            
            if (!updatedData) {
                return;
            }

            // No need to check for changes; let the update operation handle it.
            const updated_machine = { ...currentMachine, ...updatedData, updated_at: new Date().toISOString() };
            
            // Re-parse numeric fields to ensure correct type - handle empty strings properly
            ['min_web_width', 'max_web_width', 'min_bag_height', 'max_bag_height', 'standard_speed'].forEach(f => {
                const value = updated_machine[f];
                if (value === '' || value === null || value === undefined) {
                    updated_machine[f] = 0;
                } else {
                    updated_machine[f] = parseInt(value, 10) || 0;
                }
            });
            ['setup_time_standard', 'changeover_color', 'changeover_material'].forEach(f => {
                const value = updated_machine[f];
                if (value === '' || value === null || value === undefined) {
                    updated_machine[f] = 0;
                } else {
                    updated_machine[f] = parseFloat(value) || 0;
                }
            });
            
            await this.storageService.update_machine(machine_id, updated_machine);
            this.editManager.cancel_edit(row);
            await this.load_machinery();
            this.show_success_message('Machine updated successfully');
        } catch (error) {
            console.error('❌ Error in save_edit:', error);
            console.error('❌ Error stack:', error.stack);
            this.show_error_message('updating machine', error);
        } finally {
            delete row.dataset.saving;
        }
    }
}