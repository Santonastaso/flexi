/**
 * Phases Manager - Handles production phases management
 */
import { BaseManager } from './baseManager.js';
import { ValidationService } from './validationService.js';
import { BusinessLogicService } from './businessLogicService.js';
import { editManager } from './editManager.js';
import { Utils } from './utils.js';
import { appStore } from './store.js'; // Import the store
import { attachFormValidationListeners } from './utils.js';

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
            this.elements.phases_table_body.innerHTML = `<tr><td colspan="15" class="text-center" style="padding: 2rem; color: #6b7280;">Loading...</td></tr>`;
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

        // Attach event listeners to form inputs
        const phaseInputs = [
            this.elements.phase_name, this.elements.phase_type, this.elements.phase_work_center, 
            this.elements.v_stampa, this.elements.t_setup_stampa,
            this.elements.costo_h_stampa, this.elements.v_conf, this.elements.t_setup_conf,
            this.elements.costo_h_conf, this.elements.contenuto_fase
        ];

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
        this.elements.phases_table_body.innerHTML = (!phases || phases.length === 0)
            ? `<tr><td colspan="15" class="text-center" style="padding: 2rem; color: #6b7280;">No phases found. Add phases to get started.</td></tr>`
            : phases.map(phase => this.create_phase_row(phase)).join('');
    }

    create_phase_row(phase) {
        const createdDate = phase.created_at ? new Date(phase.created_at).toLocaleDateString() : '-';
        const updatedDate = phase.updated_at ? new Date(phase.updated_at).toLocaleDateString() : '-';
        return `
            <tr data-phase-id="${phase.id}">
                <td class="editable-cell" data-field="id"><span class="static-value">${phase.id}</span>${this.editManager.create_edit_input('text', phase.id)}</td>
                <td class="editable-cell" data-field="name"><span class="static-value">${Utils.escape_html(phase.name||'-')}</span>${this.editManager.create_edit_input('text',phase.name)}</td>
                <td class="editable-cell" data-field="department"><span class="static-value"><span class="btn btn-primary" style="font-size:12px;padding:6px 12px;min-height:28px;">${Utils.escape_html(phase.department||'-')}</span></span>${this.editManager.create_edit_input('select',phase.department,{options:[{value:'STAMPA',label:'STAMPA'},{value:'CONFEZIONAMENTO',label:'CONFEZIONAMENTO'}]})}</td>
                <td class="editable-cell" data-field="work_center"><span class="static-value">${Utils.escape_html(phase.work_center||'-')}</span>${this.editManager.create_edit_input('select',phase.work_center,{options:[{value:'ZANICA',label:'ZANICA'},{value:'BUSTO_GAROLFO',label:'BUSTO GAROLFO'}]})}</td>
                <td class="editable-cell" data-field="v_stampa"><span class="static-value">${phase.v_stampa||0} mt/h</span>${this.editManager.create_edit_input('number',phase.v_stampa||0,{min:0})}</td>
                <td class="editable-cell" data-field="t_setup_stampa"><span class="static-value">${phase.t_setup_stampa||0} h</span>${this.editManager.create_edit_input('number',phase.t_setup_stampa||0,{min:0})}</td>
                <td class="editable-cell" data-field="costo_h_stampa"><span class="static-value">€${phase.costo_h_stampa||0}/h</span>${this.editManager.create_edit_input('number',phase.costo_h_stampa||0,{min:0,step:0.01})}</td>
                <td class="editable-cell" data-field="v_conf"><span class="static-value">${phase.v_conf||0} pz/h</span>${this.editManager.create_edit_input('number',phase.v_conf||0,{min:0})}</td>
                <td class="editable-cell" data-field="t_setup_conf"><span class="static-value">${phase.t_setup_conf||0} h</span>${this.editManager.create_edit_input('number',phase.t_setup_conf||0,{min:0})}</td>
                <td class="editable-cell" data-field="costo_h_conf"><span class="static-value">€${phase.costo_h_conf||0}/h</span>${this.editManager.create_edit_input('number',phase.costo_h_conf||0,{min:0,step:0.01})}</td>
                <td class="editable-cell" data-field="contenuto_fase"><span class="static-value">${Utils.escape_html(phase.contenuto_fase||'-')}</span>${this.editManager.create_edit_input('text',phase.contenuto_fase)}</td>
                <td class="editable-cell" data-field="numero_persone"><span class="static-value">${phase.numero_persone||'-'}</span>${this.editManager.create_edit_input('number',phase.numero_persone||1,{min:1})}</td>
                <td class="editable-cell" data-field="created_at"><span class="static-value">${createdDate}</span>${this.editManager.create_edit_input('datetime-local',phase.created_at)}</td>
                <td class="editable-cell" data-field="updated_at"><span class="static-value">${updatedDate}</span>${this.editManager.create_edit_input('datetime-local',phase.updated_at)}</td>
                <td class="text-center">${this.editManager.create_action_buttons()}</td>
            </tr>
        `;
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