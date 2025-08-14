/**
 * Phases Manager - Handles production phases management
 */
class PhasesManager extends BaseManager {
    constructor() {
        // Don't call super with storageService yet - it might not be available
        super(null);
        this.editManager = window.editManager;
        
        // Initialize centralized services
        this.validationService = new ValidationService();
        this.businessLogic = new BusinessLogicService();
        
        // Don't call init here - wait for proper initialization
        // this.init();
    }

    init() {
        // Set up storage service reference
        this.storageService = window.storageService;
        
        if (!this.validate_storage_service()) return;
        
        if (super.init(this.get_element_map())) {
            this.load_phases().catch(error => {
                console.error('Error loading phases:', error);
            });
            this.setup_form_validation();
            
            // Attach event listeners for form interactions
            this.attach_event_listeners();
            
            // Set initial field visibility based on current department selection
            // Only call if a department is actually selected
            if (this.elements.phase_type && this.elements.phase_type.value) {
                this.handle_phase_department_change();
            } else {
                // Ensure all sections are hidden initially
                if (this.elements.printing_params) this.elements.printing_params.style.display = 'none';
                if (this.elements.packaging_params) this.elements.packaging_params.style.display = 'none';
                if (this.elements.phase_content) this.elements.phase_content.style.display = 'none';
            }
            
            // Initialize edit functionality
            if (this.editManager) {
                const table = document.querySelector('.modern-table');
                if (table) {
                    this.editManager.init_table_edit(table);
                    this.editManager.register_save_handler(table, (row) => this.save_edit(row));
                    table.addEventListener('deleteRow', async (e) => {
                        const row = e.detail.row;
                        const phaseId = row.dataset.phaseId;
                        if (phaseId) {
                            await this.delete_phase(phaseId);
                        }
                    });
                }
            }
            
            return true; // Return true to indicate successful initialization
        }
        
        return false; // Return false if super.init failed
    }

    get_element_map() {
        return {
            // Form elements
            phase_name: document.getElementById('phase_name'),
            phase_type: document.getElementById('phase_type'),
            numero_persone: document.getElementById('numero_persone'),
            phase_work_center: document.getElementById('phase_work_center'),
            add_phase_btn: document.getElementById('add_phase_btn'),
            printing_params: document.getElementById('printing_params'),
            packaging_params: document.getElementById('packaging_params'),
            phase_content: document.getElementById('phase_content'),
            v_stampa: document.getElementById('v_stampa'),
            t_setup_stampa: document.getElementById('t_setup_stampa'),
            costo_h_stampa: document.getElementById('costo_h_stampa'),
            v_conf: document.getElementById('v_conf'),
            t_setup_conf: document.getElementById('t_setup_conf'),
            costo_h_conf: document.getElementById('costo_h_conf'),
            contenuto_fase: document.getElementById('contenuto_fase'),
            phases_table_body: document.getElementById('phases_table_body')
        };
    }

    attach_event_listeners() {
        // Phase management event listeners
        if (this.elements.add_phase_btn) {
            this.elements.add_phase_btn.addEventListener('click', () => this.handle_add_phase());
        }

        // Department change event listener
        if (this.elements.phase_type) {
            this.elements.phase_type.addEventListener('change', () => {
                this.handle_phase_department_change();
                this.validate_phase_form(); // Re-validate after department change
            });
        }

        // Phase form validation
        const phaseInputs = [
            this.elements.phase_name, this.elements.phase_type, this.elements.numero_persone, this.elements.phase_work_center,
            this.elements.v_stampa, this.elements.t_setup_stampa, this.elements.costo_h_stampa, 
            this.elements.v_conf, this.elements.t_setup_conf, this.elements.costo_h_conf,
            this.elements.contenuto_fase
        ];

        phaseInputs.forEach(input => {
            if (input) {
                input.addEventListener('input', () => this.validate_phase_form());
                input.addEventListener('change', () => this.validate_phase_form());
            }
        });
    }

    setup_form_validation() {
        this.validate_phase_form();
        
        // Department change event listener is already handled in attach_event_listeners
        // to avoid duplicate event binding
        

    }

    async load_phases() {
        const phases = await this.storageService.get_phases();

        this.render_phases(phases);
    }

    render_phases(phases) {
        if (!phases || phases.length === 0) {
                    this.elements.phases_table_body.innerHTML = `
            <tr>
                <td colspan="14" class="text-center" style="padding: 2rem; color: #6b7280;">
                    No phases found. Add phases to get started.
                </td>
            </tr>
        `;
            return;
        }

        this.elements.phases_table_body.innerHTML = phases.map(phase => this.create_phase_row(phase)).join('');
    }

