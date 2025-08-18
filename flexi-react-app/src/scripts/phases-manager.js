/**
 * Phases Manager - Handles production phases management
 */
import { BaseManager } from './baseManager.js';
import { ValidationService } from './validationService.js';
import { BusinessLogicService } from './businessLogicService.js';
import { editManager } from './editManager.js';
import { Utils } from './utils.js';
import { appStore } from './store.js'; // Import the store
import { attachFormValidationListeners, renderDiff } from './utils.js'; // Import renderDiff
import { show_delete_confirmation } from './banner.js'; // Import delete confirmation
import { phasesComponents } from './phasesComponents.js';

export class PhasesManager extends BaseManager {
    constructor() {
        super(null);
        this.editManager = editManager;
        this.event_listeners_attached = false;
        this.validationService = new ValidationService();
        this.businessLogic = new BusinessLogicService();
    }

    init(elementMap) {
        if (super.init(elementMap)) {
            // Subscribe to store updates and render initial state
            appStore.subscribe(() => this.render());
            this.render();

            this.setup_form_validation();
            this.attach_event_listeners();
            this.handle_phase_department_change();

            if (this.editManager) {
                const table = document.querySelector('.modern-table');
                if (table) {
                    this.editManager.init_table_edit(table);
                    this.editManager.register_save_handler(table, (row) => this.save_edit(row));
                    table.addEventListener('deleteRow', async (e) => {
                        const phaseId = e.detail.row.dataset.phaseId;
                        if (phaseId) await this.delete_phase(phaseId);
                    });
                }
            }
            return true;
        }
        return false;
    }

    render() {
        const { phases, isLoading } = appStore.getState();
        if (isLoading) {
            // Use component system for loading state
            const loadingData = { message: 'Loading...' };
            phasesComponents.updateContainer(
                this.elements.phases_table_body,
                'loading-state',
                [loadingData]
            );
        } else {
            this.render_phases(phases);
        }
    }

    get_element_map() {
        const elementIds = [
            'phase_name', 'phase_type', 'numero_persone', 'phase_work_center',
            'add_phase_btn', 'printing_params', 'packaging_params', 'phase_content',
            'v_stampa', 't_setup_stampa', 'costo_h_stampa', 'v_conf',
            't_setup_conf', 'costo_h_conf', 'contenuto_fase', 'phases_table_body'
        ];
        return this.get_elements_by_id(elementIds);
    }

    attach_event_listeners() {
        if (this.event_listeners_attached) {
            return;
        }

        this.elements.add_phase_btn?.addEventListener('click', () => this.handle_add_phase());

        this.elements.phase_type?.addEventListener('change', () => {
            this.handle_phase_department_change();
            this.validate_phase_form();
        });

        // Attach validation listeners using utility
        attachFormValidationListeners(
            this.elements,
            ['phase_name', 'phase_type', 'phase_work_center', 'v_stampa', 't_setup_stampa',
             'costo_h_stampa', 'v_conf', 't_setup_conf', 'costo_h_conf', 'contenuto_fase'],
            ['input', 'change'],
            () => this.validate_phase_form(),
            this
        );

        this.event_listeners_attached = true;
    }

    setup_form_validation() {
        this.validate_phase_form();
    }

    render_phases(phases) {
        if (!this.elements.phases_table_body) return;

        if (!phases || phases.length === 0) {
            // Use component system for empty state
            const emptyStateData = { message: 'No phases found. Add phases to get started.' };
            phasesComponents.updateContainer(
                this.elements.phases_table_body,
                'empty-state',
                [emptyStateData]
            );
            return;
        }

        // Use component system for efficient updates
        phasesComponents.updateContainer(
            this.elements.phases_table_body,
            'phases-phase-row',
            phases.map(phase => ({ phase, editManager: this.editManager }))
        );
    }

    create_phase_row(phase) {
        // Use component system instead of manual DOM creation
        const rowData = {
            phase: phase,
            editManager: this.editManager
        };
        
        const rowElement = phasesComponents.render('phases-phase-row', rowData);
        return rowElement;
    }

    handle_phase_department_change() {
        const phaseDepartment = this.elements.phase_type.value;
        const isPrinting = phaseDepartment === 'STAMPA';
        const isPackaging = phaseDepartment === 'CONFEZIONAMENTO';

        if (this.elements.printing_params) this.elements.printing_params.style.display = isPrinting ? 'block' : 'none';
        if (this.elements.packaging_params) this.elements.packaging_params.style.display = isPackaging ? 'block' : 'none';
        if (this.elements.phase_content) this.elements.phase_content.style.display = isPackaging ? 'block' : 'none';

        this.validate_phase_form();
    }

