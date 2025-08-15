/**
 * Backlog Manager - Manages production orders (ODP) in the backlog
 */
import { BaseManager } from './baseManager.js';
import { ValidationService } from './validationService.js';
import { BusinessLogicService } from './businessLogicService.js';
import { storageService } from './storageService.js';
import { editManager } from './editManager.js';
import { Utils } from './utils.js';

export class BacklogManager extends BaseManager {
    constructor() {
        super(null);
        this.editManager = editManager;
        this.validationService = new ValidationService();
        this.businessLogic = new BusinessLogicService();
        this.storageService = storageService;
    }

    init(elementMap) {
        // Set up storage service reference
        this.storageService = storageService;
        
        if (!this.validate_storage_service()) return false;
        
        if (super.init(elementMap)) {
            this.load_backlog(); // This is now async but we don't await to avoid blocking
            this.setup_form_validation();
            
            // Attach event listeners for form interactions
            this.attach_event_listeners();
            
            // Initialize bag preview
            this.update_bag_preview();
        
        // Initialize edit functionality
        if (this.editManager) {
                const tableBody = document.querySelector('#backlog_table_body');
                if (tableBody) {
                    this.editManager.init_table_edit(tableBody);
                    this.editManager.register_save_handler(tableBody, (row) => this.save_edit(row));
                    
                    // Add delete event listener
                                        tableBody.addEventListener('deleteRow', async (e) => {
                    const row = e.detail.row;
                        const odpId = row.dataset.odpId;
                        if (odpId) {
                            await this.delete_odp_order(odpId);
                    }
                });
            }
            }
            
            return true;
        }
        
        return false;
    }

    get_element_map() {
        const elementIds = [
            // Form elements
            'odp_number', 'article_code', 'production_lot', 'work_center', 'nome_cliente',
            'description', 'delivery_date', 'bag_height', 'bag_width', 'bag_step',
            'seal_sides', 'product_type', 'quantity', 'department', 'fase',
            'internal_customer_code', 'external_customer_code', 'customer_order_ref',
            'calculate_btn', 'create_task', 'update_statuses_btn', 'debug_events_btn',
            'backlog_table_body',
            // Preview elements
            'preview_fascia', 'preview_altezza', 'preview_passo'
        ];
        
        // Get elements using base class helper
        return this.get_elements_by_id(elementIds);
    }

    attach_event_listeners() {
        // Event handlers mapping
        const eventHandlers = {
            handle_article_code_change: ['article_code'],
            populate_phases_dropdown: ['department', 'work_center'],
            update_bag_preview: ['bag_width', 'bag_height', 'bag_step'],
            validate_form_fields: [
                'odp_number', 'article_code', 'production_lot', 'work_center', 'nome_cliente',
                'description', 'delivery_date', 'bag_height', 'bag_width', 'bag_step',
                'seal_sides', 'product_type', 'quantity', 'department', 'fase',
                'internal_customer_code', 'external_customer_code', 'customer_order_ref'
            ]
        };

        // Attach listeners for single-click actions
        if (this.elements.calculate_btn) this.elements.calculate_btn.addEventListener('click', () => this.handle_calculate());
        if (this.elements.create_task) this.elements.create_task.addEventListener('click', () => this.handle_create_task());
        if (this.elements.update_statuses_btn) this.elements.update_statuses_btn.addEventListener('click', () => this.sync_all_odp_with_gantt());
        if (this.elements.debug_events_btn) this.elements.debug_events_btn.addEventListener('click', () => this.debug_scheduled_events());

        // Attach listeners for input/change events that trigger the same handler
        ['input', 'change'].forEach(event => {
            eventHandlers.handle_article_code_change.forEach(id => this.elements[id]?.addEventListener(event, () => this.handle_article_code_change()));
            eventHandlers.validate_form_fields.forEach(id => this.elements[id]?.addEventListener(event, () => this.validate_form_fields()));
        });

        eventHandlers.populate_phases_dropdown.forEach(id => this.elements[id]?.addEventListener('change', () => this.populate_phases_dropdown().catch(console.error)));
        eventHandlers.update_bag_preview.forEach(id => this.elements[id]?.addEventListener('input', () => this.update_bag_preview()));

        // Initial setup
        this.populate_phases_dropdown().catch(console.error);
        this.hide_calculation_results();
    }


    setup_form_validation() {
        this.validate_form_fields();
    }