    create_phase_row(phase) {
        const createdDate = phase.created_at ? new Date(phase.created_at).toLocaleDateString() : '-';
        const updatedDate = phase.updated_at ? new Date(phase.updated_at).toLocaleDateString() : '-';
        
        return `
            <tr data-phase-id="${phase.id}">
                <!-- IDENTIFICAZIONE (Identification) -->
                <td class="editable-cell" data-field="id">
                    <span class="static-value">${phase.id}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', phase.id) : ''}
                </td>
                <td class="editable-cell" data-field="name">
                    <span class="static-value">${Utils.escape_html(phase.name || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', phase.name) : ''}
                </td>
                <td class="editable-cell" data-field="department">
                    <span class="static-value">
                        <span class="btn btn-primary" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">
                            ${Utils.escape_html(phase.department || '-')}
                        </span>
                    </span>
                    ${this.editManager ? this.editManager.create_edit_input('select', phase.department, {
                        options: [
                            { value: 'STAMPA', label: 'STAMPA' },
                            { value: 'CONFEZIONAMENTO', label: 'CONFEZIONAMENTO' }
                        ]
                    }) : ''}
                </td>
                <td class="editable-cell" data-field="work_center">
                    <span class="static-value">${Utils.escape_html(phase.work_center || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('select', phase.work_center, {
                        options: [
                            { value: 'ZANICA', label: 'ZANICA' },
                            { value: 'BUSTO_GAROLFO', label: 'BUSTO GAROLFO' }
                        ]
                    }) : ''}
                </td>

                
                <!-- PRINTING PARAMETERS -->
                <td class="editable-cell" data-field="v_stampa">
                    <span class="static-value">${phase.v_stampa || 0} mt/h</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', phase.v_stampa || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="t_setup_stampa">
                    <span class="static-value">${phase.t_setup_stampa || 0} h</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', phase.t_setup_stampa || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="costo_h_stampa">
                    <span class="static-value">€${phase.costo_h_stampa || 0}/h</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', phase.costo_h_stampa || 0, { min: 0, step: 0.01 }) : ''}
                </td>
                
                <!-- PACKAGING PARAMETERS -->
                <td class="editable-cell" data-field="v_conf">
                    <span class="static-value">${phase.v_conf || 0} pz/h</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', phase.v_conf || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="t_setup_conf">
                    <span class="static-value">${phase.t_setup_conf || 0} h</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', phase.t_setup_conf || 0, { min: 0 }) : ''}
                </td>
                <td class="editable-cell" data-field="costo_h_conf">
                    <span class="static-value">€${phase.costo_h_conf || 0}/h</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', phase.costo_h_conf || 0, { min: 0, step: 0.01 }) : ''}
                </td>
                
                <!-- PHASE CONTENT -->
                <td class="editable-cell" data-field="contenuto_fase">
                    <span class="static-value">${Utils.escape_html(phase.contenuto_fase || '-')}</span>
                    ${this.editManager ? this.editManager.create_edit_input('text', phase.contenuto_fase) : ''}
                </td>
                
                <!-- PEOPLE -->
                <td class="editable-cell" data-field="numero_persone">
                    <span class="static-value">${phase.numero_persone || '-'}</span>
                    ${this.editManager ? this.editManager.create_edit_input('number', phase.numero_persone || 1, { min: 1 }) : ''}
                </td>
                
                <!-- TIMESTAMPS -->
                <td class="editable-cell" data-field="created_at">
                    <span class="static-value">${createdDate}</span>
                    ${this.editManager ? this.editManager.create_edit_input('datetime-local', phase.created_at) : ''}
                </td>
                <td class="editable-cell" data-field="updated_at">
                    <span class="static-value">${updatedDate}</span>
                    ${this.editManager ? this.editManager.create_edit_input('datetime-local', phase.updated_at) : ''}
                </td>
                
                <!-- Actions -->
                <td class="text-center">
                    ${this.editManager ? this.editManager.create_action_buttons() : ''}
                </td>
            </tr>
        `;
    }

    handle_phase_department_change() {
        const phaseDepartment = this.elements.phase_type.value;
        
        // Hide all parameter sections
        if (this.elements.printing_params) {
            this.elements.printing_params.style.display = 'none';
        }
        if (this.elements.packaging_params) {
            this.elements.packaging_params.style.display = 'none';
        }
        if (this.elements.phase_content) {
            this.elements.phase_content.style.display = 'none';
        }
        
        // Show relevant parameter section
        if (phaseDepartment === 'STAMPA') {
            if (this.elements.printing_params) {
                this.elements.printing_params.style.display = 'block';
            }
        } else if (phaseDepartment === 'CONFEZIONAMENTO') {
            if (this.elements.packaging_params) {
                this.elements.packaging_params.style.display = 'block';
            }
            if (this.elements.phase_content) {
                this.elements.phase_content.style.display = 'block';
            }
        }
        
        this.validate_phase_form();
    }