    validate_phase_form() {
        const phaseData = this.collect_phase_data();
        if (!phaseData) {
            this.elements.add_phase_btn.disabled = true;
            return false;
        }

        const validation = this.validationService.validate_phase(phaseData, { returnFieldMapping: true });
        return this.validate_form_with_button_state(validation, this.elements.add_phase_btn);
    }

    async handle_add_phase() {
        if (this.elements.add_phase_btn.disabled) return;
        this.elements.add_phase_btn.disabled = true;

        try {
            const phaseData = this.collect_phase_data();
            if (!this.validate_phase_form()) {
                throw new Error('Please fill in all required fields correctly.');
            }
            const newPhase = await appStore.addPhase(phaseData); // Use the store
            this.clear_form_fields();
            this.show_success_message('Phase added', newPhase.name);
        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error?.message || error));
            this.show_error_message('adding phase', errorObj);
        } finally {
            this.elements.add_phase_btn.disabled = false;
        }
    }

    collect_phase_data() {
        const department = this.elements.phase_type.value;
        if (!department) return null;

        const baseData = {
            name: this.elements.phase_name.value.trim(),
            department: department,
            numero_persone: parseInt(this.elements.numero_persone.value) || 1,
            work_center: this.elements.phase_work_center.value.trim()
        };

        const printingData = {
            v_stampa: parseFloat(this.elements.v_stampa.value) || 0,
            t_setup_stampa: parseFloat(this.elements.t_setup_stampa.value) || 0,
            costo_h_stampa: parseFloat(this.elements.costo_h_stampa.value) || 0,
            v_conf: 0, t_setup_conf: 0, costo_h_conf: 0, contenuto_fase: null
        };

        const packagingData = {
            v_stampa: 0, t_setup_stampa: 0, costo_h_stampa: 0,
            v_conf: parseFloat(this.elements.v_conf.value) || 0,
            t_setup_conf: parseFloat(this.elements.t_setup_conf.value) || 0,
            costo_h_conf: parseFloat(this.elements.costo_h_conf.value) || 0,
            contenuto_fase: this.elements.contenuto_fase.value.trim()
        };

        return department === 'STAMPA' ? { ...baseData, ...printingData } : { ...baseData, ...packagingData };
    }

    custom_clear_form() {
        this.handle_phase_department_change();
        this.elements.numero_persone.value = '1';
        this.elements.phase_work_center.value = 'ZANICA';
        this.elements.v_stampa.value = '6000';
        this.elements.t_setup_stampa.value = '0.5';
        this.elements.costo_h_stampa.value = '50';
        this.elements.v_conf.value = '1000';
        this.elements.t_setup_conf.value = '0.25';
        this.elements.costo_h_conf.value = '40';
        this.validate_phase_form();
    }

    async save_edit(row) {
        const phaseId = row.dataset.phaseId;
        if (!phaseId) return;

        const numericFields = ['v_stampa', 't_setup_stampa', 'costo_h_stampa', 'v_conf', 't_setup_conf', 'costo_h_conf'];
        const labels = { v_stampa: 'V Stampa', t_setup_stampa: 'T Setup Stampa' };
        const updatedData = this.validate_edit_row(row, [], numericFields, labels);

        if (!updatedData) return;

        try {
            const { phases } = appStore.getState();
            const phase = phases.find(p => p.id === phaseId);
            if (!phase) throw new Error('Phase not found');

            const updatedPhase = { ...phase, ...updatedData };
            for (const key of numericFields) {
                updatedPhase[key] = parseFloat(updatedPhase[key]) || 0;
            }
            updatedPhase.numero_persone = parseInt(updatedPhase.numero_persone, 10) || 1;

            await appStore.updatePhase(phaseId, updatedPhase); // Use the store
            this.editManager.cancel_edit(row);
            this.show_success_message('Phase updated');
        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error?.message || error));
            this.show_error_message('updating phase', errorObj);
        }
    }

    async delete_phase(phaseId) {
        try {
            const { phases } = appStore.getState();
            const phase = phases.find(p => p.id === phaseId);
            const phaseName = phase ? phase.name : 'this phase';
            const message = `Are you sure you want to delete "${phaseName}"? This action cannot be undone.`;
            
            show_delete_confirmation(message, async () => {
                try {
                    await appStore.removePhase(phaseId); // Use the store
                    this.show_success_message('Phase deleted');
                } catch (error) {
                    this.show_error_message('deleting phase', new Error('Failed to delete phase'));
                }
            });
        } catch(error) {
            this.show_error_message('deleting phase', error);
        }
    }
}