    handle_article_code_change() {
        const articleCode = this.elements.article_code.value.trim();
        if (!articleCode) return;
        
            const department = this.businessLogic.auto_determine_department(articleCode);
            const workCenter = this.businessLogic.auto_determine_work_center(articleCode);
            
        if (this.elements.work_center) this.elements.work_center.value = workCenter;
        if (this.elements.department) this.elements.department.value = department;
        if (this.elements.article_code) this.elements.article_code.dataset.department = department;

        if (window.DEBUG) console.log(`Set department to: ${department}`);

        this.populate_phases_dropdown().catch(error => console.error('Error populating phases dropdown:', error));
            this.validate_form_fields();
    }

    validate_form_fields(updateButtonState = true) {
        const formData = this.collect_form_data();
        const validation = this.validationService.validate_odp(formData, { context: 'form', returnFieldMapping: true });
        const isValid = Object.keys(validation.errors).length === 0;
        
        this.clear_validation_errors();
        
        if (!isValid) {
            Object.entries(validation.errors).forEach(([field, errorMessage]) => {
                this.show_validation_error(field, errorMessage);
            });
        }
        
        if (updateButtonState) {
            if (this.elements.calculate_btn) this.elements.calculate_btn.disabled = !isValid;
            if (this.elements.create_task) this.elements.create_task.disabled = !isValid;
        }

        if (window.DEBUG) console.log(`Form validation result: ${isValid}`, validation.errors);
        
        return isValid;
    }

    collect_form_data() {
        const data = {};
        const fields = [
            'odp_number', 'article_code', 'production_lot', 'work_center', 'nome_cliente',
            'delivery_date', 'bag_height', 'bag_width', 'bag_step', 'seal_sides',
            'product_type', 'quantity', 'fase', 'department'
        ];
        fields.forEach(field => {
            data[field] = this.elements[field]?.value?.trim() || '';
        });
        return data;
    }

    clear_validation_errors() {
        // Clear all validation error spans
        document.querySelectorAll('.validation_error').forEach(span => {
            span.style.display = 'none';
            span.textContent = '';
        });
    }

    show_validation_error(fieldName, errorMessage) {
        // Show error for specific field
        const errorSpan = document.getElementById(`${fieldName}_error`);
        if (errorSpan) {
            errorSpan.textContent = errorMessage;
            errorSpan.style.display = 'block';
        }
    }

    /**
     * Update the bag specification visual preview
     */
    update_bag_preview() {
        if (this.elements.preview_fascia) this.elements.preview_fascia.textContent = this.elements.bag_width?.value || '-';
        if (this.elements.preview_altezza) this.elements.preview_altezza.textContent = this.elements.bag_height?.value || '-';
        if (this.elements.preview_passo) this.elements.preview_passo.textContent = this.elements.bag_step?.value || '-';
    }