    validate_phase_form() {
        // Use centralized validation service
        const phaseData = this.collect_phase_data();
        if (!phaseData) {
            this.elements.add_phase_btn.disabled = true;
            return;
        }
        
        const validation = this.validationService.validate_phase(phaseData);
        this.elements.add_phase_btn.disabled = !validation.isValid;
        
        // Show validation errors if any
        if (!validation.isValid) {
            // Validation errors handled by UI
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

    clear_validation_errors() {
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

    async handle_add_phase() {
        console.log('handle_add_phase called');
        
        // Prevent double submission
        if (this.elements.add_phase_btn.disabled) {
            console.log('Add phase button already disabled, preventing double submission');
            return;
        }
        
        // Disable button to prevent double submission
        this.elements.add_phase_btn.disabled = true;
        
        try {
            // Clear previous validation errors
            this.clear_validation_errors();
            
            const phaseData = this.collect_phase_data();
            
            if (!phaseData) {
                this.showValidationError('phase_name', 'Phase name is required');
                this.showValidationError('phase_type', 'Department is required');
                return;
            }

            // Use consolidated validation for numeric fields
            const validationConfig = {
                numericFields: ['v_stampa', 't_setup_stampa', 'costo_h_stampa', 'v_conf', 't_setup_conf', 'costo_h_conf'],
                field_labels: {
                    v_stampa: 'Printing speed (mt/h)',
                    t_setup_stampa: 'Printing setup time (h)',
                    costo_h_stampa: 'Printing hourly cost',
                    v_conf: 'Packaging speed (pz/h)',
                    t_setup_conf: 'Packaging setup time (h)',
                    costo_h_conf: 'Packaging hourly cost'
                }
            };
            
            const validation = this.validate_form(phaseData, validationConfig);
            if (!validation.isValid) {
                // Show inline validation errors
                validation.errors.forEach(error => {
                    if (error.includes('Printing speed')) {
                        this.showValidationError('v_stampa', error);
                    } else if (error.includes('Printing setup time')) {
                        this.showValidationError('t_setup_stampa', error);
                    } else if (error.includes('Printing hourly cost')) {
                        this.showValidationError('costo_h_stampa', error);
                    } else if (error.includes('Packaging speed')) {
                        this.showValidationError('v_conf', error);
                    } else if (error.includes('Packaging setup time')) {
                        this.showValidationError('t_setup_conf', error);
                    } else if (error.includes('Packaging hourly cost')) {
                        this.showValidationError('costo_h_conf', error);
                    }
                });
                return;
            }

            const newPhase = await this.storageService.add_phase(phaseData);
            this.clear_phase_form();
            this.load_phases().catch(error => {
                console.error('Error loading phases:', error);
            });
            this.show_success_message('Phase added', newPhase.name);
        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(error?.message || error?.toString() || 'Failed to add phase');
            this.show_error_message('adding phase', errorObj);
        } finally {
            // Re-enable button after operation completes
            this.elements.add_phase_btn.disabled = false;
        }
    }

    collect_phase_data() {
        const phaseDepartment = this.elements.phase_type.value;
        
        const baseData = {
            name: this.elements.phase_name.value.trim(),
            department: phaseDepartment,
            numero_persone: parseInt(this.elements.numero_persone.value) || 1,
            work_center: this.elements.phase_work_center.value.trim()
        };

        if (phaseDepartment === 'STAMPA') {
            return {
                ...baseData,
                v_stampa: parseFloat(this.elements.v_stampa.value) || 0,
                t_setup_stampa: parseFloat(this.elements.t_setup_stampa.value) || 0,
                costo_h_stampa: parseFloat(this.elements.costo_h_stampa.value) || 0,
                v_conf: 0,
                t_setup_conf: 0,
                costo_h_conf: 0,
                contenuto_fase: null
            };
        } else if (phaseDepartment === 'CONFEZIONAMENTO') {
            return {
                ...baseData,
                v_stampa: 0,
                t_setup_stampa: 0,
                costo_h_stampa: 0,
                v_conf: parseFloat(this.elements.v_conf.value) || 0,
                t_setup_conf: parseFloat(this.elements.t_setup_conf.value) || 0,
                costo_h_conf: parseFloat(this.elements.costo_h_conf.value) || 0,
                contenuto_fase: this.elements.contenuto_fase.value.trim()
            };
        }

        return null;
    }

    clear_phase_form() {
        // Use base manager method to clear all form fields
        this.clear_form_fields();
        
        // Reset specific display states
        this.elements.printing_params.style.display = 'none';
        this.elements.packaging_params.style.display = 'none';
        this.elements.phase_content.style.display = 'none';
        
        // Set default values for new phases
        if (this.elements.numero_persone) this.elements.numero_persone.value = '1'; // Default people required
        if (this.elements.phase_work_center) this.elements.phase_work_center.value = 'ZANICA'; // Default work center
        if (this.elements.v_stampa) this.elements.v_stampa.value = '6000'; // Default printing speed mt/h
        if (this.elements.t_setup_stampa) this.elements.t_setup_stampa.value = '0.5'; // Default setup time h
        if (this.elements.costo_h_stampa) this.elements.costo_h_stampa.value = '50'; // Default hourly cost
        if (this.elements.v_conf) this.elements.v_conf.value = '1000'; // Default packaging speed pz/h
        if (this.elements.t_setup_conf) this.elements.t_setup_conf.value = '0.25'; // Default setup time h
        if (this.elements.costo_h_conf) this.elements.costo_h_conf.value = '40'; // Default hourly cost
        
        this.validate_phase_form();
    }

    async save_edit(row) {
        const phaseId = row.dataset.phaseId;
        if (!phaseId) {
            console.error('No phase ID found in row');
            return;
        }

        // Use consolidated validation for edit row
        const updatedData = this.validate_edit_row(
            row,
            [], // No required fields for phases edit
            ['v_stampa', 't_setup_stampa', 'costo_h_stampa', 'v_conf', 't_setup_conf', 'costo_h_conf'], // Numeric fields
            {
                v_stampa: 'V Stampa',
                t_setup_stampa: 'T Setup Stampa', 
                costo_h_stampa: 'Costo H Stampa',
                v_conf: 'V Conf',
                t_setup_conf: 'T Setup Conf',
                costo_h_conf: 'Costo H Conf'
            }
        );
        
        if (!updatedData) {
            return; // Validation failed, error already shown
        }

        try {
            // Get current phase
            const phase = await this.storageService.get_phase_by_id(phaseId);
            if (!phase) {
                this.showMessage('Phase not found', 'error');
                return;
            }

            // Update phase with new values
            const updatedPhase = {
                ...phase,
                name: updatedData.name || phase.name,
                department: updatedData.department || phase.department,
                numero_persone: parseInt(updatedData.numero_persone) || phase.numero_persone || 1,
                v_stampa: parseInt(updatedData.v_stampa) || phase.v_stampa,
                t_setup_stampa: parseFloat(updatedData.t_setup_stampa) || phase.t_setup_stampa,
                costo_h_stampa: parseFloat(updatedData.costo_h_stampa) || phase.costo_h_stampa,
                v_conf: parseInt(updatedData.v_conf) || phase.v_conf,
                t_setup_conf: parseFloat(updatedData.t_setup_conf) || phase.t_setup_conf,
                costo_h_conf: parseFloat(updatedData.costo_h_conf) || phase.costo_h_conf
            };





            // Update phase
            await this.storageService.update_phase(phaseId, updatedPhase);

            // Exit edit mode
            this.editManager.cancel_edit(row);

            // Update display
            this.load_phases().catch(error => {
                console.error('Error loading phases:', error);
            });
            this.show_success_message('Phase updated');

        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(error?.message || error?.toString() || 'Failed to update phase');
            this.show_error_message('updating phase', errorObj);
        }
    }

    async delete_phase(phaseId) {
        const phase = await this.storageService.get_phase_by_id(phaseId);
        const phaseName = phase ? phase.name : 'this phase';
        
        const message = `Are you sure you want to delete "${phaseName}"? This action cannot be undone.`;
        
        show_delete_confirmation(message, async () => {
            try {
                await this.storageService.remove_phase(phaseId);
                this.load_phases().catch(error => {
                console.error('Error loading phases:', error);
            });
                this.show_success_message('Phase deleted');
            } catch (error) {
                const errorObj = error instanceof Error ? error : new Error(error?.message || error?.toString() || 'Failed to delete phase');
                this.show_error_message('deleting phase', errorObj);
            }
        });
    }
}

// Initialize when all resources are loaded and storage service is available
window.addEventListener('load', () => {
    BaseManager.initialize_manager(PhasesManager, 'phasesManager');
}); 