    async handle_calculate() {
        try {
            if (!this.validate_form_fields()) {
                this.show_error_message('validating form fields', new Error('Please fill in all required fields'));
                return;
            }

            const selectedPhaseId = this.elements.fase.value;
            if (!selectedPhaseId) {
                this.show_error_message('validating phase selection', new Error('Please select a production phase'));
                return;
            }

            const phases = await this.storageService.get_phases();
            console.log('Available phases:', phases, 'Selected phase ID:', selectedPhaseId);
            const selectedPhase = phases.find(phase => phase.id === selectedPhaseId);
            console.log('Selected phase found:', selectedPhase);
            
            if (!selectedPhase) {
                this.show_error_message('finding selected phase', new Error('Selected phase not found'));
                return;
            }

            const quantity = parseInt(this.elements.quantity.value) || 0;
            const bagStep = parseInt(this.elements.bag_step.value) || 0;

            const results = this.calculate_production_metrics(selectedPhase, quantity, bagStep);
            console.log('Calculation results:', results);
            
            this.display_calculation_results(results);
            this.show_success_message('Calculation completed successfully');
        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error?.message || error));
            this.show_error_message('calculating production metrics', errorObj);
        }
    }

    calculate_production_metrics(phase, quantity, bagStep) {
        const results = {
            printing: { processing_time: 0, setup_time: 0, total_time: 0, cost: 0 },
            packaging: { processing_time: 0, setup_time: 0, total_time: 0, cost: 0 },
            totals: { duration: 0, cost: 0 }
        };

        // Calculate printing metrics
        if (phase.department === 'STAMPA' && phase.v_stampa > 0) {
            const metersToPrint = (bagStep * quantity) / 1000;
            results.printing.processing_time = Math.round((metersToPrint / phase.v_stampa) * 100) / 100;
            results.printing.setup_time = Math.round((phase.t_setup_stampa || 0) * 100) / 100;
            results.printing.total_time = results.printing.processing_time + results.printing.setup_time;
            results.printing.cost = Math.round((results.printing.total_time * (phase.costo_h_stampa || 0)) * 100) / 100;
        }

        // Calculate packaging metrics
        if (phase.department === 'CONFEZIONAMENTO' && phase.v_conf > 0) {
            results.packaging.processing_time = Math.round((quantity / phase.v_conf) * 100) / 100;
            results.packaging.setup_time = Math.round((phase.t_setup_conf || 0) * 100) / 100;
            results.packaging.total_time = results.packaging.processing_time + results.packaging.setup_time;
            results.packaging.cost = Math.round((results.packaging.total_time * (phase.costo_h_conf || 0)) * 100) / 100;
        }

        // Calculate totals
        results.totals.duration = Math.round((results.printing.total_time + results.packaging.total_time) * 100) / 100;
        results.totals.cost = Math.round((results.printing.cost + results.packaging.cost) * 100) / 100;

        return results;
    }

    display_calculation_results(results) {
        this.current_calculation_results = results;
        
        const calculationResultsEl = document.getElementById('calculation_results');
        if (calculationResultsEl) calculationResultsEl.style.display = 'block';

        this.update_result_field('printing_processing_time', results.printing.processing_time.toFixed(2));
        this.update_result_field('printing_setup_time', results.printing.setup_time.toFixed(2));
        this.update_result_field('printing_total_time', results.printing.total_time.toFixed(2));
        this.update_result_field('printing_cost', results.printing.cost.toFixed(2));
        this.update_result_field('packaging_processing_time', results.packaging.processing_time.toFixed(2));
        this.update_result_field('packaging_setup_time', results.packaging.setup_time.toFixed(2));
        this.update_result_field('packaging_total_time', results.packaging.total_time.toFixed(2));
        this.update_result_field('packaging_cost', results.packaging.cost.toFixed(2));
        this.update_result_field('total_duration', results.totals.duration.toFixed(2));
        this.update_result_field('total_cost', results.totals.cost.toFixed(2));
    }

    update_result_field(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (field) field.textContent = value;
    }

    hide_calculation_results() {
        const calculationResults = document.getElementById('calculation_results');
        if (calculationResults) calculationResults.style.display = 'none';
    }

    async handle_create_task() {
        if (this.elements.create_task.disabled) return;
        this.elements.create_task.disabled = true;
        
        if (!this.validate_form_fields(false)) {
            this.show_error_message('validating form fields', new Error('Please fill in all required fields'));
            this.elements.create_task.disabled = false;
            return;
        }
        
        try {
            const formData = this.collect_form_data();
            const validation = this.validationService.validate_odp(formData, { context: 'submission' });
            
            if (!validation.isValid) {
                this.show_error_message('validating production order', new Error('Validation failed: ' + validation.errors.join(', ')));
                this.elements.create_task.disabled = false;
            return;
        }

            const orderData = {
                ...this.collect_form_data(), // Re-use form data collection
                delivery_date: this.elements.delivery_date.value,
            bag_height: parseInt(this.elements.bag_height.value) || 0,
            bag_width: parseInt(this.elements.bag_width.value) || 0,
            bag_step: parseInt(this.elements.bag_step.value) || 0,
                seal_sides: this.elements.seal_sides.value,
            product_type: this.elements.product_type.value,
            quantity: parseInt(this.elements.quantity.value) || 0,
                internal_customer_code: this.elements.internal_customer_code.value.trim(),
            external_customer_code: this.elements.external_customer_code.value.trim(),
            customer_order_ref: this.elements.customer_order_ref.value.trim(),
                duration: this.current_calculation_results?.totals.duration || 0,
                cost: this.current_calculation_results?.totals.cost || 0,
                status: 'NOT SCHEDULED',
                production_start: null,
                production_end: null,
                progress: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            if (window.DEBUG) console.log('About to add order to storage:', orderData);

            await this.storageService.add_odp_order(orderData);

            this.clear_form_fields();
            this.load_backlog();
            this.show_success_message(`Production order "${orderData.odp_number}" created`);
            this.hide_calculation_results();
            
        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error?.message || error));
            this.show_error_message('creating production order', errorObj);
            if (this.elements.create_task) this.elements.create_task.disabled = false;
        }
    }

    async load_backlog() {
        try {
            const backlogItems = await this.storageService.get_odp_orders() || [];
            if (window.DEBUG) console.log('Loading backlog items:', backlogItems);
            this.render_backlog(backlogItems);
        } catch (error) {
            console.error('Error loading backlog:', error);
            const errorObj = error instanceof Error ? error : new Error(String(error?.message || error));
            this.show_error_message('loading backlog', errorObj);
            this.render_backlog([]);
        }
    }

    render_backlog(items) {
        if (!this.elements.backlog_table_body) return;

        if (!items || items.length === 0) {
            this.elements.backlog_table_body.innerHTML = `
                <tr><td colspan="14" class="text-center" style="padding: 2rem; color: #6b7280;">
                        No backlog items found. Create production lots to get started.
                </td></tr>`;
            return;
        }
        
        this.elements.backlog_table_body.innerHTML = items.map(item => this.create_backlog_row(item)).join('');
    }

    create_backlog_row(item) {
        // This function is primarily HTML generation, no significant code logic to streamline.
        // It remains unchanged for brevity and clarity.
        return `
            <tr data-odp-id="${item.id}">
                <td class="editable-cell" data-field="id"><span class="static-value">${item.id}</span>${this.editManager ? this.editManager.create_edit_input('text', item.id) : ''}</td>
                <td class="editable-cell" data-field="odp_number"><span class="static-value">${Utils.escape_html(item.odp_number || '-')}</span>${this.editManager ? this.editManager.create_edit_input('text', item.odp_number) : ''}</td>
                <td class="editable-cell" data-field="article_code"><span class="static-value">${Utils.escape_html(item.article_code || '-')}</span>${this.editManager ? this.editManager.create_edit_input('text', item.article_code) : ''}</td>
                <td class="editable-cell" data-field="production_lot"><span class="static-value">${Utils.escape_html(item.production_lot || '-')}</span>${this.editManager ? this.editManager.create_edit_input('text', item.production_lot) : ''}</td>
                <td class="editable-cell" data-field="work_center"><span class="static-value">${Utils.escape_html(item.work_center || '-')}</span>${this.editManager ? this.editManager.create_edit_input('text', item.work_center) : ''}</td>
                <td class="editable-cell" data-field="nome_cliente"><span class="static-value">${Utils.escape_html(item.nome_cliente || '-')}</span>${this.editManager ? this.editManager.create_edit_input('text', item.nome_cliente) : ''}</td>
                <td class="editable-cell" data-field="description"><span class="static-value">${Utils.escape_html(item.description || '-')}</span>${this.editManager ? this.editManager.create_edit_input('text', item.description) : ''}</td>
                <td class="editable-cell" data-field="bag_height"><span class="static-value">${item.bag_height || '-'} mm</span>${this.editManager ? this.editManager.create_edit_input('number', item.bag_height, { min: 0 }) : ''}</td>
                <td class="editable-cell" data-field="bag_width"><span class="static-value">${item.bag_width || '-'} mm</span>${this.editManager ? this.editManager.create_edit_input('number', item.bag_width, { min: 0 }) : ''}</td>
                <td class="editable-cell" data-field="bag_step"><span class="static-value">${item.bag_step || '-'} mm</span>${this.editManager ? this.editManager.create_edit_input('number', item.bag_step, { min: 0 }) : ''}</td>
                <td class="editable-cell" data-field="seal_sides"><span class="static-value">${item.seal_sides || '-'} sides</span>${this.editManager ? this.editManager.create_edit_input('select', item.seal_sides, { options: [{ value: '3', label: '3 sides' }, { value: '4', label: '4 sides' }] }) : ''}</td>
                <td class="editable-cell" data-field="product_type"><span class="static-value">${Utils.escape_html(item.product_type || '-')}</span>${this.editManager ? this.editManager.create_edit_input('text', item.product_type) : ''}</td>
                <td class="editable-cell" data-field="quantity"><span class="static-value">${item.quantity || '-'}</span>${this.editManager ? this.editManager.create_edit_input('number', item.quantity, { min: 0 }) : ''}</td>
                <td class="editable-cell" data-field="production_start"><span class="static-value">${item.production_start ? this.format_production_start(item.production_start) : '-'}</span>${this.editManager ? this.editManager.create_edit_input('datetime-local', item.production_start) : ''}</td>
                <td class="editable-cell" data-field="production_end"><span class="static-value">${item.production_end ? this.format_production_end(item.production_end) : '-'}</span>${this.editManager ? this.editManager.create_edit_input('datetime-local', item.production_end) : ''}</td>
                <td class="editable-cell" data-field="delivery_date"><span class="static-value">${item.delivery_date || '-'}</span>${this.editManager ? this.editManager.create_edit_input('datetime-local', item.delivery_date) : ''}</td>
                <td class="editable-cell" data-field="internal_customer_code"><span class="static-value">${Utils.escape_html(item.internal_customer_code || '-')}</span>${this.editManager ? this.editManager.create_edit_input('text', item.internal_customer_code) : ''}</td>
                <td class="editable-cell" data-field="external_customer_code"><span class="static-value">${Utils.escape_html(item.external_customer_code || '-')}</span>${this.editManager ? this.editManager.create_edit_input('text', item.external_customer_code) : ''}</td>
                <td class="editable-cell" data-field="customer_order_ref"><span class="static-value">${Utils.escape_html(item.customer_order_ref || '-')}</span>${this.editManager ? this.editManager.create_edit_input('text', item.customer_order_ref) : ''}</td>
                <td class="editable-cell" data-field="department"><span class="static-value"><span class="btn btn-primary" style="font-size: 12px; padding: 6px 12px; min-height: 28px;">${Utils.escape_html(item.department || '-')}</span></span>${this.editManager ? this.editManager.create_edit_input('text', item.department) : ''}</td>
                <td class="editable-cell" data-field="fase"><span class="static-value">${Utils.escape_html(item.fase || '-')}</span>${this.editManager ? this.editManager.create_edit_input('text', item.fase) : ''}</td>
                <td class="editable-cell" data-field="duration"><span class="static-value">${item.duration || '-'} h</span>${this.editManager ? this.editManager.create_edit_input('number', item.duration, { min: 0, step: 0.1 }) : ''}</td>
                <td class="editable-cell" data-field="cost"><span class="static-value">€${item.cost || '-'}</span>${this.editManager ? this.editManager.create_edit_input('number', item.cost, { min: 0, step: 0.01 }) : ''}</td>
                <td class="editable-cell" data-field="progress"><span class="static-value">${item.progress || 0}%</span>${this.editManager ? this.editManager.create_edit_input('number', item.progress, { min: 0, max: 100, step: 1 }) : ''}</td>
                <td class="editable-cell" data-field="priority"><span class="static-value">${Utils.escape_html(item.priority || '-')}</span>${this.editManager ? this.editManager.create_edit_input('text', item.priority) : ''}</td>
                <td class="editable-cell" data-field="status"><span class="static-value">${Utils.escape_html(item.status || '-')}</span>${this.editManager ? this.editManager.create_edit_input('text', item.status) : ''}</td>
                <td class="editable-cell" data-field="scheduled_machine"><span class="static-value">${Utils.escape_html(item.machines?.machine_name || '-')}</span>${this.editManager ? this.editManager.create_edit_input('text', item.machines?.machine_name || '') : ''}</td>
                <td class="text-center">${this.editManager ? this.editManager.create_action_buttons() : ''}</td>
            </tr>
        `;
    }

    async save_edit(row) {
        const odpId = row.dataset.odpId;
        if (!odpId) {
            console.error('No ODP ID found in row');
            return;
        }

        const updatedData = this.validate_edit_row(
            row, ['odp_number', 'article_code', 'production_lot'], ['bag_height', 'bag_width', 'bag_step', 'quantity', 'progress'], { bag_height: 'Bag Height', bag_width: 'Bag Width', bag_step: 'Bag Step', quantity: 'Quantity', progress: 'Progress' }
        );

        if (!updatedData) return;

        try {
            const currentOrder = await this.storageService.get_odp_order_by_id(odpId);
            if (!currentOrder) {
                this.showMessage('ODP order not found', 'error');
                return;
            }

            // Clean up datetime fields - convert empty strings to null
            const cleanedData = { ...updatedData };
            ['production_start', 'production_end', 'delivery_date'].forEach(field => {
                if (cleanedData[field] === '' || cleanedData[field] === null || cleanedData[field] === undefined) {
                    cleanedData[field] = null;
                }
            });

            // Clean up numeric fields - convert empty strings to 0
            ['bag_height', 'bag_width', 'bag_step', 'quantity', 'progress', 'duration', 'cost'].forEach(field => {
                if (cleanedData[field] === '' || cleanedData[field] === null || cleanedData[field] === undefined) {
                    cleanedData[field] = 0;
                } else if (typeof cleanedData[field] === 'string') {
                    // Convert string numbers to actual numbers
                    cleanedData[field] = parseFloat(cleanedData[field]) || 0;
                }
            });

            const updatedOrder = { ...currentOrder, ...cleanedData, updated_at: new Date().toISOString() };
            await this.storageService.update_odp_order(odpId, updatedOrder);

            this.editManager.cancel_edit(row);
            this.load_backlog();
            this.show_success_message('ODP order updated');
        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error?.message || error));
            this.show_error_message('updating ODP order', errorObj);
        }
    }

    clear_form_fields() {
        Object.values(this.elements).forEach(element => {
            if (element?.tagName === 'INPUT' || element?.tagName === 'SELECT' || element?.tagName === 'TEXTAREA') {
                element.type === 'checkbox' || element.type === 'radio' ? element.checked = false : element.value = '';
            }
        });

        if (this.elements.article_code) delete this.elements.article_code.dataset.department;
        if (this.elements.work_center) this.elements.work_center.value = '';
        if (this.elements.department) this.elements.department.value = '';

        this.current_calculation_results = null;
        this.populate_phases_dropdown().catch(console.error);
        this.validate_form_fields();
        this.update_bag_preview();
    }

    async populate_phases_dropdown() {
        try {
            const phases = await this.storageService.get_phases();
            const faseDropdown = this.elements.fase;
            if (!faseDropdown || !phases?.length) return;
            
                faseDropdown.innerHTML = '<option value="">Select production phase</option>';
                const department = this.elements.department.value;
                const workCenter = this.elements.work_center.value;
                
            const relevantPhases = (department || workCenter)
                ? phases.filter(p => (!department || p.department === department) && (!workCenter || p.work_center === workCenter))
                : phases;
                
                relevantPhases.forEach(phase => {
                    const option = document.createElement('option');
                option.value = phase.id;
                option.textContent = phase.name;
                    faseDropdown.appendChild(option);
                });
        } catch (error) {
            console.error("Error populating phases dropdown:", error);
        }
    }

    async delete_odp_order(odpId) {
        try {
            const currentOrder = await this.storageService.get_odp_order_by_id(odpId);
            const orderName = currentOrder?.odp_number || 'this ODP order';
            const message = `Are you sure you want to delete "${orderName}"? This action cannot be undone.`;
            
            show_delete_confirmation(message, async () => {
                try {
                    await this.storageService.remove_odp_order(odpId);
                    await this.load_backlog();
                    this.show_success_message('ODP order deleted');
        } catch (error) {
                    const errorObj = error instanceof Error ? error : new Error(String(error?.message || error));
                    this.show_error_message('deleting ODP order', errorObj);
                }
            });
        } catch (error) {
            const errorObj = error instanceof Error ? error : new Error(String(error?.message || error));
            this.show_error_message('deleting ODP order', errorObj);
        }
    }

    /**
     * Sync all ODP orders with current Gantt data
     */
    async sync_all_odp_with_gantt() {
        try {
            // Simple refresh - no complex sync needed with machine IDs
            await this.load_backlog();
            this.show_success_message('Backlog refreshed successfully');
        } catch (error) {
            console.error('Error refreshing backlog:', error);
            const errorObj = error instanceof Error ? error : new Error(String(error?.message || error));
            this.show_error_message('refreshing backlog', errorObj);
        }
    }



    /**
     * Debug method to show current scheduled events and ODP orders
     */
    async debug_scheduled_events() {
        try {
            const scheduledEvents = await this.storageService.get_scheduled_events() || [];
            const allOrders = await this.storageService.get_odp_orders() || [];
            
            console.group("Scheduler Debug");
            console.log('=== SCHEDULED EVENTS ===');
            console.table(scheduledEvents);
            console.log('=== ODP ORDERS ===');
            console.table(allOrders.map(o => ({ id: o.id, odp: o.odp_number, status: o.status, start: o.production_start, end: o.production_end })));
            console.groupEnd();
        } catch (error) {
            console.error('Error in debug method:', error);
        }
    }

    /**
     * Format production start/end timestamp for display
     * @param {string} timestamp - ISO timestamp string
     * @returns {string} - Formatted date and time
     */
    format_timestamp_for_display(timestamp) {
        try {
            if (!timestamp) return '-';
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '-';
            
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch (error) {
            console.error('Error formatting timestamp:', error);
            return '-';
        }
    }

    format_production_start(timestamp) {
        return this.format_timestamp_for_display(timestamp);
    }

    format_production_end(timestamp) {
        return this.format_timestamp_for_display(timestamp);
    }
}